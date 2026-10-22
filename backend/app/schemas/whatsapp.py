from pydantic import BaseModel, field_validator


class WhatsAppStatus(BaseModel):
    connected: bool
    state: str


class QRCodeResponse(BaseModel):
    connected: bool
    base64: str | None = None
    code: str | None = None
    pairing_code: str | None = None


class WhatsAppLabel(BaseModel):
    id: str
    name: str
    # Índice da paleta do WhatsApp (0-19), não um hex — o front traduz.
    color: int = 0


class WhatsAppChat(BaseModel):
    remote_jid: str
    name: str | None = None
    is_group: bool
    last_message: str | None = None
    last_from_me: bool = False
    unread_count: int = 0
    profile_pic_url: str | None = None
    updated_at: str | None = None
    labels: list[WhatsAppLabel] = []
    # Só conversa individual: número em formato legível (None pra @lid/grupo).
    phone: str | None = None
    # Cliente do CRM ligado à conversa — pelo `whatsapp_group_id` do cliente ou,
    # sem isso, pelo nome do cliente aparecer no nome do grupo.
    client_id: int | None = None
    client_name: str | None = None
    client_linked: bool = False
    # Só grupo (vem do fetchAllGroups em cache — pode faltar na 1ª carga).
    group_size: int | None = None
    group_description: str | None = None


class WhatsAppMessage(BaseModel):
    id: str | None = None
    remote_jid: str
    from_me: bool
    text: str | None = None
    timestamp: int | None = None
    sender_name: str | None = None
    media_type: str | None = None
    media_mimetype: str | None = None
    media_filename: str | None = None


class SendMessageInput(BaseModel):
    text: str

    @field_validator("text")
    @classmethod
    def not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("A mensagem está vazia.")
        return value


class TypingInput(BaseModel):
    presence: str = "composing"  # "composing" (digitando) ou "recording" (gravando áudio)
