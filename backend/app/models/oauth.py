# backend/app/models/oauth.py
"""Tabelas do login OAuth dos clientes MCP (Claude, Codex, Gemini...). Segredos só como hash SHA-256."""
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.types import JSONText


def _now() -> datetime:
    # UTC sem fuso, como o resto do projeto (colunas DateTime "naive").
    return datetime.now(timezone.utc).replace(tzinfo=None)


class OAuthClient(Base):
    """Aplicativo registrado por Dynamic Client Registration (RFC 7591)."""

    __tablename__ = "oauth_clients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    client_id: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    client_secret_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    client_name: Mapped[str] = mapped_column(String(200), nullable=False)
    redirect_uris: Mapped[list[str]] = mapped_column(JSONText, default=list, nullable=False)
    token_endpoint_auth_method: Mapped[str] = mapped_column(String(40), default="none", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class OAuthGrant(Base):
    """Uma conexão de IA de um usuário: é o que aparece na tela de conexões e o que se revoga."""

    __tablename__ = "oauth_grants"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    client_pk: Mapped[int] = mapped_column(Integer, ForeignKey("oauth_clients.id"), nullable=False)
    scope: Mapped[str] = mapped_column(String(200), nullable=False)
    resource: Mapped[str] = mapped_column(String(500), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class OAuthAuthorizationCode(Base):
    __tablename__ = "oauth_authorization_codes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    client_pk: Mapped[int] = mapped_column(Integer, ForeignKey("oauth_clients.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True, nullable=False)
    redirect_uri: Mapped[str] = mapped_column(String(1000), nullable=False)
    code_challenge: Mapped[str] = mapped_column(String(128), nullable=False)
    scope: Mapped[str] = mapped_column(String(200), nullable=False)
    resource: Mapped[str] = mapped_column(String(500), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # Grant criado ao trocar este code: se o code for reutilizado, esse grant é revogado.
    grant_id: Mapped[int | None] = mapped_column(Integer, ForeignKey("oauth_grants.id"), nullable=True)


class OAuthRefreshToken(Base):
    __tablename__ = "oauth_refresh_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    grant_id: Mapped[int] = mapped_column(Integer, ForeignKey("oauth_grants.id"), index=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    rotated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
