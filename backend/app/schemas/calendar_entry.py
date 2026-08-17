# backend/app/schemas/calendar_entry.py
from datetime import date

from pydantic import BaseModel, field_validator

CALENDAR_FORMATS = ["Reels", "Carrossel", "Post estático", "Story", "Vídeo"]
CALENDAR_STATUSES = ["planejado", "aguardando_legenda", "agendado", "publicado"]


def _validate_format(value: str) -> str:
    if value not in CALENDAR_FORMATS:
        raise ValueError(f"Formato inválido. Use um de: {', '.join(CALENDAR_FORMATS)}")
    return value


def _validate_status(value: str) -> str:
    if value not in CALENDAR_STATUSES:
        raise ValueError(f"Status inválido. Use um de: {', '.join(CALENDAR_STATUSES)}")
    return value


class CalendarEntryCreate(BaseModel):
    client_id: int
    scheduled_date: date
    theme: str
    format: str
    execution_notes: str | None = None
    reference_link: str | None = None
    caption: str | None = None
    status: str = "planejado"

    @field_validator("theme")
    @classmethod
    def validate_theme(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Tema é obrigatório")
        return value

    @field_validator("format")
    @classmethod
    def validate_format(cls, value: str) -> str:
        return _validate_format(value)

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        return _validate_status(value)


class CalendarEntryUpdate(BaseModel):
    client_id: int | None = None
    scheduled_date: date | None = None
    theme: str | None = None
    format: str | None = None
    execution_notes: str | None = None
    reference_link: str | None = None
    caption: str | None = None
    status: str | None = None

    @field_validator("theme")
    @classmethod
    def validate_theme(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Tema é obrigatório")
        return value

    @field_validator("format")
    @classmethod
    def validate_format(cls, value: str | None) -> str | None:
        return _validate_format(value) if value is not None else None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str | None) -> str | None:
        return _validate_status(value) if value is not None else None


class CalendarEntryOut(BaseModel):
    id: int
    client_id: int
    scheduled_date: date
    theme: str
    format: str
    execution_notes: str | None
    reference_link: str | None
    caption: str | None
    status: str
    created_by: int

    model_config = {"from_attributes": True}
