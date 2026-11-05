# backend/app/models/calendar_entry_review.py
"""
Histórico de revisões de uma postagem na Produção (etapa "Checagem e aprovação", feita por
quem tem `post.review` — a redatora). Tabela separada porque o post pode ser reprovado e
reenviado várias vezes: precisa do histórico completo (quem, quando, por quê).
"""
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class CalendarEntryReview(Base):
    __tablename__ = "calendar_entry_reviews"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    entry_id: Mapped[int] = mapped_column(ForeignKey("calendar_entries.id", ondelete="CASCADE"), nullable=False, index=True)
    # "aprovado" | "reprovado"
    decision: Mapped[str] = mapped_column(String(20), nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    decided_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    decided_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
