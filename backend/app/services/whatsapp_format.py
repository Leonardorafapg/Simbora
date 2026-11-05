# backend/app/services/whatsapp_format.py
"""Apresentação de números, nomes e prévias do WhatsApp (funções puras)."""

# Rótulo da prévia na lista de conversas quando a última mensagem não tem texto.
_MEDIA_PREVIEW = {
    "image": "📷 Foto",
    "video": "🎥 Vídeo",
    "audio": "🎤 Áudio",
    "document": "📄 Documento",
    "sticker": "Figurinha",
}


def format_phone(number: str) -> str:
    """'5516991234567' -> '+55 16 99123-4567'; formato desconhecido -> '+<número>'."""
    digits = "".join(ch for ch in number if ch.isdigit())
    if digits.startswith("55") and len(digits) in (12, 13):
        ddd, rest = digits[2:4], digits[4:]
        return f"+55 {ddd} {rest[:-4]}-{rest[-4:]}"
    return f"+{digits}" if digits else number


def phone_from_jid(jid: str) -> str | None:
    """Telefone legível de um JID individual; None pra grupo, @lid e contas de sistema."""
    if not jid.endswith("@s.whatsapp.net"):
        return None
    number = jid.split("@", 1)[0]
    # "0@s.whatsapp.net" e afins são contas de sistema, não telefone.
    return format_phone(number) if number.isdigit() and len(number) >= 8 else None


def display_name(jid: str, name: str | None, *, is_group: bool, phone: str | None) -> str:
    """Nome mostrado na lista: nunca devolve o JID cru (120363…@g.us, 4574…@lid)."""
    clean = (name or "").strip()
    if clean and clean != jid and "@" not in clean:
        return clean
    if is_group:
        return "Grupo sem nome"
    if phone:
        return phone
    return "Contato sem número"


def message_preview(text: str | None, media_type: str | None) -> str | None:
    """Texto da última mensagem; mídia sem legenda vira um rótulo ('📷 Foto')."""
    if text:
        return f"{_MEDIA_PREVIEW[media_type].split(' ')[0]} {text}" if media_type in ("image", "video") else text
    return _MEDIA_PREVIEW.get(media_type or "")


def media_kind_for_upload(mimetype: str) -> str:
    """Tipo do `sendMedia` da Evolution a partir do mimetype do arquivo enviado."""
    if mimetype.startswith("image/") and mimetype != "image/gif":
        return "image"
    if mimetype.startswith("video/"):
        return "video"
    return "document"


# Chave da mensagem (Baileys) -> tipo de mídia pra UI.
_MEDIA_KEYS = {
    "imageMessage": "image",
    "videoMessage": "video",
    "audioMessage": "audio",
    "documentMessage": "document",
    "stickerMessage": "sticker",
}


def extract_media(message: dict) -> tuple[str | None, str | None, str | None]:
    """(media_type, mimetype, nome do arquivo) da mensagem, ou Nones se for só texto."""
    for key, media_type in _MEDIA_KEYS.items():
        payload = message.get(key)
        if isinstance(payload, dict):
            return media_type, payload.get("mimetype"), payload.get("fileName")
    return None, None, None


def extract_text(message: dict) -> str | None:
    """Texto (ou legenda) de uma mensagem do Baileys."""
    return (
        message.get("conversation")
        or (message.get("extendedTextMessage") or {}).get("text")
        or (message.get("imageMessage") or {}).get("caption")
        or (message.get("videoMessage") or {}).get("caption")
        or (message.get("documentMessage") or {}).get("caption")
    )


QUOTE_SNIPPET_CHARS = 200


def quote_snippet(text: str | None, media_type: str | None) -> str:
    """Trecho da mensagem citada, curto, pra mostrar no balão e mandar como citação."""
    return (message_preview(text, media_type) or "Mensagem")[:QUOTE_SNIPPET_CHARS]


def extract_quote(message: dict) -> tuple[str, str] | None:
    """(id, trecho) da mensagem que esta responde, ou None. A citação vem no `contextInfo`
    do conteúdo (texto, imagem, vídeo, documento...), com o id em `stanzaId`."""
    for payload in message.values():
        context = payload.get("contextInfo") if isinstance(payload, dict) else None
        if isinstance(context, dict) and context.get("stanzaId"):
            quoted = context.get("quotedMessage") or {}
            return str(context["stanzaId"]), quote_snippet(extract_text(quoted), extract_media(quoted)[0])
    return None


def pick_group_name(subject: str | None, contact_name: str | None, sender_names: set[str]) -> str | None:
    """Nome do grupo: o `subject` do WhatsApp manda. O nome vindo da agenda só vale
    se NÃO for o de alguém que fala no grupo — a Evolution às vezes devolve ali o
    pushName de quem mandou a última mensagem, não o assunto do grupo."""
    if subject and subject.strip():
        return subject.strip()
    candidate = (contact_name or "").strip()
    if candidate and "@" not in candidate and candidate not in sender_names:
        return candidate
    return None


def with_sender_prefix(full_name: str | None, text: str) -> str:
    """Texto como vai pro WhatsApp: "*Brian:*" (negrito) numa linha e a mensagem embaixo, pra o cliente saber
    quem da equipe está falando (o número é compartilhado). No CRM o balão guarda só o texto original."""
    first_name = (full_name or "").strip().split(" ")[0]
    return f"*{first_name}:*\n{text}" if first_name else text
