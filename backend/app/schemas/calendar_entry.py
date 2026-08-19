# backend/app/schemas/calendar_entry.py
from datetime import date

from pydantic import BaseModel, field_validator

CALENDAR_STATUSES = ["nao_iniciado", "feito", "aprovado", "reprovado", "concluido"]


def _validate_status(value: str) -> str:
    if value not in CALENDAR_STATUSES:
        raise ValueError(f"Status inválido. Use um de: {', '.join(CALENDAR_STATUSES)}")
    return value


def _non_empty(value: str, field_label: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError(f"{field_label} é obrigatório")
    return value


class CalendarEntryCreate(BaseModel):
    client_id: int
    scheduled_date: date
    theme: str
    execution_notes: str
    # "Formato" saiu da UI — Execução assumiu esse lugar. Campo mantido no
    # banco (não é mais preenchido nem exibido) para não exigir migração
    # destrutiva; sempre recebe string vazia por baixo dos panos.
    format: str = ""
    reference_link: str | None = None
    reference_image: str | None = None
    material_files: list[str] = []
    caption: str | None = None
    material_notes: str | None = None
    status: str = "nao_iniciado"

    @field_validator("theme")
    @classmethod
    def validate_theme(cls, value: str) -> str:
        return _non_empty(value, "Descrição")

    @field_validator("execution_notes")
    @classmethod
    def validate_execution_notes(cls, value: str) -> str:
        return _non_empty(value, "Execução")

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        return _validate_status(value)


class CalendarEntryUpdate(BaseModel):
    client_id: int | None = None
    scheduled_date: date | None = None
    theme: str | None = None
    execution_notes: str | None = None
    reference_link: str | None = None
    reference_image: str | None = None
    material_files: list[str] | None = None
    caption: str | None = None
    material_notes: str | None = None
    status: str | None = None

    @field_validator("theme")
    @classmethod
    def validate_theme(cls, value: str | None) -> str | None:
        return _non_empty(value, "Descrição") if value is not None else None

    @field_validator("execution_notes")
    @classmethod
    def validate_execution_notes(cls, value: str | None) -> str | None:
        return _non_empty(value, "Execução") if value is not None else None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str | None) -> str | None:
        return _validate_status(value) if value is not None else None


class CalendarEntryOut(BaseModel):
    id: int
    client_id: int
    scheduled_date: date
    theme: str
    execution_notes: str | None
    reference_link: str | None
    reference_image: str | None
    material_files: list[str]
    final_image: str | None
    caption: str | None
    material_notes: str | None
    status: str
    created_by: int

    model_config = {"from_attributes": True}


class DeliverableUpdate(BaseModel):
    """
    Só a arte finalizada + legenda — o que o designer entrega via o drawer
    da demanda. Schema separado de CalendarEntryUpdate de propósito: quem
    tem `demand.edit` não necessariamente tem `calendar.edit` (não deve
    poder mexer em data/tema/cliente do planejamento, só entregar o
    resultado).
    """

    final_image: str | None = None
    caption: str | None = None
