# backend/app/schemas/calendar_period.py
from pydantic import BaseModel, field_validator

CALENDAR_PERIOD_STATUSES = [
    "em_andamento",
    "finalizado",
    "reprovado",
    # Cadeia de aprovação (ver docs/plano-aprovacao-calendario.md)
    "enviado_aprovacao_amanda",
    "enviado_aprovacao_cliente",
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
    # PDF gerado no frontend (jsPDF) e já subido pro R2 antes dessa chamada —
    # reaproveitado em todas as etapas dessa rodada de aprovação.
    pdf_url: str

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

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, value: str | None, info) -> str | None:
        if info.data.get("decision") == "reprovado" and not value:
            raise ValueError("Motivo é obrigatório ao reprovar")
        return value


class CalendarPeriodDecisaoCliente(BaseModel):
    decision: str  # "aprovado" | "reprovado"
    reason: str | None = None

    @field_validator("decision")
    @classmethod
    def validate_decision(cls, value: str) -> str:
        if value not in ("aprovado", "reprovado"):
            raise ValueError("decision deve ser 'aprovado' ou 'reprovado'")
        return value

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, value: str | None, info) -> str | None:
        if info.data.get("decision") == "reprovado" and not value:
            raise ValueError("Motivo é obrigatório ao reprovar")
        return value


class CalendarApprovalPublicOut(BaseModel):
    """O que a página pública de aprovação (sem login, acessada pelo link do WhatsApp) recebe."""

    client_id: int
    client_name: str
    year: int
    month: int
    status: str
    pdf_url: str | None

    model_config = {"from_attributes": True}


class CalendarPeriodPendingOut(BaseModel):
    """Um item da caixa de entrada de aprovações (tela central — ver routers/calendar_periods.py)."""

    client_id: int
    client_name: str
    year: int
    month: int
    status: str
    pdf_url: str | None
    updated_at: str
