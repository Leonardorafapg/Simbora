# backend/tests/test_whatsapp_dedupe.py
"""Contato com dois identificadores (@lid e número) vira UMA conversa; nomes de grupo ficam salvos no banco."""
import asyncio

import httpx
import pytest
from fastapi.testclient import TestClient

from app.core import evolution_client
from app.core.config import settings
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.user import User
from app.models.whatsapp_alias import WhatsAppJidAlias
from app.models.whatsapp_chat_label import WhatsAppChatLabel
from app.models.whatsapp_group import WhatsAppGroup
from app.models.whatsapp_message import WhatsAppMessage
from app.routers import whatsapp as router
from app.services import whatsapp_aliases, whatsapp_groups, whatsapp_store

LID = "55336476123182@lid"
PHONE = "559892134081@s.whatsapp.net"
GROUP = "120363349464612830@g.us"
SECRET = "segredo-de-teste"


# --- helpers ------------------------------------------------------------------------------------


def save(db, jid, text, *, message_id, from_me=False, name=None, ts=1_700_000_000):
    return whatsapp_store.save_message(
        db, message_id=message_id, remote_jid=jid, from_me=from_me, text=text, sender_name=name,
        is_group=jid.endswith("@g.us"), status="recebida", timestamp=ts,
    )


def webhook(payload: dict):
    return TestClient(app).post("/api/v1/whatsapp/webhook", json=payload, headers={"x-webhook-secret": SECRET})


def upsert(key: dict, text="oi", message_id="M1", ts=1_700_000_100):
    return webhook({
        "event": "messages.upsert",
        "data": {"key": {"id": message_id, "fromMe": False, **key}, "pushName": "Carol", "messageTimestamp": ts, "message": {"conversation": text}},
    })


@pytest.fixture(autouse=True)
def webhook_secret(monkeypatch):
    monkeypatch.setattr(settings, "EVOLUTION_WEBHOOK_SECRET", SECRET)


