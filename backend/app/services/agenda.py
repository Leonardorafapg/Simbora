# backend/app/services/agenda.py
"""Regras da agenda: quem recebe aviso quando um compromisso é marcado, alterado ou cancelado."""
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy.orm import Session

from app.core.timeutil import format_when
from app.models.agenda import AgendaEvent, agenda_event_participants
from app.models.notification import Notification
from app.models.push_subscription import PushSubscription
from app.services import notifications

TYPE_INVITE = "agenda_convite"
TYPE_CHANGED = "agenda_alterada"
TYPE_REMOVED = "agenda_removido"
TYPE_CANCELED = "agenda_cancelada"


@dataclass(frozen=True)
class EventSnapshot:
    """Estado do compromisso antes de uma edição/exclusão (a linha muda ou some depois)."""

    id: int
    title: str
    description: str | None
    starts_at: datetime
    ends_at: datetime
    participant_ids: frozenset[int]

    @classmethod
    def of(cls, event: AgendaEvent) -> "EventSnapshot":
        return cls(
            id=event.id,
            title=event.title,
            description=event.description,
            starts_at=event.starts_at,
            ends_at=event.ends_at,
            participant_ids=frozenset(p.id for p in event.participants),
        )


def _link(event_id: int) -> str:
    return f"/agenda?evento={event_id}"


def changed_fields(before: EventSnapshot, after: EventSnapshot) -> list[str]:
    """Nomes (pra texto do aviso) do que mudou de relevante pra quem já estava no compromisso."""
    fields = []
    if before.starts_at != after.starts_at or before.ends_at != after.ends_at:
        fields.append("horário")
    if before.title != after.title:
        fields.append("título")
    if (before.description or "") != (after.description or ""):
        fields.append("descrição")
    return fields


def notify_created(db: Session, event: AgendaEvent, actor_name: str, actor_id: int) -> list[Notification]:
    recipients = [p.id for p in event.participants if p.id != actor_id]
    return notifications.create_notifications(
        db,
        recipients,
        type=TYPE_INVITE,
        title=f"Novo compromisso: {event.title}",
        body=f"{format_when(event.starts_at)} • marcado por {actor_name}",
        link=_link(event.id),
    )


def notify_updated(
    db: Session, before: EventSnapshot, after: EventSnapshot, actor_name: str, actor_id: int
) -> list[Notification]:
    created: list[Notification] = []
    added = after.participant_ids - before.participant_ids - {actor_id}
    removed = before.participant_ids - after.participant_ids - {actor_id}
    kept = (before.participant_ids & after.participant_ids) - {actor_id}

    created += notifications.create_notifications(
        db,
        sorted(added),
        type=TYPE_INVITE,
        title=f"Novo compromisso: {after.title}",
        body=f"{format_when(after.starts_at)} • marcado por {actor_name}",
        link=_link(after.id),
    )
    created += notifications.create_notifications(
        db,
        sorted(removed),
        type=TYPE_REMOVED,
        title=f"Você saiu do compromisso: {before.title}",
        body=f"{format_when(before.starts_at)} • alterado por {actor_name}",
    )

    fields = changed_fields(before, after)
    if fields and kept:
        detail = f"Mudou: {', '.join(fields)} • por {actor_name}"
        if "horário" in fields:
            detail = f"Agora {format_when(after.starts_at)} (antes {format_when(before.starts_at)}) • por {actor_name}"
        created += notifications.create_notifications(
            db,
            sorted(kept),
            type=TYPE_CHANGED,
            title=f"Compromisso alterado: {after.title}",
            body=detail,
            link=_link(after.id),
        )
    return created


def notify_deleted(db: Session, before: EventSnapshot, actor_name: str, actor_id: int) -> list[Notification]:
    return notifications.create_notifications(
        db,
        sorted(before.participant_ids - {actor_id}),
        type=TYPE_CANCELED,
        title=f"Compromisso cancelado: {before.title}",
        body=f"Era {format_when(before.starts_at)} • cancelado por {actor_name}",
    )


def delete_user_data(db: Session, user_id: int) -> None:
    """Apaga o que prende o usuário (compromissos que marcou, participações e avisos) antes de excluí-lo."""
    for event in db.query(AgendaEvent).filter(AgendaEvent.created_by == user_id).all():
        db.delete(event)
    db.flush()  # remove as participações desses compromissos antes do delete cru abaixo
    db.execute(agenda_event_participants.delete().where(agenda_event_participants.c.user_id == user_id))
    db.query(Notification).filter(Notification.user_id == user_id).delete(synchronize_session=False)
    db.query(PushSubscription).filter(PushSubscription.user_id == user_id).delete(synchronize_session=False)
