# backend/tests/test_whatsapp_avatars.py
"""Foto de quem manda mensagem num grupo, ao lado do balão."""
import asyncio
from datetime import date

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.core import evolution_client
from app.core.config import settings
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.user import User
from app.models.whatsapp_message import WhatsAppMessage
from app.services import whatsapp_aliases, whatsapp_avatars

GROUP = "120363349464612830@g.us"
GABRIEL = "559891234567@s.whatsapp.net"
GABRIEL_LID = "4574123127004@lid"
LUIZ = "559899998888@s.whatsapp.net"
SECRET = "segredo-de-teste"


@pytest.fixture(autouse=True)
def clean(monkeypatch):
    monkeypatch.setattr(settings, "EVOLUTION_WEBHOOK_SECRET", SECRET)
    whatsapp_avatars.reset()
    yield
    whatsapp_avatars.reset()


@pytest.fixture()
def api(db):
    user = User(
        full_name="Admin", cpf="00000000009", birth_date=date(1990, 1, 1), email="av@a.com",
        password_hash=hash_password("x"), cargo="Admin", is_admin=True, permissions=[],
    )
    db.add(user)
    db.commit()
    c = TestClient(app)
    c.headers["Authorization"] = f"Bearer {create_access_token(user)}"
    return c


@pytest.fixture()
def evolution(monkeypatch):
    state = {"contacts": [], "pictures": {}, "fetches": [], "contact_reads": 0, "rate_limited": False}

    async def find_contacts():
        state["contact_reads"] += 1
        return state["contacts"]

    async def fetch_profile_picture(jid):
        state["fetches"].append(jid)
        if state["rate_limited"]:
            raise HTTPException(status_code=502, detail="Evolution API retornou erro: rate-overlimit")
        return state["pictures"].get(jid)

    monkeypatch.setattr(evolution_client, "find_contacts", find_contacts)
    monkeypatch.setattr(evolution_client, "fetch_profile_picture", fetch_profile_picture)
    return state


def group_message(key_extra: dict, message_id="G1"):
    return TestClient(app).post(
        "/api/v1/whatsapp/webhook",
        headers={"x-webhook-secret": SECRET},
        json={"event": "messages.upsert", "data": {
            "key": {"id": message_id, "remoteJid": GROUP, "fromMe": False, **key_extra},
            "pushName": "Gabriel Gonçalves", "messageTimestamp": 1_700_000_000, "message": {"conversation": "Tu sai q hrs"},
        }},
    )


# --- quem mandou ----------------------------------------------------------------------------------


def test_sender_of_prefers_the_phone():
    assert whatsapp_aliases.sender_of({"participant": GABRIEL_LID, "participantAlt": GABRIEL}) == GABRIEL
    assert whatsapp_aliases.sender_of({"participant": GABRIEL_LID}) == GABRIEL_LID
    assert whatsapp_aliases.sender_of({"participant": GABRIEL_LID, "participantAlt": "lixo"}) == GABRIEL_LID
    assert whatsapp_aliases.sender_of({}) is None


def test_group_message_from_the_webhook_keeps_who_sent_it(db):
    assert group_message({"participant": GABRIEL_LID, "participantAlt": GABRIEL}).status_code == 204
    db.expire_all()
    assert db.query(WhatsAppMessage).one().sender_jid == GABRIEL


def test_private_chat_message_has_no_sender_jid(db):
    TestClient(app).post(
        "/api/v1/whatsapp/webhook", headers={"x-webhook-secret": SECRET},
        json={"event": "messages.upsert", "data": {"key": {"id": "P1", "remoteJid": LUIZ, "fromMe": False}, "message": {"conversation": "oi"}, "messageTimestamp": 1}},
    )
    db.expire_all()
    assert db.query(WhatsAppMessage).one().sender_jid is None


def test_messages_api_returns_sender_jid(db, api, monkeypatch):
    group_message({"participant": GABRIEL})
    monkeypatch.setattr(evolution_client, "find_messages", lambda *a, **k: [])
    body = api.get(f"/api/v1/whatsapp/chats/{GROUP}/messages").json()
    assert body[0]["sender_jid"] == GABRIEL


# --- fotos -----------------------------------------------------------------------------------------


