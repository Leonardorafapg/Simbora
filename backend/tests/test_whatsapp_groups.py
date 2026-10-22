# backend/tests/test_whatsapp_groups.py
"""Nome dos grupos na lista de conversas (Evolution simulada)."""
import pytest

from app.core import evolution_client
from app.routers import whatsapp as router
from app.services import whatsapp_store

GROUP = "120363411593949838@g.us"


@pytest.fixture()
def evolution(monkeypatch):
    state = {"subject": "Equipe MKT Bangalô", "contact_name": "Maria", "lookups": 0}

    async def find_chats():
        return []

    async def find_contacts():
        return [{"remoteJid": GROUP, "pushName": state["contact_name"]}]

    async def find_labels():
        return []

    async def fetch_all_groups():
        return []  # o endpoint lento ainda não trouxe nada

    async def find_group_info(jid):
        state["lookups"] += 1
        return {"id": jid, "subject": state["subject"]} if state["subject"] else {}

    for name, fn in [
        ("find_chats", find_chats), ("find_contacts", find_contacts), ("find_labels", find_labels),
        ("fetch_all_groups", fetch_all_groups), ("find_group_info", find_group_info),
    ]:
        monkeypatch.setattr(evolution_client, name, fn)
    router._group_info.clear()
    router._group_lookup_retry_at.clear()
    router._groups_next_refresh = float("inf")  # sem refresh em segundo plano nos testes
    return state


def _seed(db):
    whatsapp_store.save_message(
        db, message_id="G1", remote_jid=GROUP, from_me=False, text="oi", sender_name="Maria",
        is_group=True, status="recebida", timestamp=1_700_000_000,
    )


def _group_name(api):
    chats = api.get("/api/v1/whatsapp/chats").json()
    return next(c["name"] for c in chats if c["remote_jid"] == GROUP)


def test_group_name_comes_from_group_infos_not_last_sender(api, db, evolution):
    _seed(db)
    assert _group_name(api) == "Equipe MKT Bangalô"


def test_group_never_shows_last_sender_name_when_lookup_fails(api, db, evolution):
    _seed(db)
    evolution["subject"] = None  # consulta do grupo não acha o assunto
    assert _group_name(api) == "Grupo sem nome"  # "Maria" (agenda) é a última a falar: descartada


def test_group_lookup_is_cached_between_requests(api, db, evolution):
    _seed(db)
    _group_name(api)
    _group_name(api)
    assert evolution["lookups"] == 1


def test_failed_lookup_is_not_retried_immediately(api, db, evolution):
    _seed(db)
    evolution["subject"] = None
    _group_name(api)
    _group_name(api)
    assert evolution["lookups"] == 1
