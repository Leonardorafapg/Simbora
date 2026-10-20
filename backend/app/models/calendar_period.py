# backend/app/models/calendar_period.py
from datetime import datetime, timezone
from sqlalchemy import String, Integer, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class CalendarPeriod(Base):
    """
    Estado do cronograma de um cliente num mês inteiro — não é por postagem.
    Enquanto "finalizado", nenhuma entrada desse cliente/mês pode ser
    criada/editada/removida (ver routers/calendar.py). "reprovado" e
    "em_andamento" são os dois estados em que dá pra mexer.

    Cadeia de aprovação (ver docs/plano-aprovacao-calendario.md):
    em_andamento -> enviado_aprovacao_amanda -> aprovado_amanda ->
    enviado_aprovacao_cliente -> finalizado. Reprovação em qualquer etapa
    volta pra em_andamento (histórico de quem/quando/motivo fica em
    CalendarApproval, não aqui).
    """

    __tablename__ = "calendar_periods"
    __table_args__ = (UniqueConstraint("client_id", "year", "month", name="uq_calendar_period_client_month"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), nullable=False, index=True)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="em_andamento")
    # PDF do calendário gerado no momento em que foi enviado pra aprovação —
    # é o mesmo arquivo reaproveitado em cada etapa (Amanda e cliente), pra
    # não gerar PDFs diferentes no meio do fluxo de uma mesma rodada.
    pdf_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
