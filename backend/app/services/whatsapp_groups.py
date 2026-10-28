# backend/app/services/whatsapp_groups.py
"""Nome dos grupos persistido no banco (ver models/whatsapp_group.py)."""
from collections.abc import Iterable
from typing import Any

from sqlalchemy.orm import Session

from app.models.whatsapp_group import WhatsAppGroup


def load(db: Session) -> dict[str, dict[str, Any]]:
    """jid -> {id, subject, size, desc} no mesmo formato que a Evolution devolve (o router usa direto)."""
    return {
        g.jid: {"id": g.jid, "subject": g.subject, "size": g.size, "desc": g.description}
        for g in db.query(WhatsAppGroup).all()
    }


def _clean(raw: dict[str, Any]) -> tuple[str, dict[str, Any]] | None:
    jid = raw.get("id") or raw.get("remoteJid") or raw.get("groupJid") or ""
    subject = (raw.get("subject") or "").strip()
    if not jid.endswith("@g.us") or not subject:
        return None
    return jid, {"subject": subject[:255], "size": raw.get("size"), "description": raw.get("desc") or raw.get("description")}


def save(db: Session, groups: Iterable[dict[str, Any]]) -> int:
    """Grava/atualiza os grupos que têm nome (ignora o resto). Devolve quantos foram gravados."""
    saved = 0
    for raw in groups:
        if not isinstance(raw, dict):
            continue
        cleaned = _clean(raw)
        if cleaned is None:
            continue
        jid, fields = cleaned
        row = db.get(WhatsAppGroup, jid)
        if row is None:
            db.add(WhatsAppGroup(jid=jid, **fields))
        else:
            # Evento que só traz o nome não pode apagar o tamanho/descrição já conhecidos.
            row.subject = fields["subject"]
            if fields["size"] is not None:
                row.size = fields["size"]
            if fields["description"] is not None:
                row.description = fields["description"]
        saved += 1
    db.commit()
    return saved
