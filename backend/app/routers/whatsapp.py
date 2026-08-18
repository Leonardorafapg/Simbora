from typing import Any

from fastapi import APIRouter, Depends, Query

from app.core import evolution_client
from app.core.deps import require_permission
from app.models.user import User
from app.schemas.whatsapp import (
    QRCodeResponse,
    SendMessageInput,
    WhatsAppChat,
    WhatsAppMessage,
    WhatsAppStatus,
)

router = APIRouter()


def _map_chat(raw: dict[str, Any]) -> WhatsAppChat:
    remote_jid = raw.get("remoteJid") or raw.get("id") or ""
    is_group = remote_jid.endswith("@g.us")

    last_message_raw = raw.get("lastMessage") or {}
    last_message_text = None
    if isinstance(last_message_raw, dict):
        message = last_message_raw.get("message") or {}
        last_message_text = (
            message.get("conversation")
            or (message.get("extendedTextMessage") or {}).get("text")
            or last_message_raw.get("body")
        )

    return WhatsAppChat(
        remote_jid=remote_jid,
        name=raw.get("name") or raw.get("pushName") or raw.get("subject") or remote_jid,
        is_group=is_group,
        last_message=last_message_text,
        unread_count=raw.get("unreadCount") or raw.get("unread_count") or 0,
        profile_pic_url=raw.get("profilePicUrl") or raw.get("profile_pic_url"),
        updated_at=str(raw.get("updatedAt")) if raw.get("updatedAt") else None,
    )


def _map_message(raw: dict[str, Any]) -> WhatsAppMessage:
    key = raw.get("key") or {}
    message = raw.get("message") or {}
    text = (
        message.get("conversation")
        or (message.get("extendedTextMessage") or {}).get("text")
        or (message.get("imageMessage") or {}).get("caption")
    )

    return WhatsAppMessage(
        id=key.get("id"),
        remote_jid=key.get("remoteJid", ""),
        from_me=bool(key.get("fromMe")),
        text=text,
        timestamp=raw.get("messageTimestamp"),
        sender_name=raw.get("pushName"),
    )


@router.get("/whatsapp/status", response_model=WhatsAppStatus)
async def get_status(
    _: User = Depends(require_permission("whatsapp.view")),
):
    state = await evolution_client.get_connection_state()
    return WhatsAppStatus(connected=state == "open", state=state)


@router.post("/whatsapp/connect", response_model=QRCodeResponse)
async def connect(
    _: User = Depends(require_permission("whatsapp.view")),
):
    result = await evolution_client.connect_instance()
    return QRCodeResponse(**result)


@router.post("/whatsapp/disconnect", status_code=204)
async def disconnect(
    _: User = Depends(require_permission("whatsapp.view")),
):
    await evolution_client.logout_instance()


@router.get("/whatsapp/chats", response_model=list[WhatsAppChat])
async def list_chats(
    _: User = Depends(require_permission("whatsapp.view")),
):
    raw_chats = await evolution_client.find_chats()
    return [_map_chat(chat) for chat in raw_chats]


@router.get("/whatsapp/chats/{remote_jid}/messages", response_model=list[WhatsAppMessage])
async def get_messages(
    remote_jid: str,
    limit: int = Query(default=50, le=200),
    page: int = Query(default=1, ge=1),
    _: User = Depends(require_permission("whatsapp.view")),
):
    raw_messages = await evolution_client.find_messages(remote_jid, limit=limit, page=page)
    return [_map_message(message) for message in raw_messages]


@router.post("/whatsapp/chats/{remote_jid}/messages", response_model=WhatsAppMessage)
async def send_message(
    remote_jid: str,
    payload: SendMessageInput,
    _: User = Depends(require_permission("whatsapp.send")),
):
    result = await evolution_client.send_text_message(remote_jid, payload.text)
    key = result.get("key") or {}
    return WhatsAppMessage(
        id=key.get("id"),
        remote_jid=key.get("remoteJid", remote_jid),
        from_me=True,
        text=payload.text,
        timestamp=result.get("messageTimestamp"),
    )
