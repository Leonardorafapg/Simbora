# backend/app/models/calendar_approval.py
"""
Histórico de decisões de aprovação de um CalendarPeriod. Tabela separada (e
não um campo em CalendarPeriod) porque um período pode ser reprovado e
reenviado várias vezes — precisa do histórico completo (quem, quando, por
quê), não só a última decisão.
"""
from datetime import datetime, timezone

from sqlalchemy import String, Integer, ForeignKey, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class CalendarApproval(Base):
    __tablename__ = "calendar_approvals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    period_id: Mapped[int] = mapped_column(ForeignKey("calendar_periods.id"), nullable=False, index=True)
    # "amanda" | "cliente"
    stage: Mapped[str] = mapped_column(String(20), nullable=False)
    # "aprovado" | "reprovado"
    decision: Mapped[str] = mapped_column(String(20), nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Nulo quando quem decidiu foi o cliente (aprova por link, sem conta no sistema).
    decided_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    decided_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
