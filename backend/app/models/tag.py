# backend/app/models/tag.py
from sqlalchemy import Column, ForeignKey, Integer, String, Table
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class Tag(Base):
    """Etiqueta global (estilo Trello): criada uma vez e atribuível a qualquer postagem."""

    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(40), nullable=False)
    # Chave da paleta (ver schemas/tag.py); o front traduz em cor.
    color: Mapped[str] = mapped_column(String(20), nullable=False, default="gray")


calendar_entry_tags = Table(
    "calendar_entry_tags",
    Base.metadata,
    Column("entry_id", Integer, ForeignKey("calendar_entries.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)
