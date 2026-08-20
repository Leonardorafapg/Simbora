# backend/app/routers/calendar_periods.py
from calendar import monthrange
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_permission
from app.models.calendar_entry import CalendarEntry
from app.models.calendar_period import CalendarPeriod
from app.models.demand import Demand
from app.models.user import User
from app.schemas.calendar_period import CalendarPeriodOut, CalendarPeriodSetStatus

router = APIRouter()

DEMAND_LEAD_DAYS = 2  # prazo padrão: 2 dias antes da data da postagem


def get_period_status(db: Session, client_id: int, year: int, month: int) -> str:
    """Não persiste nada — mês sem registro é simplesmente 'em_andamento'."""
    period = (
        db.query(CalendarPeriod)
        .filter(
            CalendarPeriod.client_id == client_id,
            CalendarPeriod.year == year,
            CalendarPeriod.month == month,
        )
        .first()
    )
    return period.status if period else "em_andamento"


def _generate_demands_for_period(db: Session, client_id: int, year: int, month: int, requester_id: int) -> None:
    """
    Toda postagem do calendário vira demanda ao finalizar o cronograma —
    sem exceção, mesmo que já tenha demanda de outro mês antigo pro mesmo
    cliente (a checagem é sempre por `calendar_entry_id`, não por cliente).
    Idempotente: rodar de novo não duplica quem já tem demanda.
    """
    start = date(year, month, 1)
    end = date(year, month, monthrange(year, month)[1])

    entries = (
        db.query(CalendarEntry)
        .filter(
            CalendarEntry.client_id == client_id,
            CalendarEntry.scheduled_date >= start,
            CalendarEntry.scheduled_date <= end,
        )
        .all()
    )
    if not entries:
        return

    already_linked = {
        row[0]
        for row in db.query(Demand.calendar_entry_id).filter(
            Demand.calendar_entry_id.in_([e.id for e in entries])
        )
    }

    for entry in entries:
        if entry.id in already_linked:
            continue

        db.add(
            Demand(
                client_id=entry.client_id,
                calendar_entry_id=entry.id,
                title=entry.theme,
                notes=entry.execution_notes,
                requester_id=requester_id,
                assignee_id=None,
                is_art=True,
                status="pendente",
                # Sinaliza pro designer se já existe algo (o social preencheu
                # o markdown "já tem material?" do calendário) ou se precisa
                # captar/produzir do zero.
                has_material=bool(entry.material_notes and entry.material_notes.strip()),
                due_date=entry.scheduled_date - timedelta(days=DEMAND_LEAD_DAYS),
            )
        )
        # Flush por demanda (não só no commit do fim) — sem isso, o SQLAlchemy
        # agrupa todas num INSERT em lote (executemany) quando finaliza um mês
        # com várias postagens de uma vez. Esse modo em lote gera um cast
        # explícito `::TEXT` pro parâmetro de `checklist`, e quebra porque a
        # coluna no Postgres é `json` nativo (criada assim antes do JSONText
        # existir) — Postgres recusa converter TEXT pra json nesse caminho,
        # mesmo aceitando de boa num INSERT de uma linha só.
        db.flush()


@router.get("/calendar-periods", response_model=CalendarPeriodOut)
async def get_calendar_period(
    client_id: int = Query(...),
    year: int = Query(...),
    month: int = Query(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("calendar.view")),
):
    return CalendarPeriodOut(
        client_id=client_id,
        year=year,
        month=month,
        status=get_period_status(db, client_id, year, month),
    )


@router.put("/calendar-periods", response_model=CalendarPeriodOut)
async def set_calendar_period_status(
    payload: CalendarPeriodSetStatus,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("calendar.edit")),
):
    period = (
        db.query(CalendarPeriod)
        .filter(
            CalendarPeriod.client_id == payload.client_id,
            CalendarPeriod.year == payload.year,
            CalendarPeriod.month == payload.month,
        )
        .first()
    )

    if period is None:
        period = CalendarPeriod(client_id=payload.client_id, year=payload.year, month=payload.month)
        db.add(period)

    period.status = payload.status

    if payload.status == "finalizado":
        _generate_demands_for_period(db, payload.client_id, payload.year, payload.month, current_user.id)

    db.commit()
    db.refresh(period)
    return period
