# backend/app/services/whatsapp_store.py
"""
Leitura/escrita do histórico de WhatsApp persistido (app.models.whatsapp_message).
Usado tanto pelo envio manual (routers/whatsapp.py) quanto pelo webhook
(routers/whatsapp_webhook.py) — ponto único pra não duplicar a lógica de
"o que conta como uma conversa" entre os dois.
"""
from typing import Any

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.whatsapp_chat_label import WhatsAppChatLabel
from app.models.whatsapp_message import WhatsAppMessage
from app.services.whatsapp_format import message_preview, quote_snippet


def save_message(
    db: Session,
    *,
    message_id: str | None,
    remote_jid: str,
    from_me: bool,
    text: str | None,
    sender_name: str | None,
    is_group: bool,
    status: str,
    timestamp: int,
    media_type: str | None = None,
    media_mimetype: str | None = None,
    media_filename: str | None = None,
    sender_jid: str | None = None,
    reply_to_id: str | None = None,
    reply_text: str | None = None,
    reply_from_me: bool | None = None,
    reply_author: str | None = None,
) -> WhatsAppMessage | None:
    """
    None se a mensagem já existia (dedup por message_id) — acontece quando o
    envio manual já salvou na hora e o webhook manda o mesmo evento de volta
    (fromMe=true), ou quando a Evolution reenvia o mesmo webhook.
    """
    if message_id:
        existing = db.query(WhatsAppMessage).filter(WhatsAppMessage.message_id == message_id).first()
        if existing is not None:
            return None

    message = WhatsAppMessage(
        message_id=message_id,
        remote_jid=remote_jid,
        from_me=from_me,
        text=text,
        sender_name=sender_name,
        is_group=is_group,
        status=status,
        timestamp=timestamp,
        media_type=media_type,
        media_mimetype=media_mimetype,
        media_filename=media_filename,
        sender_jid=sender_jid,
        reply_to_id=reply_to_id,
        reply_text=reply_text,
        reply_from_me=reply_from_me,
        reply_author=reply_author,
    )
    db.add(message)
    try:
        db.commit()
    except IntegrityError:
        # Corrida rara: dois webhooks quase simultâneos pro mesmo message_id.
        db.rollback()
        return None
    db.refresh(message)
    return message


def get_message(db: Session, message_id: str) -> WhatsAppMessage | None:
    return db.query(WhatsAppMessage).filter(WhatsAppMessage.message_id == message_id).first()


def set_sender_name(db: Session, message_id: str | None, name: str) -> None:
    """Grava quem da equipe mandou uma mensagem nossa que já estava salva (eco do webhook chegou antes)."""
    message = get_message(db, message_id) if message_id else None
    if message is None or not message.from_me:
        return
    message.sender_name = name
    db.commit()


def reply_fields(db: Session, quoted_id: str, snippet: str | None = None) -> dict[str, Any]:
    """Campos de "resposta" pra gravar numa mensagem que cita `quoted_id`. Se a citada está no
    nosso histórico, de lá vêm o trecho e de quem ela era; senão fica só o que a Evolution mandou."""
    quoted = get_message(db, quoted_id)
    if quoted is None:
        return {"reply_to_id": quoted_id, "reply_text": snippet, "reply_from_me": None, "reply_author": None}
    return {
        "reply_to_id": quoted_id,
        "reply_text": snippet or quote_snippet(quoted.text, quoted.media_type),
        "reply_from_me": quoted.from_me,
        "reply_author": None if quoted.from_me else quoted.sender_name,
    }


def update_message_status(db: Session, message_id: str, status: str) -> None:
    message = db.query(WhatsAppMessage).filter(WhatsAppMessage.message_id == message_id).first()
    if message is None:
        return
    message.status = status
    db.commit()


def list_messages(db: Session, remote_jid: str, limit: int = 100) -> list[WhatsAppMessage]:
    messages = (
        db.query(WhatsAppMessage)
        .filter(WhatsAppMessage.remote_jid == remote_jid)
        .order_by(WhatsAppMessage.timestamp.desc())
        .limit(limit)
        .all()
    )
    return list(reversed(messages))


def mark_read(db: Session, remote_jid: str) -> None:
    db.query(WhatsAppMessage).filter(
        WhatsAppMessage.remote_jid == remote_jid,
        WhatsAppMessage.from_me.is_(False),
        WhatsAppMessage.read.is_(False),
    ).update({"read": True})
    db.commit()


