# backend/tests/test_whatsapp_send.py
"""Envio de texto e arquivos pelo WhatsApp (Evolution simulada)."""
import pytest

from app.core import evolution_client

JID = "551635230764@s.whatsapp.net"


@pytest.fixture()
def evolution(monkeypatch):
    calls = {"text": [], "media": []}

    async def fake_text(remote_jid, text):
        calls["text"].append((remote_jid, text))
        return {"key": {"id": "T1", "remoteJid": remote_jid}, "messageTimestamp": 1700000000}

    async def fake_media(remote_jid, **kwargs):
        calls["media"].append((remote_jid, kwargs))
        return {"key": {"id": "M1", "remoteJid": remote_jid}, "messageTimestamp": 1700000001}

    monkeypatch.setattr(evolution_client, "send_text_message", fake_text)
    monkeypatch.setattr(evolution_client, "send_media_base64", fake_media)
    return calls


def test_send_text(api, evolution):
    res = api.post(f"/api/v1/whatsapp/chats/{JID}/messages", json={"text": "Olá"})
    assert res.status_code == 200
    assert res.json()["text"] == "Olá" and res.json()["from_me"] is True
    assert evolution["text"] == [(JID, "Olá")]


def test_send_blank_text_is_rejected(api, evolution):
    assert api.post(f"/api/v1/whatsapp/chats/{JID}/messages", json={"text": "   "}).status_code == 422
    assert evolution["text"] == []


def test_send_pdf_keeps_filename_and_kind(api, evolution):
    res = api.post(
        f"/api/v1/whatsapp/chats/{JID}/media",
        files={"file": ("Contrato.pdf", b"%PDF-1.4 fake", "application/pdf")},
        data={"caption": "Segue o contrato"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["media_type"] == "document" and body["media_filename"] == "Contrato.pdf"
    assert body["text"] == "Segue o contrato"
    _, kwargs = evolution["media"][0]
    assert kwargs["media_kind"] == "document" and kwargs["file_name"] == "Contrato.pdf"


def test_send_image_uses_image_kind(api, evolution):
    res = api.post(f"/api/v1/whatsapp/chats/{JID}/media", files={"file": ("foto.png", b"\x89PNG fake", "image/png")})
    assert res.status_code == 200 and res.json()["media_type"] == "image"


def test_send_empty_file_is_rejected(api, evolution):
    res = api.post(f"/api/v1/whatsapp/chats/{JID}/media", files={"file": ("a.pdf", b"", "application/pdf")})
    assert res.status_code == 400 and evolution["media"] == []


def test_send_oversized_file_is_rejected(api, evolution, monkeypatch):
    from app.routers import whatsapp

    monkeypatch.setattr(whatsapp, "MAX_UPLOAD_BYTES", 10)
    res = api.post(f"/api/v1/whatsapp/chats/{JID}/media", files={"file": ("a.pdf", b"x" * 11, "application/pdf")})
    assert res.status_code == 413 and evolution["media"] == []
