# backend/tests/test_whatsapp_reply.py
"""Responder uma mensagem (citação) pelo WhatsApp: envio, mensagem recebida com citação e formato."""
import pytest
from fastapi.testclient import TestClient

from app.core import evolution_client
from app.core.config import settings
from app.main import app
from app.models.whatsapp_message import WhatsAppMessage
from app.services import whatsapp_store
from app.services.whatsapp_format import extract_quote

JID = "551635230764@s.whatsapp.net"
OTHER = "559892134081@s.whatsapp.net"
GROUP = "120363349464612830@g.us"
SECRET = "segredo-de-teste"


def save(db, jid, text, *, message_id, from_me=False, name=None, sender_jid=None, ts=1_700_000_000, **kw):
    return whatsapp_store.save_message(
        db, message_id=message_id, remote_jid=jid, from_me=from_me, text=text, sender_name=name,
        is_group=jid.endswith("@g.us"), status="recebida", timestamp=ts, sender_jid=sender_jid, **kw,
    )


@pytest.fixture()
def evolution(monkeypatch):
    calls = {"text": [], "media": []}

    async def fake_text(remote_jid, text, quoted=None):
        calls["text"].append((remote_jid, text, quoted))
        return {"key": {"id": "R1", "remoteJid": remote_jid}, "messageTimestamp": 1700000500}

    async def fake_media(remote_jid, **kwargs):
        calls["media"].append((remote_jid, kwargs))
        return {"key": {"id": "R2", "remoteJid": remote_jid}, "messageTimestamp": 1700000501}

    monkeypatch.setattr(evolution_client, "send_text_message", fake_text)
    monkeypatch.setattr(evolution_client, "send_media_base64", fake_media)
    return calls


def send(api, jid, text="Respondendo", **extra):
    return api.post(f"/api/v1/whatsapp/chats/{jid}/messages", json={"text": text, **extra})


def test_reply_sends_the_quote_to_evolution_and_stores_it(api, db, evolution):
    save(db, JID, "Pode me mandar o orçamento?", message_id="Q1", name="Carol")

    res = send(api, JID, reply_to_id="Q1")

    assert res.status_code == 200
    body = res.json()
    assert (body["reply_to_id"], body["reply_text"], body["reply_from_me"], body["reply_author"]) == (
        "Q1", "Pode me mandar o orçamento?", False, "Carol",
    )
    (_, _, quoted) = evolution["text"][0]
    assert quoted == {
        "key": {"id": "Q1", "remoteJid": JID, "fromMe": False},
        "message": {"conversation": "Pode me mandar o orçamento?"},
    }
    db.expire_all()
    assert db.query(WhatsAppMessage).filter_by(message_id="R1").one().reply_to_id == "Q1"


def test_reply_in_a_group_quotes_the_participant(api, db, evolution):
    save(db, GROUP, "Bom dia", message_id="G1", name="Carol", sender_jid="559811112222")

    send(api, GROUP, reply_to_id="G1")

    quoted = evolution["text"][0][2]
    assert quoted["key"]["participant"] == "559811112222@s.whatsapp.net"


def test_reply_to_our_own_message_has_no_author(api, db, evolution):
    save(db, JID, "Segue a proposta", message_id="E1", from_me=True)

    body = send(api, JID, reply_to_id="E1").json()

    assert body["reply_from_me"] is True and body["reply_author"] is None


def test_plain_send_does_not_send_a_quote(api, evolution):
    send(api, JID)
    assert evolution["text"][0][2] is None


def test_reply_to_unknown_or_other_chat_message_is_rejected(api, db, evolution):
    save(db, OTHER, "De outra conversa", message_id="X1")

    assert send(api, JID, reply_to_id="nao-existe").status_code == 404
    assert send(api, JID, reply_to_id="X1").status_code == 404
    assert evolution["text"] == []


def test_media_can_be_a_reply_too(api, db, evolution):
    save(db, JID, "Manda a arte?", message_id="Q2")

    res = api.post(
        f"/api/v1/whatsapp/chats/{JID}/media",
        files={"file": ("arte.png", b"\x89PNG fake", "image/png")},
        data={"reply_to_id": "Q2"},
    )

    assert res.status_code == 200 and res.json()["reply_to_id"] == "Q2"
    assert evolution["media"][0][1]["quoted"]["key"]["id"] == "Q2"


def test_incoming_reply_from_the_webhook_keeps_the_quote(api, db, monkeypatch):
    monkeypatch.setattr(settings, "EVOLUTION_WEBHOOK_SECRET", SECRET)
    save(db, JID, "Segue a proposta", message_id="E1", from_me=True)

    res = TestClient(app).post(
        "/api/v1/whatsapp/webhook",
        headers={"x-webhook-secret": SECRET},
        json={
            "event": "messages.upsert",
            "data": {
                "key": {"id": "IN1", "remoteJid": JID, "fromMe": False},
                "pushName": "Carol",
                "messageTimestamp": 1700000900,
                "message": {
                    "extendedTextMessage": {
                        "text": "Fechado!",
                        "contextInfo": {"stanzaId": "E1", "quotedMessage": {"conversation": "Segue a proposta"}},
                    }
                },
            },
        },
    )

    assert res.status_code == 204
    db.expire_all()
    row = db.query(WhatsAppMessage).filter_by(message_id="IN1").one()
    assert (row.reply_to_id, row.reply_text, row.reply_from_me) == ("E1", "Segue a proposta", True)
    listed = api.get(f"/api/v1/whatsapp/chats/{JID}/messages").json()
    assert [m["reply_to_id"] for m in listed] == [None, "E1"]


def test_extract_quote_reads_text_media_and_ignores_plain_messages():
    assert extract_quote({"conversation": "oi"}) is None
    assert extract_quote({"extendedTextMessage": {"text": "ok", "contextInfo": {"stanzaId": "A", "quotedMessage": {"conversation": "x" * 300}}}}) == (
        "A", "x" * 200,
    )
    photo = {"imageMessage": {"caption": "ok", "contextInfo": {"stanzaId": "B", "quotedMessage": {"imageMessage": {"mimetype": "image/png"}}}}}
    assert extract_quote(photo) == ("B", "📷 Foto")
