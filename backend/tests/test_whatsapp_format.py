# backend/tests/test_whatsapp_format.py
from app.services.whatsapp_format import (
    display_name,
    extract_media,
    format_phone,
    media_kind_for_upload,
    message_preview,
    phone_from_jid,
)


def test_format_phone_brazil_mobile_and_landline():
    assert format_phone("5516991234567") == "+55 16 99123-4567"
    assert format_phone("551635230764") == "+55 16 3523-0764"


def test_format_phone_foreign_and_empty():
    assert format_phone("14155550123") == "+14155550123"
    assert format_phone("") == ""


def test_phone_from_jid_only_for_real_numbers():
    assert phone_from_jid("551635230764@s.whatsapp.net") == "+55 16 3523-0764"
    assert phone_from_jid("4574123127004@lid") is None
    assert phone_from_jid("120363411593949838@g.us") is None
    assert phone_from_jid("0@s.whatsapp.net") is None


def test_display_name_never_shows_raw_jid():
    assert display_name("120363@g.us", "120363@g.us", is_group=True, phone=None) == "Grupo sem nome"
    assert display_name("4574@lid", "4574@lid", is_group=False, phone=None) == "Contato sem número"
    assert display_name("5516@s.whatsapp.net", None, is_group=False, phone="+55 16 3523-0764") == "+55 16 3523-0764"
    assert display_name("x@g.us", "  Equipe MKT ", is_group=True, phone=None) == "Equipe MKT"


def test_message_preview_for_media():
    assert message_preview("oi", None) == "oi"
    assert message_preview(None, "image") == "📷 Foto"
    assert message_preview("legenda", "image") == "📷 legenda"
    assert message_preview(None, "document") == "📄 Documento"
    assert message_preview(None, None) is None


def test_extract_media_reads_document_filename_and_sticker():
    msg = {"documentMessage": {"mimetype": "application/pdf", "fileName": "Contrato.pdf"}}
    assert extract_media(msg) == ("document", "application/pdf", "Contrato.pdf")
    assert extract_media({"stickerMessage": {"mimetype": "image/webp"}})[0] == "sticker"
    assert extract_media({"conversation": "oi"}) == (None, None, None)


def test_media_kind_for_upload():
    assert media_kind_for_upload("image/png") == "image"
    assert media_kind_for_upload("video/mp4") == "video"
    assert media_kind_for_upload("application/pdf") == "document"
    assert media_kind_for_upload("image/gif") == "document"


def test_pick_group_name_prefers_subject_and_rejects_sender_names():
    from app.services.whatsapp_format import pick_group_name

    assert pick_group_name("Equipe MKT", "Maria", {"Maria"}) == "Equipe MKT"
    # Nome da agenda igual ao de quem fala no grupo = é o último remetente, não o assunto.
    assert pick_group_name(None, "Maria", {"Maria", "João"}) is None
    assert pick_group_name(None, "Equipe MKT", {"Maria"}) == "Equipe MKT"
    assert pick_group_name("  ", "120363@g.us", set()) is None