def test_pictures_come_from_the_contact_list_in_one_call(api, evolution):
    evolution["contacts"] = [
        {"remoteJid": GABRIEL, "profilePicUrl": "https://pps.whatsapp.net/gabriel.jpg"},
        {"remoteJid": LUIZ, "profilePicUrl": "https://pps.whatsapp.net/luiz.jpg"},
    ]
    res = api.post("/api/v1/whatsapp/avatars", json={"jids": [GABRIEL, LUIZ]})
    assert res.json() == {GABRIEL: "https://pps.whatsapp.net/gabriel.jpg", LUIZ: "https://pps.whatsapp.net/luiz.jpg"}
    assert evolution["fetches"] == [] and evolution["contact_reads"] == 1


def test_picture_is_found_under_the_other_identifier_of_the_same_person(db, api, evolution):
    whatsapp_aliases.learn(db, GABRIEL_LID, GABRIEL)
    evolution["contacts"] = [{"remoteJid": GABRIEL_LID, "profilePicUrl": "https://pps.whatsapp.net/g.jpg"}]
    assert api.post("/api/v1/whatsapp/avatars", json={"jids": [GABRIEL]}).json() == {GABRIEL: "https://pps.whatsapp.net/g.jpg"}


def test_missing_pictures_are_asked_one_by_one_and_cached(api, evolution):
    evolution["pictures"] = {GABRIEL: "https://pps.whatsapp.net/gabriel.jpg"}  # não está na agenda
    assert api.post("/api/v1/whatsapp/avatars", json={"jids": [GABRIEL, LUIZ]}).json() == {
        GABRIEL: "https://pps.whatsapp.net/gabriel.jpg", LUIZ: None,
    }
    api.post("/api/v1/whatsapp/avatars", json={"jids": [GABRIEL, LUIZ]})
    assert evolution["fetches"] == [GABRIEL, LUIZ]  # 2ª vez vem do cache (inclusive quem não tem foto)
    assert evolution["contact_reads"] == 1


def test_individual_lookups_are_capped_per_call(api, evolution):
    jids = [f"55989000000{i:02d}@s.whatsapp.net" for i in range(12)]
    body = api.post("/api/v1/whatsapp/avatars", json={"jids": jids}).json()
    assert len(evolution["fetches"]) == whatsapp_avatars.MAX_LOOKUPS_PER_CALL
    assert set(body) == set(jids)  # os outros voltam null, pra tentar na próxima
    api.post("/api/v1/whatsapp/avatars", json={"jids": jids})
    assert len(evolution["fetches"]) == 2 * whatsapp_avatars.MAX_LOOKUPS_PER_CALL  # e são perguntados depois


def test_rate_overlimit_pauses_the_lookups(api, evolution):
    evolution["rate_limited"] = True
    api.post("/api/v1/whatsapp/avatars", json={"jids": [GABRIEL, LUIZ]})
    api.post("/api/v1/whatsapp/avatars", json={"jids": [GABRIEL, LUIZ]})
    assert evolution["fetches"] == [GABRIEL]  # parou no bloqueio e não insistiu


def test_contact_list_failure_does_not_break_the_screen(api, evolution, monkeypatch):
    async def boom():
        raise HTTPException(status_code=502, detail="Evolution fora do ar")

    monkeypatch.setattr(evolution_client, "find_contacts", boom)
    assert api.post("/api/v1/whatsapp/avatars", json={"jids": [GABRIEL]}).status_code == 200


def test_avatars_need_login_and_cap_the_list(api, evolution):
    assert TestClient(app).post("/api/v1/whatsapp/avatars", json={"jids": [GABRIEL]}).status_code == 401
    too_many = [f"5598{i:09d}@s.whatsapp.net" for i in range(whatsapp_avatars.MAX_JIDS_PER_CALL + 1)]
    assert api.post("/api/v1/whatsapp/avatars", json={"jids": too_many}).status_code == 422


def test_pictures_service_skips_empty_and_repeated(evolution):
    evolution["contacts"] = [{"remoteJid": GABRIEL, "profilePicUrl": "u"}]
    assert asyncio.run(whatsapp_avatars.pictures(["", GABRIEL, GABRIEL])) == {GABRIEL: "u"}
