# backend/app/schemas/agenda.py
from datetime import datetime

from pydantic import BaseModel, Field, field_serializer, field_validator, model_validator

from app.core.timeutil import as_utc, to_utc_naive

MAX_PARTICIPANTS = 50


class AgendaParticipantOut(BaseModel):
    id: int
    full_name: str
    photo_url: str | None = None

    model_config = {"from_attributes": True}


class _AgendaBase(BaseModel):
    title: str
    description: str | None = None
    starts_at: datetime
    ends_at: datetime
    participant_ids: list[int] = Field(default_factory=list, max_length=MAX_PARTICIPANTS)

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Dê um título ao compromisso.")
        return value[:200]

    @field_validator("description")
    @classmethod
    def clean_description(cls, value: str | None) -> str | None:
        return (value or "").strip() or None

    @field_validator("starts_at", "ends_at")
    @classmethod
    def to_utc(cls, value: datetime) -> datetime:
        return to_utc_naive(value)


class AgendaEventCreate(_AgendaBase):
    @model_validator(mode="after")
    def ends_after_start(self):
        if self.ends_at <= self.starts_at:
            raise ValueError("O fim precisa ser depois do início.")
        return self


class AgendaEventUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None
    participant_ids: list[int] | None = Field(default=None, max_length=MAX_PARTICIPANTS)

    @field_validator("title")
    @classmethod
    def clean_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _AgendaBase.clean_title(value)

    @field_validator("starts_at", "ends_at")
    @classmethod
    def to_utc(cls, value: datetime | None) -> datetime | None:
        return None if value is None else to_utc_naive(value)


class AgendaEventOut(BaseModel):
    id: int
    title: str
    description: str | None
    starts_at: datetime
    ends_at: datetime
    created_by: int
    participants: list[AgendaParticipantOut]

    model_config = {"from_attributes": True}

    @field_serializer("starts_at", "ends_at")
    def serialize_dt(self, value: datetime) -> datetime:
        return as_utc(value)
