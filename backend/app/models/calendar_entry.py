# backend/app/models/calendar_entry.py
from datetime import date as date_type, datetime, timezone
from sqlalchemy import String, Integer, Date, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base
from app.core.types import JSONText
from app.models.tag import Tag, calendar_entry_tags


class CalendarEntry(Base):
    __tablename__ = "calendar_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id"), nullable=False, index=True)
    scheduled_date: Mapped[date_type] = mapped_column(Date, nullable=False, index=True)
    # Nome da publicação (opcional: postagens antigas não têm; cai no theme).
    title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    theme: Mapped[str] = mapped_column(Text, nullable=False)
    format: Mapped[str] = mapped_column(String(30), nullable=False)
    execution_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    reference_link: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # URL (R2) da imagem de referência que o social sobe ao planejar
    # a postagem — só aparece no drawer de detalhe, nunca em relatório/
    # impressão/PDF/calendário.
    reference_image: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Lista de URLs (R2) do material bruto que o social sobe pro
    # designer usar na arte (fotos, prints, etc.) — diferente de
    # reference_image, que é só inspiração/referência visual.
    material_files: Mapped[list] = mapped_column(JSONText, default=list, nullable=False)
    # URL (R2) da arte finalizada que o designer entrega pelo drawer da postagem.
    final_image: Mapped[str | None] = mapped_column(Text, nullable=True)
    caption: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Markdown livre respondendo "já tem material?" — sem UI própria ainda,
    # reservado pra uso futuro (igual "status", ver comentário abaixo).
    material_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    # producao / andamento / modificacoes / checagem_aprovacao / finalizados — ver schemas/calendar_entry.py
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="producao")
    # Solicitante (social que pediu a demanda; padrão = social do cliente) e
    # responsável (quem executa; padrão = designer do cliente).
    requester_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    assignee_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    # Etiquetas globais atribuídas à postagem; selectin evita N+1 na listagem.
    tags: Mapped[list[Tag]] = relationship(
        secondary=calendar_entry_tags,
        lazy="selectin",
        order_by=Tag.name,
    )
