# backend/app/schemas/calendar_period.py
from pydantic import BaseModel, field_validator

CALENDAR_PERIOD_STATUSES = ["em_andamento", "finalizado", "reprovado"]


class CalendarPeriodOut(BaseModel):
    client_id: int
    year: int
    month: int
    status: str

    model_config = {"from_attributes": True}


class CalendarPeriodSetStatus(BaseModel):
    client_id: int
    year: int
    month: int
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        if value not in CALENDAR_PERIOD_STATUSES:
            raise ValueError(f"Status inválido. Use um de: {', '.join(CALENDAR_PERIOD_STATUSES)}")
        return value

    @field_validator("month")
    @classmethod
    def validate_month(cls, value: int) -> int:
        if not 1 <= value <= 12:
            raise ValueError("Mês inválido")
        return value
