from pydantic import BaseModel


class WhatsAppStatus(BaseModel):
    connected: bool
    state: str


class QRCodeResponse(BaseModel):
    connected: bool
    base64: str | None = None
    code: str | None = None
    pairing_code: str | None = None


class WhatsAppChat(BaseModel):
    remote_jid: str
    name: str | None = None
    is_group: bool
    last_message: str | None = None
    unread_count: int = 0
    profile_pic_url: str | None = None
    updated_at: str | None = None


class WhatsAppMessage(BaseModel):
    id: str | None = None
    remote_jid: str
    from_me: bool
    text: str | None = None
    timestamp: int | None = None
    sender_name: str | None = None
    media_type: str | None = None
    media_mimetype: str | None = None


class SendMessageInput(BaseModel):
    text: str


class TypingInput(BaseModel):
    presence: str = "composing"  # "composing" (digitando) ou "recording" (gravando áudio)
