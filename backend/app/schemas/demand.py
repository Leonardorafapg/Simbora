# backend/app/schemas/demand.py
from datetime import date

from pydantic import BaseModel, field_validator

DEMAND_STATUSES = ["pendente", "em_andamento", "em_aprovacao", "reprovada", "concluida"]


def _validate_status(value: str) -> str:
    if value not in DEMAND_STATUSES:
        raise ValueError(f"Status inválido. Use um de: {', '.join(DEMAND_STATUSES)}")
    return value


def _non_empty(value: str, field_label: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError(f"{field_label} é obrigatório")
    return value


class ChecklistItem(BaseModel):
    id: str
    text: str
    done: bool = False


class DemandCreate(BaseModel):
    client_id: int | None = None
    title: str
    notes: str | None = None
    assignee_id: int | None = None
    is_art: bool = False
    status: str = "pendente"
    due_date: date | None = None
    has_material: bool = False
    checklist: list[ChecklistItem] = []

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        return _non_empty(value, "Título")

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        return _validate_status(value)


class DemandUpdate(BaseModel):
    client_id: int | None = None
    title: str | None = None
    notes: str | None = None
    assignee_id: int | None = None
    status: str | None = None
    due_date: date | None = None
    has_material: bool | None = None
    checklist: list[ChecklistItem] | None = None

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str | None) -> str | None:
        return _non_empty(value, "Título") if value is not None else None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str | None) -> str | None:
        return _validate_status(value) if value is not None else None


class DemandOut(BaseModel):
    id: int
    client_id: int | None
    calendar_entry_id: int | None
    title: str
    notes: str | None
    requester_id: int
    assignee_id: int | None
    is_art: bool
    status: str
    due_date: date | None
    has_material: bool
    checklist: list[ChecklistItem]

    model_config = {"from_attributes": True}
