# backend/app/models/whatsapp_alias.py
from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.core.timeutil import utcnow


class WhatsAppJidAlias(Base):
    """O mesmo contato com dois identificadores: o ID interno novo do WhatsApp (`...@lid`) e o número
    (`...@s.whatsapp.net`). A Evolution manda o número em `key.remoteJidAlt` nas mensagens `@lid`; aprendemos
    o par e guardamos a conversa sempre pelo número, pra não aparecer duas vezes."""

    __tablename__ = "whatsapp_jid_aliases"

    lid: Mapped[str] = mapped_column(String(100), primary_key=True)
    phone_jid: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