def list_chats(db: Session) -> list[dict[str, Any]]:
    """Uma linha por `remote_jid`, com última mensagem e contagem de não lidas."""
    unread_rows = (
        db.query(WhatsAppMessage.remote_jid, func.count().label("n"))
        .filter(WhatsAppMessage.from_me.is_(False), WhatsAppMessage.read.is_(False))
        .group_by(WhatsAppMessage.remote_jid)
        .all()
    )
    unread = {jid: n for jid, n in unread_rows}

    last_ts_subq = (
        db.query(WhatsAppMessage.remote_jid, func.max(WhatsAppMessage.timestamp).label("max_ts"))
        .group_by(WhatsAppMessage.remote_jid)
        .subquery()
    )
    last_messages = (
        db.query(WhatsAppMessage)
        .join(
            last_ts_subq,
            (WhatsAppMessage.remote_jid == last_ts_subq.c.remote_jid)
            & (WhatsAppMessage.timestamp == last_ts_subq.c.max_ts),
        )
        .all()
    )
    last_by_jid: dict[str, WhatsAppMessage] = {}
    for m in last_messages:
        if m.remote_jid not in last_by_jid:
            last_by_jid[m.remote_jid] = m

    # Nome do contato: pega da mensagem RECEBIDA mais recente que tem
    # sender_name — se a última mensagem da conversa for nossa (mais comum),
    # `last_by_jid` sozinho perderia o nome (nunca preenchido em envio nosso).
    # Só pra conversa individual: em grupo, sender_name é quem mandou a
    # mensagem (um integrante), não o nome do grupo — isso não pode virar o
    # nome exibido da conversa.
    contact_name_rows = (
        db.query(WhatsAppMessage.remote_jid, WhatsAppMessage.sender_name, WhatsAppMessage.timestamp)
        .filter(
            WhatsAppMessage.from_me.is_(False),
            WhatsAppMessage.sender_name.is_not(None),
            WhatsAppMessage.is_group.is_(False),
        )
        .order_by(WhatsAppMessage.timestamp.desc())
        .all()
    )
    contact_name: dict[str, str] = {}
    for jid, name, _ts in contact_name_rows:
        contact_name.setdefault(jid, name)

    chats = [
        {
            "remote_jid": jid,
            "name": contact_name.get(jid),
            "is_group": message.is_group,
            "last_message": message_preview(message.text, message.media_type),
            "last_from_me": message.from_me,
            "unread_count": unread.get(jid, 0),
            "updated_at": message.timestamp,
        }
        for jid, message in last_by_jid.items()
    ]
    chats.sort(key=lambda c: c["updated_at"], reverse=True)
    return chats


def group_sender_names(db: Session) -> dict[str, set[str]]:
    """jid do grupo -> nomes (pushName) de quem já mandou mensagem nele."""
    rows = (
        db.query(WhatsAppMessage.remote_jid, WhatsAppMessage.sender_name)
        .filter(
            WhatsAppMessage.is_group.is_(True),
            WhatsAppMessage.from_me.is_(False),
            WhatsAppMessage.sender_name.is_not(None),
        )
        .distinct()
        .all()
    )
    names: dict[str, set[str]] = {}
    for jid, name in rows:
        names.setdefault(jid, set()).add(name.strip())
    return names


def set_chat_label(db: Session, remote_jid: str, label_id: str, applied: bool) -> None:
    """Aplica/remove uma etiqueta numa conversa (idempotente nos dois sentidos)."""
    existing = (
        db.query(WhatsAppChatLabel)
        .filter(WhatsAppChatLabel.remote_jid == remote_jid, WhatsAppChatLabel.label_id == label_id)
        .first()
    )
    if applied and not existing:
        db.add(WhatsAppChatLabel(remote_jid=remote_jid, label_id=label_id))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
    elif not applied and existing:
        db.delete(existing)
        db.commit()


def delete_label(db: Session, label_id: str) -> None:
    """Etiqueta apagada no celular — some de todas as conversas."""
    db.query(WhatsAppChatLabel).filter(WhatsAppChatLabel.label_id == label_id).delete()
    db.commit()


def chat_label_ids(db: Session) -> dict[str, list[str]]:
    result: dict[str, list[str]] = {}
    for remote_jid, label_id in db.query(WhatsAppChatLabel.remote_jid, WhatsAppChatLabel.label_id):
        result.setdefault(remote_jid, []).append(label_id)
    return result
