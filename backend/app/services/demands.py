# backend/app/services/demands.py
"""Avisos de demanda nova pro designer responsável.

Uma demanda "nasce" pro designer quando entra na Produção: demanda avulsa criada na tela de
Produção, demanda atribuída/reatribuída a ele, ou calendário do cliente aprovado (todas as
postagens do mês de uma vez — nesse caso é UM aviso por designer, com a contagem).
"""
from collections import defaultdict
from collections.abc import Iterable
from datetime import date

from sqlalchemy.orm import Session

from app.core.timeutil import MONTHS_PT
from app.models.calendar_entry import CalendarEntry
from app.models.calendar_period import CalendarPeriod
from app.models.client import Client
from app.models.notification import Notification
from app.services import notifications
from app.services.deadlines import entry_deadline

TYPE_NEW_DEMAND = "demanda_nova"
TYPE_MONTH_DEMANDS = "demanda_mes"


def _dm(value) -> str:
    return f"{value:%d/%m}"


def production_link(entry: CalendarEntry) -> str:
    """Abre a demanda na Produção (já no mês dela)."""
    return f"/production?demanda={entry.id}&mes={entry.scheduled_date:%Y-%m}"


def entry_label(entry: CalendarEntry) -> str:
    return (entry.title or entry.theme or "Sem título").strip().splitlines()[0][:80]


def in_production(db: Session, entry: CalendarEntry) -> bool:
    """A postagem já aparece na Produção? (demanda avulsa, ou calendário do mês aprovado)."""
    if entry.from_production:
        return True
    return (
        db.query(CalendarPeriod.id)
        .filter(
            CalendarPeriod.client_id == entry.client_id,
            CalendarPeriod.year == entry.scheduled_date.year,
            CalendarPeriod.month == entry.scheduled_date.month,
            CalendarPeriod.status == "finalizado",
        )
        .first()
        is not None
    )


def _client_name(db: Session, client_id: int) -> str:
    client = db.get(Client, client_id)
    return client.name if client else "Cliente"


def notify_assigned(db: Session, entry: CalendarEntry, actor_id: int | None, *, reassigned: bool = False) -> list[Notification]:
    """Demanda (já na Produção) que chegou pra um designer — avulsa nova ou atribuída a ele. Não avisa quem fez a ação."""
    assignee = entry.assignee_id
    if assignee is None or assignee == actor_id:
        return []
    prefix = "Demanda atribuída a você" if reassigned else "Nova demanda"
    return notifications.create_notifications(
        db,
        [assignee],
        type=TYPE_NEW_DEMAND,
        title=f"{prefix}: {entry_label(entry)}",
        body=f"{_client_name(db, entry.client_id)} • post {_dm(entry.scheduled_date)} • prazo {_dm(entry_deadline(entry))}",
        link=production_link(entry),
    )


def notify_batch(
    db: Session, entries: Iterable[CalendarEntry], actor_id: int | None, *, month_label: str | None = None
) -> list[Notification]:
    """Várias demandas de uma vez (calendário aprovado, importação): UM aviso por designer e cliente."""
    groups: dict[tuple[int, int], list[CalendarEntry]] = defaultdict(list)
    for entry in entries:
        if entry.assignee_id is not None and entry.assignee_id != actor_id:
            groups[(entry.assignee_id, entry.client_id)].append(entry)

    created: list[Notification] = []
    for (assignee_id, client_id), items in groups.items():
        if len(items) == 1:
            created += notify_assigned(db, items[0], actor_id)
            continue
        first = min(e.scheduled_date for e in items)
        when = f" de {month_label}" if month_label else ""
        created += notifications.create_notifications(
            db,
            [assignee_id],
            type=TYPE_MONTH_DEMANDS,
            title=f"{len(items)} novas demandas: {_client_name(db, client_id)}",
            body=f"Calendário{when} aprovado • a primeira é pra {_dm(first)}",
            link=f"/production?mes={first:%Y-%m}",
        )
    return created


def notify_month_approved(db: Session, period: CalendarPeriod, actor_id: int | None) -> list[Notification]:
    """O calendário do cliente foi aprovado: as postagens do mês viram demandas da Produção."""
    entries = (
        db.query(CalendarEntry)
        .filter(
            CalendarEntry.client_id == period.client_id,
            CalendarEntry.from_production.is_(False),
            CalendarEntry.scheduled_date >= _first_day(period),
            CalendarEntry.scheduled_date < _first_day_next(period),
        )
        .all()
    )
    return notify_batch(db, entries, actor_id, month_label=f"{MONTHS_PT[period.month - 1]}/{period.year}")


def _first_day(period: CalendarPeriod) -> date:
    return date(period.year, period.month, 1)


def _first_day_next(period: CalendarPeriod) -> date:
    return date(period.year + (period.month == 12), period.month % 12 + 1, 1)
