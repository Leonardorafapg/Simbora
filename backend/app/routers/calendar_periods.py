# backend/app/routers/calendar_periods.py
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_permission
from app.models.calendar_period import CalendarPeriod
from app.models.user import User
from app.schemas.calendar_period import CalendarPeriodOut, CalendarPeriodSetStatus

router = APIRouter()


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
    _: User = Depends(require_permission("calendar.edit")),
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

    db.commit()
    db.refresh(period)
    return period
