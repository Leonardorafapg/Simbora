# backend/app/routers/search.py
from fastapi import APIRouter, Depends, Query
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.permissions import has_permission
from app.models.calendar_entry import CalendarEntry
from app.models.client import Client
from app.models.user import User
from app.schemas.search import SearchResponse, SearchResult

# Limite por tipo de entidade — a busca é pra achar rápido "aquele item", não
# listar tudo. Se precisar rolar mais resultados, o usuário refina o termo.
RESULTS_PER_TYPE = 5

router = APIRouter()


@router.get("/search", response_model=SearchResponse)
async def global_search(
    q: str = Query(..., min_length=2, max_length=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    term = f"%{q.strip()}%"
    results: list[SearchResult] = []

    if has_permission(current_user, "client.view"):
        clients = (
            db.query(Client)
            .filter(
                or_(
                    Client.name.ilike(term),
                    Client.contact_name.ilike(term),
                    Client.email.ilike(term),
                    Client.phone.ilike(term),
                    Client.instagram.ilike(term),
                )
            )
            .order_by(Client.name)
            .limit(RESULTS_PER_TYPE)
            .all()
        )
        results += [
            SearchResult(
                type="client",
                id=client.id,
                title=client.name,
                subtitle=client.contact_name or client.email,
            )
            for client in clients
        ]

    if has_permission(current_user, "calendar.view"):
        entries = (
            db.query(CalendarEntry)
            .filter(
                or_(
                    CalendarEntry.theme.ilike(term),
                    CalendarEntry.caption.ilike(term),
                    CalendarEntry.execution_notes.ilike(term),
                )
            )
            .order_by(CalendarEntry.scheduled_date.desc())
            .limit(RESULTS_PER_TYPE)
            .all()
        )
        client_names = {
            client.id: client.name
            for client in db.query(Client).filter(Client.id.in_([e.client_id for e in entries])).all()
        }
        results += [
            SearchResult(
                type="calendar_entry",
                id=entry.id,
                title=entry.theme,
                subtitle=f"{client_names.get(entry.client_id, 'Cliente')} · {entry.scheduled_date.isoformat()}",
                client_id=entry.client_id,
            )
            for entry in entries
        ]

    if has_permission(current_user, "team.view"):
        users = (
            db.query(User)
            .filter(
                or_(
                    User.full_name.ilike(term),
                    User.email.ilike(term),
                    User.cargo.ilike(term),
                )
            )
            .order_by(User.full_name)
            .limit(RESULTS_PER_TYPE)
            .all()
        )
        results += [
            SearchResult(type="user", id=user.id, title=user.full_name, subtitle=user.cargo)
            for user in users
        ]

    return SearchResponse(results=results)
