# backend/app/services/notifications.py
"""Central de avisos: cria, lista e entrega (WebSocket) as notificações de cada pessoa.

Quem dispara um aviso chama `create_notifications` dentro da própria transação, dá o commit
e depois `await publish(...)` pra empurrar pro navegador de quem estiver com o CRM aberto.
"""
import asyncio
import logging
from collections.abc import Iterable

from sqlalchemy.orm import Session

from app.core.timeutil import utcnow
from app.core.ws_manager import user_manager
from app.models.notification import Notification
from app.services import push
from app.schemas.notification import NotificationOut


logger = logging.getLogger("notifications")


def create_notifications(
    db: Session,
    user_ids: Iterable[int],
    *,
    type: str,
    title: str,
    body: str | None = None,
    link: str | None = None,
    dedupe_key: str | None = None,
) -> list[Notification]:
    """Um aviso por usuário. Com `dedupe_key`, quem já recebeu esse aviso é ignorado (rodar duas vezes não duplica).
    Não faz commit."""
    created: list[Notification] = []
    for user_id in dict.fromkeys(user_ids):
        if dedupe_key and (
            db.query(Notification.id)
            .filter(Notification.user_id == user_id, Notification.dedupe_key == dedupe_key)
            .first()
            is not None
        ):
            continue
        notification = Notification(
            user_id=user_id, type=type, title=title[:200], body=body, link=link, dedupe_key=dedupe_key
        )
        db.add(notification)
        created.append(notification)
    db.flush()
    return created


def payload_of(notification: Notification) -> tuple[int, dict]:
    """(destinatário, dados do aviso) — formato entregue ao navegador. Chamar com a sessão aberta."""
    return notification.user_id, NotificationOut.model_validate(notification).model_dump(mode="json")


async def publish_payloads(items: Iterable[tuple[int, dict]]) -> None:
    """Empurra avisos já salvos pra quem está online. Falha de entrega nunca derruba quem chamou."""
    items = list(items)
    for user_id, payload in items:
        await user_manager.send_to_user(user_id, {"type": "notification", "notification": payload})
    if items and push.is_enabled():
        # Rede bloqueante (serviço de push do navegador): fora do laço de eventos, e sem derrubar quem chamou.
        try:
            await asyncio.to_thread(push.send_to_users, items)
        except Exception:
            logger.exception("Falha ao enviar push")


async def publish(notifications: Iterable[Notification]) -> None:
    await publish_payloads([payload_of(n) for n in notifications])


def list_for_user(db: Session, user_id: int, *, limit: int = 30, offset: int = 0, unread_only: bool = False):
    query = db.query(Notification).filter(Notification.user_id == user_id)
    if unread_only:
        query = query.filter(Notification.read_at.is_(None))
    return query.order_by(Notification.created_at.desc(), Notification.id.desc()).offset(offset).limit(limit).all()


def unread_count(db: Session, user_id: int) -> int:
    return db.query(Notification).filter(Notification.user_id == user_id, Notification.read_at.is_(None)).count()


def mark_read(db: Session, user_id: int, notification_id: int) -> Notification | None:
    """None se o aviso não existe ou é de outra pessoa."""
    notification = db.get(Notification, notification_id)
    if notification is None or notification.user_id != user_id:
        return None
    if notification.read_at is None:
        notification.read_at = utcnow()
        db.commit()
    return notification


def mark_all_read(db: Session, user_id: int) -> int:
    changed = (
        db.query(Notification)
        .filter(Notification.user_id == user_id, Notification.read_at.is_(None))
        .update({"read_at": utcnow()}, synchronize_session=False)
    )
    db.commit()
    return changed
