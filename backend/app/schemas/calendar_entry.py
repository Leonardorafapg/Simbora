# backend/app/schemas/calendar_entry.py
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.schemas.tag import TagOut
from app.services.calendar_media import MAX_CAROUSEL_SLIDES

# Quadros do fluxo de produção, na ordem do kanban.
CALENDAR_STATUSES = ["producao", "andamento", "modificacoes", "checagem_aprovacao", "finalizados", "publicados"]


# Status em que a postagem já foi entregue pela produção (em aprovação,
# reprovada/em modificações, aprovada ("finalizados" no banco) ou publicada) — contam como "entregue" no controle de prazo.
DELIVERED_STATUSES = {"checagem_aprovacao", "modificacoes", "finalizados", "publicados"}


def _validate_status(value: str) -> str:
    if value not in CALENDAR_STATUSES:
        raise ValueError(f"Status inválido. Use um de: {', '.join(CALENDAR_STATUSES)}")
    return value


def _non_empty(value: str, field_label: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError(f"{field_label} é obrigatório")
    return value


def _clean_title(value: str | None) -> str | None:
    value = value.strip() if value is not None else None
    return value or None


class CalendarEntryCreate(BaseModel):
    client_id: int
    scheduled_date: date
    # Sobrepõe a regra automática de prazo — ver comentário no model.
    custom_deadline: date | None = None
    title: str | None = None
    theme: str
    # Campo "Execução" saiu da UI/relatório; mantido opcional por compatibilidade.
    execution_notes: str = ""
    # "Formato" saiu da UI — Execução assumiu esse lugar. Campo mantido no
    # banco (não é mais preenchido nem exibido) para não exigir migração
    # destrutiva; sempre recebe string vazia por baixo dos panos.
    format: str = ""
    reference_link: str | None = None
    reference_image: str | None = None
    material_files: list[str] = []
    final_image: str | None = None
    final_image_story: str | None = None
    post_type: Literal["feed", "carousel"] = "feed"
    final_images: list[str] = Field(default_factory=list, max_length=MAX_CAROUSEL_SLIDES)
    caption: str | None = None
    material_notes: str | None = None
    status: str = "producao"
    # Vazios = padrão do cliente (social / designer), aplicado no router.
    requester_id: int | None = None
    assignee_id: int | None = None
    tag_ids: list[int] = []

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str | None) -> str | None:
        return _clean_title(value)

    @field_validator("theme")
    @classmethod
    def validate_theme(cls, value: str) -> str:
        return _non_empty(value, "Descrição")

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        return _validate_status(value)


class CalendarEntryUpdate(BaseModel):
    client_id: int | None = None
    scheduled_date: date | None = None
    custom_deadline: date | None = None
    title: str | None = None
    theme: str | None = None
    execution_notes: str | None = None
    reference_link: str | None = None
    reference_image: str | None = None
    material_files: list[str] | None = None
    final_image: str | None = None
    final_image_story: str | None = None
    post_type: Literal["feed", "carousel"] | None = None
    final_images: list[str] | None = Field(default=None, max_length=MAX_CAROUSEL_SLIDES)
    caption: str | None = None
    material_notes: str | None = None
    status: str | None = None
    requester_id: int | None = None
    assignee_id: int | None = None
    tag_ids: list[int] | None = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str | None) -> str | None:
        return _clean_title(value)

    @field_validator("theme")
    @classmethod
    def validate_theme(cls, value: str | None) -> str | None:
        return _non_empty(value, "Descrição") if value is not None else None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str | None) -> str | None:
        return _validate_status(value) if value is not None else None


class CalendarEntryOut(BaseModel):
    id: int
    client_id: int
    scheduled_date: date
    custom_deadline: date | None
    from_production: bool
    title: str | None
    theme: str
    execution_notes: str | None
    reference_link: str | None
    reference_image: str | None
    material_files: list[str]
    final_image: str | None
    final_image_story: str | None
    post_type: str
    final_images: list[str]
    caption: str | None
    material_notes: str | None
    status: str
    requester_id: int | None
    assignee_id: int | None
    tags: list[TagOut] = []
    delivered_at: datetime | None = None
    created_by: int

    model_config = {"from_attributes": True}


class CalendarEntryBulkCreate(BaseModel):
    entries: list[CalendarEntryCreate]
    dry_run: bool = False

    @field_validator("entries")
    @classmethod
    def validate_entries(cls, value: list[CalendarEntryCreate]) -> list[CalendarEntryCreate]:
        if not value:
            raise ValueError("Envie ao menos uma postagem")
        if len(value) > 200:
            raise ValueError("Máximo de 200 postagens por chamada")
        return value


class CalendarEntryBulkResult(BaseModel):
    dry_run: bool
    count: int
    entries: list[CalendarEntryOut]

