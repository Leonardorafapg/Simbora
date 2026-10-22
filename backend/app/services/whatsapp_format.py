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
