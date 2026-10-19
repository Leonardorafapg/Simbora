# backend/app/models/instagram.py
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.types import JSONText


def utcnow() -> datetime:
    """UTC sem fuso: as colunas DateTime do projeto são "naive" (SQLite devolve
    sem fuso), e misturar datetime com e sem fuso numa comparação quebra."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class InstagramAccount(Base):
    """Conta profissional do Instagram de um cliente, conectada via OAuth.
    Uma por cliente; reconectar sobrescreve a mesma linha (mantém o id).
    Desconectar NÃO apaga a linha (nem o histórico de posts): só limpa o token."""

    __tablename__ = "instagram_accounts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    client_id: Mapped[int] = mapped_column(
        ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, unique=True, index=True
    )
    ig_user_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    username: Mapped[str | None] = mapped_column(String(100), nullable=True)
    profile_picture_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Token de longa duração (60 dias) criptografado — ver core/crypto.py. Nulo depois de desconectar.
    access_token_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    token_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_refreshed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # ativo | expirado | revogado | desconectado
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ativo")
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    connected_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    connected_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)


class InstagramPost(Base):
    """Post agendado pra publicação automática no Instagram do cliente. Pode
    nascer de uma postagem aprovada da Produção (calendar_entry_id) ou avulso.
    É um "retrato" do que vai ao ar: editar a postagem do calendário depois de
    agendar não muda o agendamento (edita-se o agendamento em si)."""

    __tablename__ = "instagram_posts"
    # No máximo um agendamento "vivo" por postagem do calendário — garantido no
    # banco (dois cliques simultâneos em "Agendar" não geram post duplicado).
    __table_args__ = (
        Index(
            "uq_instagram_posts_entry_active",
            "calendar_entry_id",
            unique=True,
            sqlite_where=text("calendar_entry_id IS NOT NULL AND status IN ('pendente', 'publicando', 'publicado', 'erro')"),
            postgresql_where=text("calendar_entry_id IS NOT NULL AND status IN ('pendente', 'publicando', 'publicado', 'erro')"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True)
    calendar_entry_id: Mapped[int | None] = mapped_column(
        ForeignKey("calendar_entries.id", ondelete="SET NULL"), nullable=True, index=True
    )

    # IMAGE | CAROUSEL | REELS | STORIES
    media_type: Mapped[str] = mapped_column(String(20), nullable=False)
    # URLs (R2) escolhidas pelo usuário — o que a UI mostra.
    media_urls: Mapped[list] = mapped_column(JSONText, default=list, nullable=False)
    # URLs que vão pra Meta: imagens convertidas pra JPEG (único formato aceito) e redimensionadas.
    publish_urls: Mapped[list] = mapped_column(JSONText, default=list, nullable=False)
    caption: Mapped[str | None] = mapped_column(Text, nullable=True)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)  # UTC

    # pendente | publicando | publicado | erro
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pendente", index=True)
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    next_attempt_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Container criado na Meta (gravado ANTES de publicar): numa nova tentativa,
    # consultar o status dele evita publicar o mesmo post duas vezes.
    container_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    container_ig_user_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    # Atualizado durante a publicação; parado há muito tempo = processo morreu no meio.
    heartbeat_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    ig_media_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    permalink: Mapped[str | None] = mapped_column(Text, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow, nullable=False)
