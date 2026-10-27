# backend/app/schemas/calendar_period.py
from pydantic import BaseModel, field_validator, model_validator

CALENDAR_PERIOD_STATUSES = [
    "em_andamento",
    "finalizado",
    "reprovado",
    # Aprovação da Amanda (ver docs/plano-aprovacao-calendario.md)
    "enviado_aprovacao_amanda",
]


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


class CalendarPeriodEnviarAprovacao(BaseModel):
    client_id: int
    year: int
    month: int
    # Legado: o envio já foi com um PDF do cronograma. Hoje a Amanda revisa direto no CRM e
    # o front não manda mais — o campo só continua aceito pra não quebrar telas em cache.
    pdf_url: str | None = None

    @field_validator("month")
    @classmethod
    def validate_month(cls, value: int) -> int:
        if not 1 <= value <= 12:
            raise ValueError("Mês inválido")
        return value


class CalendarPeriodDecisaoAmanda(BaseModel):
    client_id: int
    year: int
    month: int
    decision: str  # "aprovado" | "reprovado"
    reason: str | None = None

    @field_validator("month")
    @classmethod
    def validate_month(cls, value: int) -> int:
        if not 1 <= value <= 12:
            raise ValueError("Mês inválido")
        return value

    @field_validator("decision")
    @classmethod
    def validate_decision(cls, value: str) -> str:
        if value not in ("aprovado", "reprovado"):
            raise ValueError("decision deve ser 'aprovado' ou 'reprovado'")
        return value

    @model_validator(mode="after")
    def reason_required_when_rejecting(self):
        # Validador de modelo (não de campo): o de campo não roda quando `reason` é omitido.
        if self.decision == "reprovado" and not (self.reason or "").strip():
            raise ValueError("Motivo é obrigatório ao reprovar")
        return self


class CalendarPeriodPendingOut(BaseModel):
    """Um item da caixa de entrada de aprovações (tela central — ver routers/calendar_periods.py)."""

    client_id: int
    client_name: str
    year: int
    month: int
    status: str
    pdf_url: str | None
    updated_at: str
