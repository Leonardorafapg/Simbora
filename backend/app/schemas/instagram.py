# backend/app/schemas/instagram.py
from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, field_validator


def _attach_utc(value):
    """O banco guarda UTC sem fuso; a resposta sai com fuso explícito, senão o
    navegador leria como horário local (3h de diferença)."""
    if isinstance(value, datetime) and value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


class InstagramIntegrationStatus(BaseModel):
    configured: bool


class InstagramAccountOut(BaseModel):
    client_id: int
    # nao_conectado | ativo | expirado | revogado | desconectado
    status: str
    username: str | None = None
    profile_picture_url: str | None = None
    token_expires_at: datetime | None = None
    connected_at: datetime | None = None
    last_error: str | None = None

    _utc = field_validator("token_expires_at", "connected_at", mode="before")(_attach_utc)


class InstagramProfileOut(BaseModel):
    username: str | None = None
    name: str | None = None
    biography: str | None = None
    followers_count: int | None = None
    media_count: int | None = None
    profile_picture_url: str | None = None


class ConnectUrlOut(BaseModel):
    url: str


class InstagramPostCreate(BaseModel):
    client_id: int
    media_type: str  # IMAGE | CAROUSEL | REELS | STORIES
    media_urls: list[str]
    caption: str | None = None
    # Com fuso (ISO do navegador) ou sem (lido como horário de Brasília).
    scheduled_at: datetime | None = None
    publish_now: bool = False
    calendar_entry_id: int | None = None


class InstagramPostUpdate(BaseModel):
    media_type: str | None = None
    media_urls: list[str] | None = None
    caption: str | None = None
    scheduled_at: datetime | None = None


class InstagramPostOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    client_id: int
    calendar_entry_id: int | None
    media_type: str
    media_urls: list[str]
    caption: str | None
    scheduled_at: datetime
    status: str
    attempts: int
    next_attempt_at: datetime | None
    error_message: str | None
    ig_media_id: str | None
    permalink: str | None
    published_at: datetime | None
    created_by: int | None
    created_at: datetime

    _utc = field_validator("scheduled_at", "next_attempt_at", "published_at", "created_at", mode="before")(_attach_utc)


class InsightsOut(BaseModel):
    metrics: dict[str, int]
    # Contas únicas (alcance, contas engajadas) somadas por janela de 30 dias:
    # a mesma pessoa pode ter sido contada mais de uma vez.
    approximate: list[str] = []


class PostInsightsItemOut(BaseModel):
    id: str
    caption: str | None
    media_type: str
    thumbnail_url: str | None
    permalink: str | None
    posted_at: datetime
    metrics: dict[str, int]
    insights_available: bool


class PostsInsightsOut(BaseModel):
    posts: list[PostInsightsItemOut]
    totals: dict[str, int]
    by_type: dict[str, int]
    total_posts: int
    truncated: bool
