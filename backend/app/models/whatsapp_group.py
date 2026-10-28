# backend/app/models/whatsapp_group.py
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.timeutil import utcnow


class WhatsAppGroup(Base):
    """Nome (assunto) dos grupos do WhatsApp. A consulta à Evolution é lenta e falha com frequência, e o cache
    em memória sumia a cada deploy — por isso o que já foi descoberto fica salvo aqui."""

    __tablename__ = "whatsapp_groups"

    jid: Mapped[str] = mapped_column(String(100), primary_key=True)
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)
