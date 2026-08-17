# backend/app/routers/calendar.py
from datetime import date
from calendar import monthrange

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_permission
from app.models.calendar_entry import CalendarEntry
from app.models.client import Client
from app.models.user import User
from app.schemas.calendar_entry import CalendarEntryCreate, CalendarEntryOut, CalendarEntryUpdate

router = APIRouter()


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

    db.delete(entry)
    db.commit()
