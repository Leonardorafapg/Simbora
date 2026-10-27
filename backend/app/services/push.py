# backend/app/services/push.py
"""Notificação push no celular (Web Push, padrão aberto — sem Firebase nem conta de terceiros).

O navegador entrega a inscrição (endpoint + chaves); aqui guardamos por usuário e, a cada aviso
criado, mandamos um push pros aparelhos da pessoa. Inscrição que o serviço de push recusa (404/410:
aparelho desinstalou o app ou revogou a permissão) é apagada na hora.
"""
import json
import logging
from collections.abc import Iterable

from pywebpush import WebPushException, webpush
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.push_subscription import PushSubscription

logger = logging.getLogger("push")

# Quanto tempo o serviço de push segura o aviso se o aparelho estiver desligado/sem rede.
TTL_SECONDS = 60 * 60
GONE_STATUS_CODES = (404, 410)


def is_enabled() -> bool:
    return bool(settings.VAPID_PUBLIC_KEY and settings.VAPID_PRIVATE_KEY)


def subscribe(db: Session, user_id: int, *, endpoint: str, p256dh: str, auth: str, user_agent: str | None) -> PushSubscription:
    """Registra o aparelho. O mesmo endpoint (reinstalação, outro login no mesmo aparelho) passa pra pessoa atual."""
    sub = db.query(PushSubscription).filter(PushSubscription.endpoint == endpoint).first()
    if sub is None:
        sub = PushSubscription(endpoint=endpoint, p256dh=p256dh, auth=auth, user_id=user_id)
        db.add(sub)
    sub.user_id, sub.p256dh, sub.auth = user_id, p256dh, auth
    sub.user_agent = (user_agent or "")[:300] or None
    db.commit()
    db.refresh(sub)
    return sub


def unsubscribe(db: Session, user_id: int, endpoint: str) -> bool:
    removed = (
        db.query(PushSubscription)
        .filter(PushSubscription.endpoint == endpoint, PushSubscription.user_id == user_id)
        .delete(synchronize_session=False)
    )
    db.commit()
    return removed > 0


def _send_one(sub: PushSubscription, message: str) -> bool:
    """Manda um push. False se o aparelho não existe mais (a inscrição deve ser apagada)."""
    try:
        webpush(
            subscription_info={"endpoint": sub.endpoint, "keys": {"p256dh": sub.p256dh, "auth": sub.auth}},
            data=message,
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims={"sub": settings.VAPID_SUBJECT},
            ttl=TTL_SECONDS,
            timeout=10,
        )
        return True
    except WebPushException as exc:
        status = getattr(exc.response, "status_code", None)
        if status in GONE_STATUS_CODES:
            return False
        logger.warning("Push recusado (%s) pra inscrição %s: %s", status, sub.id, exc)
        return True  # erro passageiro: mantém a inscrição
    except Exception:
        logger.exception("Falha ao enviar push pra inscrição %s", sub.id)
        return True


def send_to_users(items: Iterable[tuple[int, dict]]) -> int:
    """Push pra cada aviso `(destinatário, dados)`. Bloqueante (rede) — chamar em thread. Devolve quantos foram enviados."""
    if not is_enabled():
        return 0
    sent = 0
    db = SessionLocal()
    try:
        for user_id, payload in items:
            message = json.dumps(
                {"id": payload.get("id"), "title": payload.get("title"), "body": payload.get("body"), "link": payload.get("link")}
            )
            for sub in db.query(PushSubscription).filter(PushSubscription.user_id == user_id).all():
                if _send_one(sub, message):
                    sent += 1
                else:
                    db.delete(sub)
        db.commit()
    finally:
        db.close()
    return sent
