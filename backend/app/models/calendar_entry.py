# backend/app/models/calendar_entry.py
from datetime import date as date_type, datetime, timezone
from sqlalchemy import String, Integer, Date, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class CalendarEntry(Base):
    __tablename__ = "calendar_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), nullable=False, index=True)
    scheduled_date: Mapped[date_type] = mapped_column(Date, nullable=False, index=True)
    theme: Mapped[str] = mapped_column(Text, nullable=False)
    format: Mapped[str] = mapped_column(String(30), nullable=False)
    execution_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    reference_link: Mapped[str | None] = mapped_column(String(500), nullable=True)
    caption: Mapped[str | None] = mapped_column(Text, nullable=True)
    # planejado / aguardando_legenda / agendado / publicado — ver schemas/calendar_entry.py
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="planejado")
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
