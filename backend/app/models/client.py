# backend/app/models/client.py
from datetime import datetime, timezone
from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class Client(Base):
    __tablename__ = "clients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    contact_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(30), nullable=True)
    whatsapp_group_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    instagram: Mapped[str | None] = mapped_column(String(150), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Preenchidos opcionalmente no cadastro; servem de sugestão inicial para
    # quem monta o calendário — não travam nada daqui pra frente.
    default_social_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    default_designer_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
