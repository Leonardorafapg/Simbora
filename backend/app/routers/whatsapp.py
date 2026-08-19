import asyncio
import logging

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.core import evolution_client
from app.core.config import settings
from app.core.database import get_db
from app.core.deps import require_permission
from app.core.security import decode_access_token
from app.core.ws_manager import manager as ws_manager
from app.models.user import User
from app.schemas.whatsapp import (
    QRCodeResponse,
    SendMessageInput,
    TypingInput,
    WhatsAppChat,
    WhatsAppMessage,
    WhatsAppStatus,
)
from app.services import whatsapp_store

logger = logging.getLogger("whatsapp_router")

router = APIRouter()


def _webhook_url() -> str | None:
    # Normaliza esquema — evita webhook quebrado por faltar o https:// na env var.
    url = (settings.PUBLIC_API_URL or "").strip().rstrip("/")
    if not url:
        return None
    if not url.startswith(("http://", "https://")):
        url = f"https://{url}"
    return f"{url}/api/v1/whatsapp/webhook"


def _message_out(message) -> WhatsAppMessage:
    return WhatsAppMessage(
        id=message.message_id,
        remote_jid=message.remote_jid,
        from_me=message.from_me,
        text=message.text,
        timestamp=message.timestamp,
        sender_name=message.sender_name,
    )


def _map_chat_from_evolution(raw: dict) -> WhatsAppChat:
    remote_jid = raw.get("remoteJid") or raw.get("id") or ""
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
        is_group=remote_jid.endswith("@g.us"),
        last_message=last_message_text,
        unread_count=raw.get("unreadCount") or raw.get("unread_count") or 0,
        profile_pic_url=raw.get("profilePicUrl") or raw.get("profile_pic_url"),
        updated_at=str(raw.get("updatedAt")) if raw.get("updatedAt") else None,
    )


def _map_message_from_evolution(raw: dict) -> WhatsAppMessage:
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

    # Sempre registra o webhook depois de criar/reconectar — a Evolution não
    # garante manter a config numa instância já existente. Best-effort: não
    # pode travar o QR code se isso falhar (ver evolution_client.set_webhook).
    webhook_url = _webhook_url()
    if webhook_url:
        await evolution_client.set_webhook(webhook_url)
    else:
        logger.warning("PUBLIC_API_URL não configurada — webhook do WhatsApp não registrado.")

    return QRCodeResponse(**result)


@router.post("/whatsapp/disconnect", status_code=204)
async def disconnect(
    _: User = Depends(require_permission("whatsapp.view")),
):
    await evolution_client.delete_instance()


@router.get("/whatsapp/chats", response_model=list[WhatsAppChat])
async def list_chats(
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("whatsapp.view")),
):
    # Enquanto o webhook não está configurado (ou pra conversa antiga, anterior
    # a ele existir), o banco não tem nada — sem isso a lista aparecia vazia
    # mesmo com histórico real esperando na Evolution. Busca sempre os dois e
    # funde: banco manda em quem já tem (unread/última mensagem corretos), o
    # que só existe na Evolution ainda aparece, só sem esses dois refinamentos.
    db_chats = whatsapp_store.list_chats(db)
    db_by_jid = {c["remote_jid"]: c for c in db_chats}

    raw_by_jid: dict[str, dict] = {}
    try:
        for raw in await evolution_client.find_chats():
            jid = raw.get("remoteJid") or raw.get("id") or ""
            if jid:
                raw_by_jid[jid] = raw
    except Exception:
        logger.warning("Não foi possível buscar conversas na Evolution (seguindo só com o banco).", exc_info=True)

    result = []
    for jid, chat in db_by_jid.items():
        raw = raw_by_jid.pop(jid, {})
        result.append(
            WhatsAppChat(
                remote_jid=jid,
                name=chat["name"] or raw.get("name") or raw.get("pushName") or raw.get("subject") or jid,
                is_group=chat["is_group"],
                last_message=chat["last_message"],
                unread_count=chat["unread_count"],
                profile_pic_url=raw.get("profilePicUrl") or raw.get("profile_pic_url"),
                updated_at=str(chat["updated_at"]) if chat["updated_at"] else None,
            )
        )

    # Sobrou na Evolution e não no banco: conversa que ainda não passou pelo
    # webhook nenhuma vez — mostra do jeito antigo (sem tempo real ainda).
    for raw in raw_by_jid.values():
        result.append(_map_chat_from_evolution(raw))

    def _sort_key(chat: WhatsAppChat) -> float:
        # `updated_at` mistura dois formatos (epoch do banco, ISO da Evolution
        # pra quem ainda não passou pelo webhook) — não dá pra comparar como
        # string direto. Normaliza os dois pra epoch só pra ordenar.
        if not chat.updated_at:
            return 0
        if chat.updated_at.isdigit():
            return float(chat.updated_at)
        try:
            from datetime import datetime

            return datetime.fromisoformat(chat.updated_at.replace("Z", "+00:00")).timestamp()
        except ValueError:
            return 0

    result.sort(key=_sort_key, reverse=True)
    return result


