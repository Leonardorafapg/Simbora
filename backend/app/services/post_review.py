# backend/app/services/post_review.py
"""
Revisão de postagens na Produção: a coluna "Checagem e aprovação" só é decidida por quem tem
`post.review` (a redatora; admin também passa). Qualquer pessoa com `calendar.edit` manda o post
pra checagem, mas só o revisor move pra "Aprovados"/"Publicados" ou "Modificações".
"""
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.permissions import has_permission
from app.models.calendar_entry import CalendarEntry
from app.models.calendar_entry_review import CalendarEntryReview
from app.models.client import Client
from app.models.notification import Notification
from app.models.user import User
from app.services import notifications
from app.services.demands import entry_label, production_link

REVIEW_PERMISSION = "post.review"
REVIEW_STAGE = "checagem_aprovacao"

TYPE_REVIEW_PENDING = "post_revisao"
TYPE_REVIEW_DONE = "post_revisado"
TYPE_CHANGE_REQUEST = "post_alteracao"

_APPROVED = {"finalizados", "publicados"}


def needs_reviewer(current: str | None, new: str) -> bool:
    """A mudança de coluna é uma decisão de revisão? (`current` é None na criação do post.)"""
    if new in _APPROVED:
        return current not in _APPROVED  # finalizados -> publicados já passou pela revisão
    if new == "modificacoes":
        return current != "modificacoes"
    return False


def ensure_can_move(user: User, current: str | None, new: str) -> None:
    if needs_reviewer(current, new) and not has_permission(user, REVIEW_PERMISSION):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Só quem revisa os posts (redatora) pode aprovar ou pedir ajustes. Mande o post para "
            "\"Checagem e aprovação\" e aguarde a revisão.",
        )


def is_decision(current: str | None, new: str) -> bool:
    """Saiu da checagem por aprovação ou por pedido de ajustes: vira uma entrada no histórico."""
    return current == REVIEW_STAGE and new in (_APPROVED | {"modificacoes"})


def record(db: Session, entry: CalendarEntry, new_status: str, reason: str | None, user: User) -> CalendarEntryReview:
    """Grava a decisão. Reprovar exige motivo. Não faz commit."""
    reason = (reason or "").strip() or None
    rejected = new_status == "modificacoes"
    if rejected and reason is None:
        raise HTTPException(status_code=422, detail="Informe o motivo para pedir ajustes no post.")
    review = CalendarEntryReview(
        entry_id=entry.id,
        decision="reprovado" if rejected else "aprovado",
        reason=reason if rejected else None,
        decided_by_user_id=user.id,
    )
    db.add(review)
    return review


def list_for_entry(db: Session, entry_id: int) -> list[CalendarEntryReview]:
    return (
        db.query(CalendarEntryReview)
        .filter(CalendarEntryReview.entry_id == entry_id)
        .order_by(CalendarEntryReview.decided_at.desc(), CalendarEntryReview.id.desc())
        .all()
    )


def reviewer_ids(db: Session) -> list[int]:
    """Quem tem `post.review` explícito (admin não entra: avisar todo admin seria ruído)."""
    return [u.id for u in db.query(User).filter(User.is_active.is_(True)).all() if REVIEW_PERMISSION in (u.permissions or [])]


def _client_name(db: Session, client_id: int) -> str:
    client = db.get(Client, client_id)
    return client.name if client else "Cliente"


def notify_pending(db: Session, entry: CalendarEntry, actor_id: int | None) -> list[Notification]:
    """O post chegou na checagem: avisa os revisores."""
    recipients = [uid for uid in reviewer_ids(db) if uid != actor_id]
    return notifications.create_notifications(
        db,
        recipients,
        type=TYPE_REVIEW_PENDING,
        title=f"Post para revisar: {entry_label(entry)}",
        body=f"{_client_name(db, entry.client_id)} • post {entry.scheduled_date:%d/%m}",
        link=production_link(entry),
    )


def notify_decision(db: Session, entry: CalendarEntry, review: CalendarEntryReview, actor_id: int | None) -> list[Notification]:
    """Aprovado ou com ajustes: avisa o responsável (designer) pelo post."""
    if entry.assignee_id is None or entry.assignee_id == actor_id:
        return []
    approved = review.decision == "aprovado"
    return notifications.create_notifications(
        db,
        [entry.assignee_id],
        type=TYPE_REVIEW_DONE,
        title=f"{'Post aprovado' if approved else 'Ajustes pedidos'}: {entry_label(entry)}",
        body=_client_name(db, entry.client_id) if approved else (review.reason or "")[:300],
        link=production_link(entry),
    )


def notify_change_request(db: Session, entry: CalendarEntry, actor_id: int | None) -> list[Notification]:
    """O social escreveu (ou mudou) o pedido de alteração: avisa o responsável (designer) pelo post."""
    if entry.assignee_id is None or entry.assignee_id == actor_id or not (entry.change_request or "").strip():
        return []
    return notifications.create_notifications(
        db,
        [entry.assignee_id],
        type=TYPE_CHANGE_REQUEST,
        title=f"Pedido de alteração: {entry_label(entry)}",
        body=entry.change_request.strip()[:300],
        link=production_link(entry),
    )
