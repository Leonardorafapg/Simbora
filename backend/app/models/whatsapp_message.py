# backend/app/models/whatsapp_message.py
from datetime import datetime, timezone
from sqlalchemy import String, Integer, Boolean, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class WhatsAppMessage(Base):
    """
    Histórico de mensagens do WhatsApp, alimentado pelo webhook da Evolution
    (routers/whatsapp_webhook.py) e pelo envio manual (routers/whatsapp.py).
    Sistema single-tenant: uma "conversa" é só `group by remote_jid`, sem
    tabela própria pra isso.
    """

    __tablename__ = "whatsapp_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Id da mensagem na Evolution (key.id) — usado pra deduplicar: o mesmo envio
    # nosso pode chegar de volta pelo webhook (fromMe=true) depois de já termos
    # salvo na hora do POST /whatsapp/chats/{jid}/messages.
    message_id: Mapped[str | None] = mapped_column(String(100), nullable=True, unique=True, index=True)
    remote_jid: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    from_me: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    text: Mapped[str | None] = mapped_column(Text, nullable=True)
    # pushName de quem mandou — só relevante em grupo (ver WhatsAppChatWindow).
    sender_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    is_group: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # enviada / entregue / lida / erro — ver _STATUS_MAP no webhook.
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="enviada")
    # Epoch seconds — vem pronto da Evolution (messageTimestamp).
    timestamp: Mapped[int] = mapped_column(Integer, nullable=False)
    # Só mensagens recebidas (from_me=False) usam isso, pra contar não lidas.
    read: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
