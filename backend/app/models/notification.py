# backend/app/models/notification.py
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.timeutil import utcnow


class Notification(Base):
    """Aviso pra uma pessoa (central de avisos do CRM e, depois, push no celular)."""

    __tablename__ = "notifications"
    __table_args__ = (
        # Mesmo aviso (ex.: "lembrete de 30 min do compromisso 7") nunca é criado duas vezes pro mesmo usuário.
        UniqueConstraint("user_id", "dedupe_key", name="uq_notification_user_dedupe"),
        Index("ix_notifications_user_unread", "user_id", "read_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    # agenda_convite | agenda_alterada | agenda_cancelada | ... (cada gatilho define o seu)
    type: Mapped[str] = mapped_column(String(40), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Rota do CRM que abre ao clicar (ex.: "/agenda?evento=7").
    link: Mapped[str | None] = mapped_column(String(300), nullable=True)
    dedupe_key: Mapped[str | None] = mapped_column(String(120), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    read_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
