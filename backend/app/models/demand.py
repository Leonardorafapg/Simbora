# backend/app/models/demand.py
from datetime import date as date_type, datetime, timezone
from sqlalchemy import String, Integer, Date, DateTime, ForeignKey, Text, Boolean, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class Demand(Base):
    """
    Demanda de produção — o "ticket" de trabalho que um designer/social
    executa. Pode nascer de uma postagem do calendário (`calendar_entry_id`
    preenchido, uma pra cada) ou ser criada solta, sem cliente nenhum
    (tarefa operacional genérica).
    """

    __tablename__ = "demands"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    client_id: Mapped[int | None] = mapped_column(ForeignKey("clients.id"), nullable=True, index=True)
    # Unique: uma demanda por postagem do calendário, no máximo. ON DELETE
    # SET NULL documenta a intenção pro schema (apagar a postagem não deve
    # apagar a demanda) — o app também desvincula explicitamente antes de
    # deletar (routers/calendar.py), porque SQLite não reaplica esse
    # ondelete em bancos criados antes dessa mudança.
    calendar_entry_id: Mapped[int | None] = mapped_column(
        ForeignKey("calendar_entries.id", ondelete="SET NULL"), nullable=True, unique=True, index=True
    )

    title: Mapped[str] = mapped_column(Text, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    requester_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    assignee_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)

    # Demandas de arte (nascidas do calendário) passam por aprovação do
    # cliente; demandas genéricas não — por isso pendente/em_andamento/
    # concluida servem pras duas, mas em_aprovacao/reprovada só fazem
    # sentido quando is_art=True.
    is_art: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # pendente / em_andamento / em_aprovacao / reprovada / concluida
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pendente", index=True)

    due_date: Mapped[date_type | None] = mapped_column(Date, nullable=True, index=True)

    # "Já tem material?" — sim/não simples, não confundir com o
    # CalendarEntry.material_notes (esse é markdown livre da postagem de
    # origem; este aqui é uma checagem prática pro designer que vai executar
    # a demanda: já existe imagem/vídeo pronto ou precisa captar do zero.
    has_material: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Lista de {id, text, done} — igual em espírito ao User.permissions:
    # substitui o array inteiro a cada PATCH, sem endpoint próprio.
    checklist: Mapped[list] = mapped_column(JSON, default=list, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
