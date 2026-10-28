# backend/app/services/whatsapp_aliases.py
"""Um contato, um chat: junta o identificador novo do WhatsApp (`@lid`) com o número (`@s.whatsapp.net`).

A Evolution 2.3.x entrega `key.remoteJid` como `...@lid` quando a pessoa escreve e como número quando a
gente escreve; quando é `@lid` ela manda o número em `key.remoteJidAlt`. Guardamos o par e usamos sempre o
número como identificador da conversa.
"""
import logging
import time
from typing import Any

from sqlalchemy import update
from sqlalchemy.orm import Session

from app.core import evolution_client
from app.models.whatsapp_alias import WhatsAppJidAlias
from app.models.whatsapp_chat_label import WhatsAppChatLabel
from app.models.whatsapp_message import WhatsAppMessage

logger = logging.getLogger("whatsapp_aliases")

LID = "@lid"
PHONE = "@s.whatsapp.net"

# Conversa @lid sem número descoberto: não insiste na Evolution antes disso.
BACKFILL_RETRY_SECONDS = 30 * 60
_next_attempt: dict[str, float] = {}


def is_lid(jid: str | None) -> bool:
    return bool(jid) and jid.endswith(LID)


def is_phone_jid(jid: str | None) -> bool:
    return bool(jid) and jid.endswith(PHONE) and jid.split("@", 1)[0].isdigit()


def alias_map(db: Session) -> dict[str, str]:
    return {a.lid: a.phone_jid for a in db.query(WhatsAppJidAlias).all()}


def resolve(db: Session, jid: str) -> str:
    """O identificador que a conversa usa no CRM (o número, se soubermos qual é o dono do `@lid`)."""
    if not is_lid(jid):
        return jid
    alias = db.get(WhatsAppJidAlias, jid)
    return alias.phone_jid if alias else jid


def lids_of(db: Session, phone_jid: str) -> list[str]:
    """Endereços @lid que já vimos pra esse número (a Evolution guarda a mensagem no endereço original)."""
    return [a.lid for a in db.query(WhatsAppJidAlias).filter(WhatsAppJidAlias.phone_jid == phone_jid).all()]


def learn_from_chat(db: Session, raw_chat: dict[str, Any]) -> str | None:
    """Conversa da Evolution (`findChats`) em @lid: o número costuma vir na `key` da última mensagem."""
    jid = raw_chat.get("remoteJid") or raw_chat.get("id") or ""
    last = raw_chat.get("lastMessage") if isinstance(raw_chat.get("lastMessage"), dict) else {}
    alt = (last.get("key") or {}).get("remoteJidAlt") if isinstance(last.get("key"), dict) else None
    if is_lid(jid) and is_phone_jid(alt):
        if learn(db, jid, alt):
            merge_lid_into_phone(db, jid, alt)
        return alt
    return None


def resolve_with(mapping: dict[str, str], jid: str) -> str:
    return mapping.get(jid, jid)


def learn(db: Session, lid: str, phone_jid: str) -> bool:
    """Registra o par. True se era novo (ou mudou) — aí vale juntar as conversas já gravadas."""
    if not (is_lid(lid) and is_phone_jid(phone_jid)):
        return False
    alias = db.get(WhatsAppJidAlias, lid)
    if alias is not None and alias.phone_jid == phone_jid:
        return False
    if alias is None:
        db.add(WhatsAppJidAlias(lid=lid, phone_jid=phone_jid))
    else:
        alias.phone_jid = phone_jid
    db.commit()
    return True


def canonical_jid(db: Session, key: dict[str, Any]) -> str:
    """Identificador da conversa a partir da `key` de uma mensagem da Evolution."""
    remote = key.get("remoteJid") or ""
    if not is_lid(remote):
        return remote
    alt = key.get("remoteJidAlt") or ""
    if is_phone_jid(alt):
        if learn(db, remote, alt):
            merge_lid_into_phone(db, remote, alt)
        return alt
    return resolve(db, remote)


def merge_lid_into_phone(db: Session, lid: str, phone_jid: str) -> int:
    """Move mensagens e etiquetas da conversa `@lid` pra do número. Idempotente. Devolve quantas mensagens moveu."""
    moved = db.execute(
        update(WhatsAppMessage).where(WhatsAppMessage.remote_jid == lid).values(remote_jid=phone_jid)
    ).rowcount or 0

    have = {row.label_id for row in db.query(WhatsAppChatLabel).filter(WhatsAppChatLabel.remote_jid == phone_jid)}
    for row in db.query(WhatsAppChatLabel).filter(WhatsAppChatLabel.remote_jid == lid).all():
        if row.label_id in have:
            db.delete(row)  # a conversa do número já tem essa etiqueta
        else:
            row.remote_jid = phone_jid
            have.add(row.label_id)
    db.commit()
    return moved


def merge_all_known(db: Session) -> dict[str, int]:
    """Junta toda conversa `@lid` cujo número já conhecemos. Barato: só mexe no que ainda está separado."""
    mapping = alias_map(db)
    if not mapping:
        return {"chats": 0, "messages": 0}
    present = {
        jid
        for (jid,) in db.query(WhatsAppMessage.remote_jid).filter(WhatsAppMessage.remote_jid.like(f"%{LID}")).distinct()
    } | {jid for (jid,) in db.query(WhatsAppChatLabel.remote_jid).filter(WhatsAppChatLabel.remote_jid.like(f"%{LID}")).distinct()}
    chats = messages = 0
    for lid in present:
        phone = mapping.get(lid)
        if phone:
            messages += merge_lid_into_phone(db, lid, phone)
            chats += 1
    return {"chats": chats, "messages": messages}


def unresolved_lids(db: Session, limit: int = 200, extra: list[str] | None = None) -> list[str]:
    """Conversas `@lid` sem número conhecido (candidatas a descobrir pela Evolution): as gravadas no CRM e,
    em `extra`, as que só aparecem na lista da Evolution."""
    known = alias_map(db)
    rows = db.query(WhatsAppMessage.remote_jid).filter(WhatsAppMessage.remote_jid.like(f"%{LID}")).distinct().all()
    candidates = dict.fromkeys([jid for (jid,) in rows] + [j for j in (extra or []) if is_lid(j)])
    return [jid for jid in candidates if jid not in known][:limit]


async def backfill(db: Session, limit: int = 100, extra: list[str] | None = None) -> dict[str, int]:
    """Descobre o número das conversas `@lid` antigas lendo as mensagens delas na Evolution (`remoteJidAlt`)."""
    found = merged = 0
    now = time.monotonic()
    for lid in unresolved_lids(db, limit, extra):
        if _next_attempt.get(lid, 0) > now:
            continue
        _next_attempt[lid] = now + BACKFILL_RETRY_SECONDS
        try:
            records = await evolution_client.find_messages(lid, limit=10)
        except Exception as exc:
            logger.warning("Não foi possível ler %s na Evolution: %s", lid, getattr(exc, "detail", None) or repr(exc))
            continue
        for record in records:
            alt = (record.get("key") or {}).get("remoteJidAlt")
            if is_phone_jid(alt):
                learn(db, lid, alt)
                merged += merge_lid_into_phone(db, lid, alt)
                found += 1
                _next_attempt.pop(lid, None)
                break
    return {"found": found, "messages": merged}
