# backend/app/models/agenda.py
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Table, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.timeutil import utcnow
from app.models.user import User

agenda_event_participants = Table(
    "agenda_event_participants",
    Base.metadata,
    Column("event_id", Integer, ForeignKey("agenda_events.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)


class AgendaEvent(Base):
    """Compromisso da agenda da equipe: visível pra quem criou e pra quem foi marcado (quem cria só participa se se marcar)."""

    __tablename__ = "agenda_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # UTC sem fuso (ver core/timeutil.py).
    starts_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    ends_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    participants: Mapped[list[User]] = relationship(secondary=agenda_event_participants, lazy="selectin")
    creator: Mapped[User] = relationship(foreign_keys=[created_by], lazy="selectin")

    @property
    def created_by_name(self) -> str | None:
        """Quem marcou — o criador não aparece na lista de participantes (só se se marcar)."""
        return self.creator.full_name if self.creator else None
