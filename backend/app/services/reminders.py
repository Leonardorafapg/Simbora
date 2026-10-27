# backend/app/services/reminders.py
"""Lembretes automáticos: compromissos da agenda (1 dia e 30 min antes) e prazo das demandas.

Cada função recebe o `now` (UTC sem fuso) — o laço em segundo plano passa o relógio real, os
testes passam o que quiserem. Rodar de novo no mesmo instante não repete nada: cada aviso tem uma
`dedupe_key` que inclui o que o faz valer (horário do compromisso, prazo da demanda).
"""
import logging
from datetime import datetime, timedelta

from sqlalchemy import and_, exists, extract, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.timeutil import BRT, as_utc, brt_today, format_when
from app.models.agenda import AgendaEvent
from app.models.calendar_entry import CalendarEntry
from app.models.calendar_period import CalendarPeriod
from app.models.notification import Notification
from app.services import notifications
from app.services.deadlines import PENDING_STATUSES, entry_deadline
from app.services.demands import entry_label, production_link

logger = logging.getLogger("reminders")

TYPE_AGENDA_1D = "agenda_lembrete_1d"
TYPE_AGENDA_30M = "agenda_lembrete_30m"
TYPE_DEADLINE_TOMORROW = "prazo_amanha"
TYPE_DEADLINE_TODAY = "prazo_hoje"

ONE_DAY = timedelta(days=1)
THIRTY_MIN = timedelta(minutes=30)

# Lembrete de prazo: dias antes do vencimento em que o designer é avisado (1 = amanhã, 0 = hoje, o
# último dia antes de atrasar) e a hora (Brasília) a partir da qual o aviso sai.
DEADLINE_DAYS_BEFORE = (1, 0)
DEADLINE_REMINDER_HOUR = 9


def agenda_reminders(db: Session, now: datetime) -> list[Notification]:
    """Compromissos que começam em até 1 dia: aviso de 1 dia antes e de 30 min antes, pra cada participante."""
    created: list[Notification] = []
    upcoming = (
        db.query(AgendaEvent).filter(AgendaEvent.starts_at > now, AgendaEvent.starts_at <= now + ONE_DAY).all()
    )
    for event in upcoming:
        remaining = event.starts_at - now
        # `starts_at` na chave: remarcar o compromisso arma os lembretes de novo.
        stamp = f"{event.id}:{event.starts_at:%Y%m%d%H%M}"
        recipients = [p.id for p in event.participants]

        if remaining <= THIRTY_MIN:
            created += _commit_batch(
                db,
                recipients,
                type=TYPE_AGENDA_30M,
                title=f"Em 30 minutos: {event.title}",
                body=format_when(event.starts_at),
                link=f"/agenda?evento={event.id}",
                dedupe_key=f"agenda:{stamp}:30m",
            )
        elif event.updated_at <= event.starts_at - ONE_DAY:
            # Marcado/alterado depois de abrir a janela de 1 dia? A pessoa acabou de ser avisada — sem repetir.
            created += _commit_batch(
                db,
                recipients,
                type=TYPE_AGENDA_1D,
                title=f"Amanhã: {event.title}",
                body=format_when(event.starts_at),
                link=f"/agenda?evento={event.id}",
                dedupe_key=f"agenda:{stamp}:1d",
            )
    return created


def deadline_reminders(db: Session, now: datetime) -> list[Notification]:
    """Demandas ainda não entregues cujo prazo é amanhã/hoje: avisa o designer responsável, a partir das 9h."""
    local = as_utc(now).astimezone(BRT)
    if local.hour < DEADLINE_REMINDER_HOUR:
        return []
    today = brt_today(now)

    candidates = (
        db.query(CalendarEntry)
        .filter(
            CalendarEntry.assignee_id.is_not(None),
            CalendarEntry.status.in_(PENDING_STATUSES),
            or_(
                CalendarEntry.from_production.is_(True),
                exists().where(
                    and_(
                        CalendarPeriod.client_id == CalendarEntry.client_id,
                        CalendarPeriod.year == extract("year", CalendarEntry.scheduled_date),
                        CalendarPeriod.month == extract("month", CalendarEntry.scheduled_date),
                        CalendarPeriod.status == "finalizado",
                    )
                ),
            ),
        )
        .all()
    )

    created: list[Notification] = []
    for entry in candidates:
        deadline = entry_deadline(entry)
        days_left = (deadline - today).days
        if days_left not in DEADLINE_DAYS_BEFORE:
            continue
        tomorrow = days_left == 1
        created += _commit_batch(
            db,
            [entry.assignee_id],
            type=TYPE_DEADLINE_TOMORROW if tomorrow else TYPE_DEADLINE_TODAY,
            title=f"{'Vence amanhã' if tomorrow else 'Vence hoje'}: {entry_label(entry)}",
            body=f"Prazo de entrega {deadline:%d/%m} • post {entry.scheduled_date:%d/%m}",
            link=production_link(entry),
            # O prazo na chave: se o prazo mudar, o lembrete vale de novo.
            dedupe_key=f"prazo:{entry.id}:{deadline:%Y%m%d}:{days_left}d",
        )
    return created


def run_all(db: Session, now: datetime) -> list[Notification]:
    """Uma rodada completa do verificador. Devolve os avisos criados (já salvos)."""
    return [*agenda_reminders(db, now), *deadline_reminders(db, now)]


# --- internos ----------------------------------------------------------------------------------


def _commit_batch(db: Session, user_ids: list[int], **fields) -> list[Notification]:
    """Cria e salva um lote. Se outro processo gravou o mesmo aviso no meio (chave repetida), descarta o lote."""
    try:
        created = notifications.create_notifications(db, user_ids, **fields)
        db.commit()
        return created
    except IntegrityError:
        db.rollback()
        logger.info("Aviso já criado por outro processo (%s) — ignorado.", fields.get("dedupe_key"))
        return []
