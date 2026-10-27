# backend/app/routers/agenda.py
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.timeutil import to_utc_naive
from app.models.agenda import AgendaEvent, agenda_event_participants
from app.models.user import User
from app.schemas.agenda import AgendaEventCreate, AgendaEventOut, AgendaEventUpdate
from app.services import agenda as agenda_service
from app.services import notifications

router = APIRouter()

# Janela máxima de uma consulta — a tela pede um mês por vez.
MAX_RANGE = timedelta(days=100)


def _load_participants(db: Session, ids: list[int], creator: User) -> list[User]:
    """Convidados (só usuários ativos) + quem criou, que sempre participa do próprio compromisso."""
    wanted = list(dict.fromkeys([creator.id, *ids]))
    users = db.query(User).filter(User.id.in_(wanted), User.is_active.is_(True)).all()
    if len(users) != len(wanted):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Participante inválido.")
    by_id = {u.id: u for u in users}
    return [by_id[i] for i in wanted]


def _visible_event(db: Session, event_id: int, user: User) -> AgendaEvent:
    """Compromisso que a pessoa participa; senão 404 (não revela que existe)."""
    event = db.get(AgendaEvent, event_id)
    if event is None or user.id not in {p.id for p in event.participants}:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Compromisso não encontrado.")
    return event


def _owned_event(db: Session, event_id: int, user: User) -> AgendaEvent:
    event = _visible_event(db, event_id, user)
    if event.created_by != user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Só quem marcou o compromisso pode alterá-lo.")
    return event


@router.get("/agenda/events", response_model=list[AgendaEventOut])
async def list_events(
    start: datetime = Query(description="Início da janela (ISO 8601)"),
    end: datetime = Query(description="Fim da janela (ISO 8601)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    start_utc, end_utc = to_utc_naive(start), to_utc_naive(end)
    if end_utc <= start_utc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A janela precisa ter fim depois do início.")
    if end_utc - start_utc > MAX_RANGE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Janela grande demais (máximo 100 dias).")

    return (
        db.query(AgendaEvent)
        .join(agenda_event_participants, agenda_event_participants.c.event_id == AgendaEvent.id)
        .filter(
            agenda_event_participants.c.user_id == current_user.id,
            AgendaEvent.starts_at < end_utc,
            AgendaEvent.ends_at > start_utc,
        )
        .order_by(AgendaEvent.starts_at, AgendaEvent.id)
        .all()
    )


@router.get("/agenda/events/{event_id}", response_model=AgendaEventOut)
async def get_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _visible_event(db, event_id, current_user)


@router.post("/agenda/events", response_model=AgendaEventOut, status_code=201)
async def create_event(
    payload: AgendaEventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    event = AgendaEvent(
        title=payload.title,
        description=payload.description,
        starts_at=payload.starts_at,
        ends_at=payload.ends_at,
        created_by=current_user.id,
    )
    event.participants = _load_participants(db, payload.participant_ids, current_user)
    db.add(event)
    db.flush()
    created = agenda_service.notify_created(db, event, current_user.full_name, current_user.id)
    db.commit()
    db.refresh(event)
    await notifications.publish(created)
    return event


@router.patch("/agenda/events/{event_id}", response_model=AgendaEventOut)
async def update_event(
    event_id: int,
    payload: AgendaEventUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    event = _owned_event(db, event_id, current_user)
    before = agenda_service.EventSnapshot.of(event)
    data = payload.model_dump(exclude_unset=True)

    if data.get("title") is None:
        data.pop("title", None)
    for key in ("starts_at", "ends_at"):
        if data.get(key) is None:
            data.pop(key, None)
    participant_ids = data.pop("participant_ids", None)
    if participant_ids is not None:
        event.participants = _load_participants(db, participant_ids, current_user)
    for field, value in data.items():
        setattr(event, field, value)
    if event.ends_at <= event.starts_at:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="O fim precisa ser depois do início.")

    db.flush()
    db.refresh(event)
    created = agenda_service.notify_updated(
        db, before, agenda_service.EventSnapshot.of(event), current_user.full_name, current_user.id
    )
    db.commit()
    db.refresh(event)
    await notifications.publish(created)
    return event


@router.delete("/agenda/events/{event_id}", status_code=204)
async def delete_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    event = _owned_event(db, event_id, current_user)
    created = agenda_service.notify_deleted(
        db, agenda_service.EventSnapshot.of(event), current_user.full_name, current_user.id
    )
    db.delete(event)
    db.commit()
    await notifications.publish(created)