@pytest.fixture()
def admin(db):
    user = User(
        full_name="Admin", cpf="00000000001", birth_date=__import__("datetime").date(1990, 1, 1), email="adm@a.com",
        password_hash=hash_password("x"), cargo="Admin", is_admin=True, permissions=[],
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture()
def api_admin(admin):
    c = TestClient(app)
    c.headers["Authorization"] = f"Bearer {create_access_token(admin)}"
    return c


@pytest.fixture()
def evolution(monkeypatch):
    """Evolution simulada: sem conversas/contatos/etiquetas, e sem nenhum nome de grupo disponível."""
    state = {"messages": {}, "lookups": 0}

    async def empty():
        return []

    async def find_group_info(jid):
        state["lookups"] += 1
        raise RuntimeError("404")

    async def find_messages(jid, limit=50, page=1):
        return state["messages"].get(jid, [])

    for name in ("find_chats", "find_contacts", "find_labels", "fetch_all_groups"):
        monkeypatch.setattr(evolution_client, name, empty)
    monkeypatch.setattr(evolution_client, "find_group_info", find_group_info)
    monkeypatch.setattr(evolution_client, "find_messages", find_messages)
    router._group_info.clear()
    router._group_lookup_retry_at.clear()
    router._groups_next_refresh = float("inf")
    router._alias_next_run = float("inf")  # sem rodada em segundo plano; os testes chamam o backfill direto
    whatsapp_aliases._next_attempt.clear()
    return state


# --- erro real da Evolution ----------------------------------------------------------------------


def _resp(status, body):
    return httpx.Response(status, json=body)


def test_error_detail_reads_the_real_reason_inside_response_message():
    body = {"status": 404, "error": "Not Found", "response": {"message": ["Error: item-not-found"]}}
    assert evolution_client.error_detail(_resp(404, body)) == "Error: item-not-found"


def test_error_detail_falls_back_gracefully():
    assert evolution_client.error_detail(_resp(400, {"message": "instância inexistente"})) == "instância inexistente"
    assert evolution_client.error_detail(_resp(404, {"status": 404, "error": "Not Found"})) == "Not Found"
    assert evolution_client.error_detail(httpx.Response(502, text="Bad Gateway")) == "Bad Gateway"
    assert evolution_client.error_detail(_resp(500, ["lista", "solta"])) != ""


# --- apelidos -------------------------------------------------------------------------------------------


def test_canonical_jid_prefers_the_phone_and_learns_the_pair(db):
    assert whatsapp_aliases.canonical_jid(db, {"remoteJid": LID, "remoteJidAlt": PHONE}) == PHONE
    assert db.get(WhatsAppJidAlias, LID).phone_jid == PHONE
    # depois disso, mesmo uma mensagem @lid sem o campo extra cai no número
    assert whatsapp_aliases.canonical_jid(db, {"remoteJid": LID}) == PHONE


def test_canonical_jid_leaves_everything_else_alone(db):
    assert whatsapp_aliases.canonical_jid(db, {"remoteJid": PHONE}) == PHONE
    assert whatsapp_aliases.canonical_jid(db, {"remoteJid": GROUP}) == GROUP
    assert whatsapp_aliases.canonical_jid(db, {"remoteJid": LID}) == LID  # número ainda desconhecido
    assert whatsapp_aliases.canonical_jid(db, {"remoteJid": LID, "remoteJidAlt": "lixo"}) == LID
    assert whatsapp_aliases.canonical_jid(db, {}) == ""


def test_learn_ignores_pairs_that_are_not_lid_plus_phone(db):
    assert whatsapp_aliases.learn(db, PHONE, PHONE) is False
    assert whatsapp_aliases.learn(db, LID, GROUP) is False
    assert db.query(WhatsAppJidAlias).count() == 0


def test_merge_moves_messages_and_labels_without_duplicating_labels(db):
    save(db, LID, "da Carol", message_id="A")
    save(db, PHONE, "minha", message_id="B", from_me=True)
    db.add_all([
        WhatsAppChatLabel(remote_jid=LID, label_id="1"), WhatsAppChatLabel(remote_jid=LID, label_id="2"),
        WhatsAppChatLabel(remote_jid=PHONE, label_id="2"),
    ])
    db.commit()

    assert whatsapp_aliases.merge_lid_into_phone(db, LID, PHONE) == 1
    assert whatsapp_aliases.merge_lid_into_phone(db, LID, PHONE) == 0  # idempotente

    db.expire_all()
    assert {m.remote_jid for m in db.query(WhatsAppMessage).all()} == {PHONE}
    assert sorted(l.label_id for l in db.query(WhatsAppChatLabel).filter_by(remote_jid=PHONE)) == ["1", "2"]
    assert db.query(WhatsAppChatLabel).filter_by(remote_jid=LID).count() == 0


# --- webhook ---------------------------------------------------------------------------------------------


def test_webhook_stores_lid_messages_under_the_phone_and_merges_the_old_chat(db):
    save(db, LID, "mensagem antiga (antes de sabermos o número)", message_id="OLD")
    save(db, PHONE, "resposta nossa", message_id="OUR", from_me=True)

    assert upsert({"remoteJid": LID, "remoteJidAlt": PHONE}, "oi de novo", "NEW").status_code == 204

    db.expire_all()
    assert {m.remote_jid for m in db.query(WhatsAppMessage).all()} == {PHONE}
    assert db.query(WhatsAppMessage).count() == 3


def test_webhook_keeps_a_lid_chat_when_the_number_is_unknown_and_joins_it_later(db):
    upsert({"remoteJid": LID}, "primeira", "M1")
    assert {m.remote_jid for m in db.query(WhatsAppMessage).all()} == {LID}
    upsert({"remoteJid": LID, "remoteJidAlt": PHONE}, "segunda", "M2")
    db.expire_all()
    assert {m.remote_jid for m in db.query(WhatsAppMessage).all()} == {PHONE}


def test_label_and_presence_events_follow_the_alias(db):
    whatsapp_aliases.learn(db, LID, PHONE)
    webhook({"event": "labels.association", "data": {"type": "add", "chatId": LID, "labelId": "7"}})
    db.expire_all()
    assert [l.remote_jid for l in db.query(WhatsAppChatLabel).all()] == [PHONE]


# --- lista e mensagens ------------------------------------------------------------------------------------


def test_chat_list_shows_one_conversation_per_person(db, api_admin, evolution):
    save(db, LID, "tá bem", message_id="A", name="Carol", ts=1_700_000_200)
    save(db, PHONE, "Você: tá bem", message_id="B", from_me=True, ts=1_700_000_100)
    whatsapp_aliases.learn(db, LID, PHONE)

    chats = api_admin.get("/api/v1/whatsapp/chats").json()
    assert [c["remote_jid"] for c in chats] == [PHONE]
    assert chats[0]["last_message"] == "tá bem"  # a mais recente das duas


def test_opening_the_old_lid_address_shows_the_whole_conversation(db, api_admin, evolution):
    save(db, LID, "a", message_id="A", ts=1)
    save(db, PHONE, "b", message_id="B", ts=2, from_me=True)
    whatsapp_aliases.learn(db, LID, PHONE)

    by_lid = api_admin.get(f"/api/v1/whatsapp/chats/{LID}/messages").json()
    assert [m["text"] for m in by_lid] == ["a", "b"] and {m["remote_jid"] for m in by_lid} == {PHONE}


def test_sending_to_a_lid_chat_goes_to_the_phone(db, api_admin, evolution, monkeypatch):
    whatsapp_aliases.learn(db, LID, PHONE)
    sent = []

    async def fake_send(jid, text):
        sent.append(jid)
        return {"key": {"id": "S1", "remoteJid": LID}, "messageTimestamp": 1_700_000_300}

    monkeypatch.setattr(evolution_client, "send_text_message", fake_send)
    res = api_admin.post(f"/api/v1/whatsapp/chats/{LID}/messages", json={"text": "oi"})
    assert res.status_code == 200 and sent == [PHONE] and res.json()["remote_jid"] == PHONE


# --- descobrir o número de conversas antigas ----------------------------------------------------------------


def test_backfill_discovers_the_phone_from_old_messages(db, evolution):
    save(db, LID, "antiga", message_id="A")
    evolution["messages"][LID] = [{"key": {"id": "A", "remoteJid": LID, "remoteJidAlt": PHONE}}]

    result = asyncio.run(whatsapp_aliases.backfill(db))

    assert result["found"] == 1
    db.expire_all()
    assert db.query(WhatsAppMessage).one().remote_jid == PHONE


def test_backfill_does_not_hammer_evolution_for_unresolvable_chats(db, evolution, monkeypatch):
    save(db, LID, "sem número", message_id="A")
    calls = []

    async def find_messages(jid, limit=50, page=1):
        calls.append(jid)
        return [{"key": {"id": "A", "remoteJid": LID}}]  # sem remoteJidAlt

    monkeypatch.setattr(evolution_client, "find_messages", find_messages)
    assert asyncio.run(whatsapp_aliases.backfill(db))["found"] == 0
    assert asyncio.run(whatsapp_aliases.backfill(db))["found"] == 0
    assert calls == [LID]  # a 2ª rodada pulou: tentou há pouco


def test_merge_contacts_endpoint_is_admin_only_and_reports(db, api_admin, evolution):
    save(db, LID, "x", message_id="A")
    evolution["messages"][LID] = [{"key": {"id": "A", "remoteJid": LID, "remoteJidAlt": PHONE}}]
    body = api_admin.post("/api/v1/whatsapp/maintenance/merge-contacts").json()
    assert body["descobertos"]["found"] == 1 and body["ainda_separados"] == 0

    plain = User(
        full_name="Comum", cpf="00000000002", birth_date=__import__("datetime").date(1990, 1, 1), email="c@a.com",
        password_hash=hash_password("x"), cargo="Social", is_admin=False, permissions=["whatsapp.view"],
    )
    db.add(plain)
    db.commit()
    other = TestClient(app)
    other.headers["Authorization"] = f"Bearer {create_access_token(plain)}"
    assert other.post("/api/v1/whatsapp/maintenance/merge-contacts").status_code == 403


# --- nome dos grupos guardado no banco -------------------------------------------------------------------------


def test_group_names_are_saved_and_loaded(db):
    assert whatsapp_groups.save(db, [
        {"id": GROUP, "subject": "Equipe MKT", "size": 12, "desc": "Alinhamentos"},
        {"id": "outro@g.us", "subject": "   "},  # sem nome: ignorado
        {"id": PHONE, "subject": "não é grupo"},
    ]) == 1
    assert whatsapp_groups.load(db) == {GROUP: {"id": GROUP, "subject": "Equipe MKT", "size": 12, "desc": "Alinhamentos"}}


def test_a_name_only_update_keeps_size_and_description(db):
    whatsapp_groups.save(db, [{"id": GROUP, "subject": "Antigo", "size": 5, "desc": "d"}])
    whatsapp_groups.save(db, [{"id": GROUP, "subject": "Novo nome"}])  # group.update só traz o assunto
    row = db.get(WhatsAppGroup, GROUP)
    assert (row.subject, row.size, row.description) == ("Novo nome", 5, "d")


def test_group_name_survives_a_restart_without_asking_evolution_again(db, api_admin, evolution):
    save(db, GROUP, "oi", message_id="G1", name="Maria")
    whatsapp_groups.save(db, [{"id": GROUP, "subject": "Equipe MKT Bangalô"}])  # descoberto antes do "deploy"

    name = next(c["name"] for c in api_admin.get("/api/v1/whatsapp/chats").json() if c["remote_jid"] == GROUP)
    assert name == "Equipe MKT Bangalô"
    assert evolution["lookups"] == 0  # já sabia: não perguntou


def test_successful_individual_lookup_is_saved_for_next_time(db, api_admin, evolution, monkeypatch):
    save(db, GROUP, "oi", message_id="G1", name="Maria")

    async def found(jid):
        return {"id": jid, "subject": "Grupo Descoberto", "size": 3}

    monkeypatch.setattr(evolution_client, "find_group_info", found)
    api_admin.get("/api/v1/whatsapp/chats")
    assert db.get(WhatsAppGroup, GROUP) is not None and db.get(WhatsAppGroup, GROUP).subject == "Grupo Descoberto"


def test_group_events_from_the_webhook_store_the_name(db):
    webhook({"event": "groups.upsert", "data": [{"id": GROUP, "subject": "Grupo Novo", "size": 4}]})
    webhook({"event": "group.update", "data": [{"id": GROUP, "subject": "Grupo Renomeado"}]})
    db.expire_all()
    assert db.get(WhatsAppGroup, GROUP).subject == "Grupo Renomeado"


def test_group_events_registered_in_the_webhook_subscription():
    import inspect

    source = inspect.getsource(evolution_client.set_webhook)
    assert "GROUPS_UPSERT" in source and "GROUP_UPDATE" in source


def test_fetch_all_groups_waits_long_enough():
    assert evolution_client.FETCH_ALL_GROUPS_TIMEOUT >= 240


# --- rodada 2: o que apareceu em produção ---------------------------------------------------------------------


def test_media_of_a_merged_chat_is_fetched_from_the_original_lid_address(db, api_admin, evolution, monkeypatch):
    """A Evolution guarda a mensagem no endereço @lid original: pedir pelo número dava 400 ('ephemeralMessage')."""
    from fastapi import HTTPException

    whatsapp_store.save_message(
        db, message_id="IMG1", remote_jid=LID, from_me=False, text=None, sender_name="Carol", is_group=False,
        status="recebida", timestamp=1, media_type="image", media_mimetype="image/png",
    )
    whatsapp_aliases.learn(db, LID, PHONE)
    whatsapp_aliases.merge_lid_into_phone(db, LID, PHONE)
    tried = []

    async def fake_media(jid, message_id, from_me):
        tried.append(jid)
        if jid != LID:
            raise HTTPException(status_code=502, detail="Evolution API retornou erro: TypeError ... 'ephemeralMessage'")
        return {"base64": "aGVsbG8=", "mimetype": "image/png"}

    monkeypatch.setattr(evolution_client, "get_media_base64", fake_media)
    res = api_admin.get(f"/api/v1/whatsapp/chats/{PHONE}/messages/IMG1/media")
    assert res.status_code == 200 and res.content == b"hello"
    assert tried == [PHONE, LID]


def test_media_error_is_kept_when_no_address_works(db, api_admin, evolution, monkeypatch):
    from fastapi import HTTPException

    whatsapp_store.save_message(
        db, message_id="IMG2", remote_jid=PHONE, from_me=False, text=None, sender_name=None, is_group=False,
        status="recebida", timestamp=1, media_type="image", media_mimetype="image/png",
    )

    async def fail(jid, message_id, from_me):
        raise HTTPException(status_code=502, detail="falhou")

    monkeypatch.setattr(evolution_client, "get_media_base64", fail)
    assert api_admin.get(f"/api/v1/whatsapp/chats/{PHONE}/messages/IMG2/media").status_code == 502


def test_evolution_only_lid_chat_is_merged_using_its_last_message(db, api_admin, evolution, monkeypatch):
    """O "Lula_Luiz" repetido: uma conversa no banco (número) e outra que só existe na lista da Evolution (@lid)."""
    save(db, PHONE, "Vai ter alguma filmagem amanhã?", message_id="A", name="Lula_Luiz", ts=1_700_000_100)

    async def find_chats():
        return [{
            "remoteJid": LID, "pushName": "Lula_Luiz", "updatedAt": "2026-10-27T22:54:00Z",
            "lastMessage": {"key": {"id": "A", "remoteJid": LID, "remoteJidAlt": PHONE}, "message": {"conversation": "Vai ter alguma filmagem amanhã?"}},
        }]

    monkeypatch.setattr(evolution_client, "find_chats", find_chats)
    chats = api_admin.get("/api/v1/whatsapp/chats").json()
    assert [c["remote_jid"] for c in chats] == [PHONE]
    assert db.get(WhatsAppJidAlias, LID).phone_jid == PHONE


def test_evolution_only_lid_chat_without_hint_goes_to_the_backfill(db, evolution):
    evolution["messages"][LID] = [{"key": {"id": "X", "remoteJid": LID, "remoteJidAlt": PHONE}}]
    assert whatsapp_aliases.unresolved_lids(db, extra=[LID, PHONE]) == [LID]  # só @lid entra
    result = asyncio.run(whatsapp_aliases.backfill(db, extra=[LID]))
    assert result["found"] == 1 and db.get(WhatsAppJidAlias, LID).phone_jid == PHONE


def test_group_lookups_are_few_and_one_at_a_time(db, api_admin, evolution, monkeypatch):
    for i in range(10):
        save(db, f"12036300000000{i:02d}@g.us", "oi", message_id=f"G{i}", name="Maria")
    in_flight, peak, calls = [0], [0], []

    async def slow(jid):
        in_flight[0] += 1
        peak[0] = max(peak[0], in_flight[0])
        calls.append(jid)
        await asyncio.sleep(0.01)
        in_flight[0] -= 1
        return {"id": jid, "subject": f"Grupo {jid[-6:]}"}

    monkeypatch.setattr(evolution_client, "find_group_info", slow)
    api_admin.get("/api/v1/whatsapp/chats")
    assert len(calls) == router._GROUP_LOOKUP_MAX_PER_REQUEST <= 3
    assert peak[0] == 1


def test_rate_overlimit_pauses_the_lookups(db, api_admin, evolution, monkeypatch):
    from fastapi import HTTPException

    for i in range(3):
        save(db, f"12036300000000{i:02d}@g.us", "oi", message_id=f"G{i}", name="Maria")
    calls = []

    async def limited(jid):
        calls.append(jid)
        raise HTTPException(status_code=502, detail="Evolution API retornou erro: Error fetching group; Error: rate-overlimit")

    monkeypatch.setattr(evolution_client, "find_group_info", limited)
    router._group_lookups_paused_until = 0.0
    api_admin.get("/api/v1/whatsapp/chats")
    api_admin.get("/api/v1/whatsapp/chats")
    assert len(calls) == 1  # parou no primeiro bloqueio e não insistiu na segunda abertura
    router._group_lookups_paused_until = 0.0


def test_no_individual_lookups_while_the_full_group_fetch_is_running(db, api_admin, evolution, monkeypatch):
    save(db, GROUP, "oi", message_id="G1", name="Maria")

    class Running:
        def done(self):
            return False

    monkeypatch.setattr(router, "_groups_refresh_task", Running())
    api_admin.get("/api/v1/whatsapp/chats")
    assert evolution["lookups"] == 0
