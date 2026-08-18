# backend/app/schemas/search.py
from pydantic import BaseModel


class SearchResult(BaseModel):
    type: str  # "client" | "calendar_entry" | "user"
    id: int
    title: str
    subtitle: str | None = None
    # Para "calendar_entry": id do cliente dono, usado pro front abrir o
    # cliente certo (entradas de calendário não têm página própria).
    client_id: int | None = None


class SearchResponse(BaseModel):
    results: list[SearchResult]
