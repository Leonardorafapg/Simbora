# backend/app/routers/calendar.py
from datetime import date
from calendar import monthrange

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_permission
from app.models.calendar_entry import CalendarEntry
from app.models.client import Client
from app.models.demand import Demand
from app.models.user import User
from app.routers.calendar_periods import get_period_status
from app.schemas.calendar_entry import CalendarEntryCreate, CalendarEntryOut, CalendarEntryUpdate

router = APIRouter()


def _ensure_period_editable(db: Session, client_id: int, entry_date: date) -> None:
    period_status = get_period_status(db, client_id, entry_date.year, entry_date.month)
    if period_status == "finalizado":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Esse cronograma já foi finalizado — reprove antes de editar.",
        )


@router.get("/calendar-entries", response_model=list[CalendarEntryOut])
async def list_calendar_entries(
    client_id: int | None = Query(default=None),
    month: str | None = Query(default=None, description="YYYY-MM"),
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("calendar.view")),
):
    query = db.query(CalendarEntry)

    if client_id is not None:
        query = query.filter(CalendarEntry.client_id == client_id)

    if month is not None:
        try:
            year_str, month_str = month.split("-")
            year, month_num = int(year_str), int(month_str)
        except (ValueError, AttributeError):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Parâmetro month inválido (use YYYY-MM)")

        start = date(year, month_num, 1)
        end = date(year, month_num, monthrange(year, month_num)[1])
        query = query.filter(CalendarEntry.scheduled_date >= start, CalendarEntry.scheduled_date <= end)

    return query.order_by(CalendarEntry.scheduled_date).all()


@router.post("/calendar-entries", response_model=CalendarEntryOut, status_code=201)
async def create_calendar_entry(
    payload: CalendarEntryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("calendar.create")),
):
    if db.get(Client, payload.client_id) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cliente inválido")

    _ensure_period_editable(db, payload.client_id, payload.scheduled_date)

    entry = CalendarEntry(**payload.model_dump(), created_by=current_user.id)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.patch("/calendar-entries/{entry_id}", response_model=CalendarEntryOut)
async def update_calendar_entry(
    entry_id: int,
    payload: CalendarEntryUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("calendar.edit")),
):
    entry = db.get(CalendarEntry, entry_id)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entrada não encontrada")

    _ensure_period_editable(db, entry.client_id, entry.scheduled_date)

    data = payload.model_dump(exclude_unset=True)

    if "client_id" in data and db.get(Client, data["client_id"]) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cliente inválido")

    for field, value in data.items():
        setattr(entry, field, value)

    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/calendar-entries/{entry_id}", status_code=204)
async def delete_calendar_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("calendar.delete")),
):
    entry = db.get(CalendarEntry, entry_id)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entrada não encontrada")

    _ensure_period_editable(db, entry.client_id, entry.scheduled_date)

    # A demanda gerada a partir dessa postagem (se existir) sobrevive à
    # exclusão do planejamento — só perde o vínculo. Sem isso, apagar a
    # entrada quebra a FK e derruba a request com 500 (IntegrityError).
    db.query(Demand).filter(Demand.calendar_entry_id == entry_id).update({"calendar_entry_id": None})

    db.delete(entry)
    db.commit()
