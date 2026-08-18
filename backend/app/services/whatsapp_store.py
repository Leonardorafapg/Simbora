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

from app.models.whatsapp_message import WhatsAppMessage


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
    contact_name_rows = (
        db.query(WhatsAppMessage.remote_jid, WhatsAppMessage.sender_name, WhatsAppMessage.timestamp)
        .filter(WhatsAppMessage.from_me.is_(False), WhatsAppMessage.sender_name.is_not(None))
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
            "last_message": message.text,
            "unread_count": unread.get(jid, 0),
            "updated_at": message.timestamp,
        }
        for jid, message in last_by_jid.items()
    ]
    chats.sort(key=lambda c: c["updated_at"], reverse=True)
    return chats
