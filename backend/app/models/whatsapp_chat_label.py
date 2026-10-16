# backend/app/models/whatsapp_chat_label.py
from sqlalchemy import Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class WhatsAppChatLabel(Base):
    """
    Etiqueta do WhatsApp Business aplicada numa conversa. A Evolution não
    devolve isso em nenhum endpoint de leitura (`findChats` não traz o campo),
    só avisa pelo webhook LABELS_ASSOCIATION — então guardamos aqui. Nome e cor
    da etiqueta não ficam no banco: vêm de `findLabels` na hora (são poucas e
    mudam de nome pelo celular).
    """

    __tablename__ = "whatsapp_chat_labels"
    __table_args__ = (UniqueConstraint("remote_jid", "label_id", name="uq_whatsapp_chat_label"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    remote_jid: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    label_id: Mapped[str] = mapped_column(String(50), nullable=False)
