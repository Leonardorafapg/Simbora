# backend/app/routers/demands.py
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_permission
from app.models.calendar_entry import CalendarEntry
from app.models.client import Client
from app.models.demand import Demand
from app.models.user import User
from app.schemas.calendar_entry import CalendarEntryOut, DeliverableUpdate
from app.schemas.demand import DemandCreate, DemandOut, DemandUpdate

router = APIRouter()

ART_ONLY_STATUSES = {"em_aprovacao", "reprovada"}


def _ensure_status_matches_kind(is_art: bool, new_status: str | None) -> None:
    """
    "Em aprovação"/"Reprovada" só existem pro fluxo de arte — sem essa
    checagem, uma demanda genérica podia acabar com um status que a UI
    (dialog, kanban) nem sabe desenhar, porque filtra essas duas opções
    quando `is_art` é falso.
    """
    if new_status in ART_ONLY_STATUSES and not is_art:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Esse status só se aplica a demandas de arte.",
        )


@router.get("/demands", response_model=list[DemandOut])
async def list_demands(
    client_id: int | None = Query(default=None),
    assignee_id: int | None = Query(default=None),
    unassigned: bool = Query(default=False),
    status_filter: str | None = Query(default=None, alias="status"),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("demand.view")),
):
    query = db.query(Demand)

    if client_id is not None:
        query = query.filter(Demand.client_id == client_id)
    if unassigned:
        query = query.filter(Demand.assignee_id.is_(None))
    elif assignee_id is not None:
        query = query.filter(Demand.assignee_id == assignee_id)
    if status_filter is not None:
        query = query.filter(Demand.status == status_filter)
    if date_from is not None:
        query = query.filter(Demand.due_date >= date_from)
    if date_to is not None:
        query = query.filter(Demand.due_date <= date_to)

    return query.order_by(Demand.due_date.is_(None), Demand.due_date).all()


@router.post("/demands", response_model=DemandOut, status_code=201)
async def create_demand(
    payload: DemandCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("demand.create")),
):
    if payload.client_id is not None and db.get(Client, payload.client_id) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cliente inválido")
    if payload.assignee_id is not None and db.get(User, payload.assignee_id) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Responsável inválido")
    _ensure_status_matches_kind(payload.is_art, payload.status)

    demand = Demand(**payload.model_dump(), requester_id=current_user.id)
    db.add(demand)
    db.commit()
    db.refresh(demand)
    return demand


@router.patch("/demands/{demand_id}", response_model=DemandOut)
async def update_demand(
    demand_id: int,
    payload: DemandUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("demand.edit")),
):
    demand = db.get(Demand, demand_id)
    if demand is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Demanda não encontrada")

    data = payload.model_dump(exclude_unset=True)

    if "client_id" in data and data["client_id"] is not None and db.get(Client, data["client_id"]) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cliente inválido")
    if "assignee_id" in data and data["assignee_id"] is not None and db.get(User, data["assignee_id"]) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Responsável inválido")
    if "status" in data:
        _ensure_status_matches_kind(demand.is_art, data["status"])

    for field, value in data.items():
        setattr(demand, field, value)

    db.commit()
    db.refresh(demand)
    return demand


def _get_linked_calendar_entry(db: Session, demand_id: int) -> tuple[Demand, CalendarEntry]:
    demand = db.get(Demand, demand_id)
    if demand is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Demanda não encontrada")
    if demand.calendar_entry_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Essa demanda não nasceu de uma postagem do calendário",
        )

    entry = db.get(CalendarEntry, demand.calendar_entry_id)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Postagem vinculada não encontrada")

    return demand, entry


@router.get("/demands/{demand_id}/calendar-entry", response_model=CalendarEntryOut)
async def get_demand_calendar_entry(
    demand_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("demand.view")),
):
    """
    Referência + material que o social subiu ao planejar a postagem — pro
    designer usar como anexo ao trabalhar a demanda. Gate é `demand.view`,
    não `calendar.view`: quem pode ver a demanda tem que poder ver o que
    precisa pra executá-la, mesmo sem acesso geral ao calendário.
    """
    _, entry = _get_linked_calendar_entry(db, demand_id)
    return entry


@router.patch("/demands/{demand_id}/deliverable", response_model=CalendarEntryOut)
async def update_demand_deliverable(
    demand_id: int,
    payload: DeliverableUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("demand.edit")),
):
    """Arte final + legenda que o designer entrega — grava na postagem vinculada."""
    _, entry = _get_linked_calendar_entry(db, demand_id)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(entry, field, value)

    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/demands/{demand_id}", status_code=204)
async def delete_demand(
    demand_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("demand.delete")),
):
    demand = db.get(Demand, demand_id)
    if demand is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Demanda não encontrada")

    db.delete(demand)
    db.commit()