@router.get("/whatsapp/chats/{remote_jid}/messages", response_model=list[WhatsAppMessage])
async def get_messages(
    remote_jid: str,
    limit: int = Query(default=100, le=500),
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("whatsapp.view")),
):
    messages = whatsapp_store.list_messages(db, remote_jid, limit=limit)

    if not messages:
        # Nada no banco ainda pra essa conversa (comum: webhook só configurado
        # agora, ou conversa nunca recebeu mensagem depois disso) — busca na
        # Evolution como antes E aproveita pra semear o banco, então da
        # próxima vez que abrir essa conversa já sai do banco, mais rápido.
        try:
            raw_messages = await evolution_client.find_messages(remote_jid, limit=limit)
        except Exception:
            logger.warning("Não foi possível buscar mensagens na Evolution.", exc_info=True)
            return []

        is_group = remote_jid.endswith("@g.us")
        for raw in raw_messages:
            key = raw.get("key") or {}
            whatsapp_store.save_message(
                db,
                message_id=key.get("id"),
                remote_jid=key.get("remoteJid") or remote_jid,
                from_me=bool(key.get("fromMe")),
                text=_map_message_from_evolution(raw).text,
                sender_name=raw.get("pushName"),
                is_group=is_group,
                status="recebida" if not key.get("fromMe") else "enviada",
                timestamp=raw.get("messageTimestamp") or 0,
            )
        messages = whatsapp_store.list_messages(db, remote_jid, limit=limit)

    whatsapp_store.mark_read(db, remote_jid)
    return [_message_out(m) for m in messages]


@router.post("/whatsapp/chats/{remote_jid}/messages", response_model=WhatsAppMessage)
async def send_message(
    remote_jid: str,
    payload: SendMessageInput,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("whatsapp.send")),
):
    result = await evolution_client.send_text_message(remote_jid, payload.text)
    key = result.get("key") or {}

    message = whatsapp_store.save_message(
        db,
        message_id=key.get("id"),
        remote_jid=key.get("remoteJid") or remote_jid,
        from_me=True,
        text=payload.text,
        sender_name=None,
        is_group=remote_jid.endswith("@g.us"),
        status="enviada",
        timestamp=result.get("messageTimestamp") or 0,
    )
    if message is None:
        # Dedup: já tinha sido salva (não deveria acontecer no envio, mas o
        # dado que importa é devolver a resposta certa mesmo assim).
        out = WhatsAppMessage(
            id=key.get("id"), remote_jid=remote_jid, from_me=True, text=payload.text,
            timestamp=result.get("messageTimestamp"), sender_name=None,
        )
    else:
        out = _message_out(message)
        await ws_manager.broadcast({"type": "whatsapp_message", "message": out.model_dump()})
    return out


@router.post("/whatsapp/chats/{remote_jid}/typing", status_code=204)
async def send_typing(
    remote_jid: str,
    payload: TypingInput,
    _: User = Depends(require_permission("whatsapp.send")),
):
    await evolution_client.send_presence(remote_jid, payload.presence)


@router.websocket("/whatsapp/ws")
async def whatsapp_ws(websocket: WebSocket, token: str = Query(...)):
    """
    Canal de tempo real: mensagem nova (`whatsapp_message`) e presença de
    contato digitando (`whatsapp_presence`) — ver routers/whatsapp_webhook.py.
    Autentica pelo JWT do usuário no query param (WebSocket não manda header
    Authorization pelo navegador).
    """
    try:
        decode_access_token(token)
    except Exception:
        await websocket.close(code=4401)
        return

    await ws_manager.connect(websocket)
    try:
        while True:
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
            except asyncio.TimeoutError:
                await websocket.send_json({"type": "ping"})
    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.disconnect(websocket)
