# backend/app/routers/whatsapp_webhook.py
"""
Webhook da Evolution API — ponto de entrada de mensagem recebida, status de
entrega e presença ("digitando..."). NÃO tem JWT: quem chama é o servidor da
Evolution, autenticado pelo header `x-webhook-secret` (configurado em
evolution_client.set_webhook, conferido aqui).
"""
import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.ws_manager import manager as ws_manager
from app.services import whatsapp_store

logger = logging.getLogger("whatsapp_webhook")

router = APIRouter()

# Evolution -> vocabulário interno (mesmo mapeamento usado no slzfood-api).
_STATUS_MAP = {
    "SERVER_ACK": "enviada",
    "DELIVERY_ACK": "entregue",
    "READ": "lida",
    "PLAYED": "lida",
    "ERROR": "erro",
    "FAILED": "erro",
    "DELETED": "erro",
}

# lastKnownPresence da Evolution/Baileys -> o que o front mostra. Qualquer
# outra coisa (available/paused/unavailable) limpa o indicador (None).
_PRESENCE_MAP = {"composing": "digitando", "recording": "gravando_audio"}


def _extract_text(message: dict[str, Any]) -> str | None:
    return (
        message.get("conversation")
        or (message.get("extendedTextMessage") or {}).get("text")
        or (message.get("imageMessage") or {}).get("caption")
        or (message.get("videoMessage") or {}).get("caption")
        or (message.get("documentMessage") or {}).get("caption")
    )


# Chave da mensagem (Baileys) -> (tipo pra UI, chave do mimetype dentro dela).
_MEDIA_KEYS = {
    "imageMessage": "image",
    "videoMessage": "video",
    "audioMessage": "audio",
    "documentMessage": "document",
}


def _extract_media(message: dict[str, Any]) -> tuple[str | None, str | None]:
    """(media_type, mimetype) da mensagem, ou (None, None) se for só texto."""
    for key, media_type in _MEDIA_KEYS.items():
        payload = message.get(key)
        if isinstance(payload, dict):
            return media_type, payload.get("mimetype")
    return None, None


async def _handle_messages_upsert(db: Session, data: dict[str, Any]) -> None:
    key = data.get("key") or {}
    remote_jid = key.get("remoteJid") or ""
    if not remote_jid:
        return

    media_type, media_mimetype = _extract_media(data.get("message") or {})

    message = whatsapp_store.save_message(
        db,
        message_id=key.get("id"),
        remote_jid=remote_jid,
        from_me=bool(key.get("fromMe")),
        text=_extract_text(data.get("message") or {}),
        sender_name=data.get("pushName"),
        is_group=remote_jid.endswith("@g.us"),
        status="recebida" if not key.get("fromMe") else "enviada",
        timestamp=data.get("messageTimestamp") or 0,
        media_type=media_type,
        media_mimetype=media_mimetype,
    )
    if message is None:
        return  # já existia (dedup) — nosso próprio envio ecoando de volta

    await ws_manager.broadcast({
        "type": "whatsapp_message",
        "message": {
            "id": message.message_id,
            "remote_jid": message.remote_jid,
            "from_me": message.from_me,
            "text": message.text,
            "timestamp": message.timestamp,
            "sender_name": message.sender_name,
            "media_type": message.media_type,
            "media_mimetype": message.media_mimetype,
        },
    })


async def _handle_messages_update(db: Session, data: dict[str, Any]) -> None:
    # Formato ainda não validado contra um payload real de messages.update
    # (só confirmamos messages.upsert em produção até agora) — cobre as
    # variações mais prováveis; ajustar aqui se a Evolution mandar diferente.
    message_id = data.get("keyId") or (data.get("key") or {}).get("id")
    evo_status = data.get("status")
    if not message_id or evo_status not in _STATUS_MAP:
        return
    whatsapp_store.update_message_status(db, message_id, _STATUS_MAP[evo_status])


async def _handle_presence_update(data: dict[str, Any]) -> None:
    # Idem: formato inferido do Baileys ({id, presences: {jid: {lastKnownPresence}}}),
    # não validado ainda contra um payload real dessa instância.
    remote_jid = data.get("id")
    if not remote_jid:
        return

    presences = data.get("presences") or {}
    raw_state = next(
        (p.get("lastKnownPresence") for p in presences.values() if isinstance(p, dict)),
        None,
    )
    presence = _PRESENCE_MAP.get(raw_state)

    await ws_manager.broadcast({"type": "whatsapp_presence", "remote_jid": remote_jid, "presence": presence})


@router.post("/whatsapp/webhook", status_code=204)
async def whatsapp_webhook(request: Request):
    if not settings.EVOLUTION_WEBHOOK_SECRET or request.headers.get("x-webhook-secret") != settings.EVOLUTION_WEBHOOK_SECRET:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Webhook secret inválido")

    payload = await request.json()
    event = payload.get("event")
    data = payload.get("data") or {}

    # Sessão própria: rota sem JWT, não passa pelo Depends(get_db) padrão.
    db = SessionLocal()
    try:
        if event == "messages.upsert":
            await _handle_messages_upsert(db, data)
        elif event == "messages.update":
            await _handle_messages_update(db, data)
        elif event == "presence.update":
            await _handle_presence_update(data)
    finally:
        db.close()
