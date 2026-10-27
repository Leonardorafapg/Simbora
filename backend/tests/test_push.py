# backend/tests/test_push.py
"""Notificação push no celular (Web Push) — o serviço de push do navegador é simulado."""
import base64
import json
from datetime import date
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from py_vapid import Vapid
from pywebpush import WebPushException

from app.core.config import settings
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.push_subscription import PushSubscription
from app.models.user import User
from app.scripts.generate_vapid import generate
from app.services import push

ENDPOINT = "https://fcm.googleapis.com/fcm/send/abc123"
KEYS = {"p256dh": "BPubKeyFromBrowser", "auth": "authSecret"}


def make_user(db, n: int, *, admin: bool = False) -> User:
    user = User(
        full_name=f"Pessoa {n}", cpf=f"3000000000{n}", birth_date=date(1990, 1, 1), email=f"r{n}@x.com",
        password_hash=hash_password("x"), cargo="Designer", is_admin=admin, permissions=[],
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def api_as(user: User) -> TestClient:
    c = TestClient(app)
    c.headers["Authorization"] = f"Bearer {create_access_token(user)}"
    return c


@pytest.fixture()
def ana(db):
    return make_user(db, 1)


@pytest.fixture()
def bia(db):
    return make_user(db, 2)


@pytest.fixture()
def vapid_on(monkeypatch):
    public, private = generate()
    monkeypatch.setattr(settings, "VAPID_PUBLIC_KEY", public)
    monkeypatch.setattr(settings, "VAPID_PRIVATE_KEY", private)
    return public


@pytest.fixture()
def sent(monkeypatch):
    """Substitui o envio real: guarda cada push e deixa o teste escolher o resultado por endpoint."""
    calls, failures = [], {}

    def fake_webpush(subscription_info, data=None, vapid_private_key=None, vapid_claims=None, **kwargs):
        calls.append({"endpoint": subscription_info["endpoint"], "data": json.loads(data), "claims": vapid_claims, "ttl": kwargs.get("ttl")})
        status = failures.get(subscription_info["endpoint"])
        if status:
            raise WebPushException("recusado", response=SimpleNamespace(status_code=status))

    monkeypatch.setattr(push, "webpush", fake_webpush)
    calls_view = SimpleNamespace(calls=calls, fail=failures)
    return calls_view


def subscribe(c: TestClient, endpoint: str = ENDPOINT):
    return c.post("/api/v1/push/subscribe", json={"endpoint": endpoint, "keys": KEYS})


# --- chaves -------------------------------------------------------------------------------------


def test_generated_keys_have_the_expected_format_and_work_together():
    public, private = generate()
    pad = lambda s: s + "=" * (-len(s) % 4)  # noqa: E731
    assert len(base64.urlsafe_b64decode(pad(public))) == 65 and base64.urlsafe_b64decode(pad(public))[0] == 4
    assert len(base64.urlsafe_b64decode(pad(private))) == 32
    # a chave privada gerada é aceita pela biblioteca de envio e pertence à mesma chave pública
    vapid = Vapid.from_string(private)
    assert vapid.sign({"aud": "https://fcm.googleapis.com", "sub": "mailto:a@b.com", "exp": 9999999999})


# --- status e inscrição ----------------------------------------------------------------------------


def test_status_reports_disabled_when_keys_are_not_set(ana):
    body = api_as(ana).get("/api/v1/push/status").json()
    assert body == {"enabled": False, "public_key": None, "devices": 0}


def test_status_exposes_only_the_public_key(ana, vapid_on):
    body = api_as(ana).get("/api/v1/push/status").json()
    assert body["enabled"] is True and body["public_key"] == vapid_on
    assert settings.VAPID_PRIVATE_KEY not in json.dumps(body)


def test_subscribe_requires_server_configuration(ana):
    assert subscribe(api_as(ana)).status_code == 503


def test_subscribe_saves_the_device_and_counts_it(db, ana, vapid_on):
    c = api_as(ana)
    assert subscribe(c).status_code == 204
    assert c.get("/api/v1/push/status").json()["devices"] == 1
    sub = db.query(PushSubscription).one()
    assert (sub.user_id, sub.endpoint, sub.auth) == (ana.id, ENDPOINT, "authSecret")


def test_same_endpoint_moves_to_the_logged_user_instead_of_duplicating(db, ana, bia, vapid_on):
    subscribe(api_as(ana))
    subscribe(api_as(bia))  # outro login no mesmo aparelho
    db.expire_all()
    assert db.query(PushSubscription).count() == 1
    assert db.query(PushSubscription).one().user_id == bia.id


def test_rejects_non_https_endpoint_and_bad_body(ana, vapid_on):
    c = api_as(ana)
    assert subscribe(c, "http://insecure.example.com/push/123").status_code == 400
    assert c.post("/api/v1/push/subscribe", json={"endpoint": ENDPOINT}).status_code == 422


def test_unsubscribe_only_removes_own_device(db, ana, bia, vapid_on):
    subscribe(api_as(ana))
    api_as(bia).post("/api/v1/push/unsubscribe", json={"endpoint": ENDPOINT})
    assert db.query(PushSubscription).count() == 1
    assert api_as(ana).post("/api/v1/push/unsubscribe", json={"endpoint": ENDPOINT}).status_code == 204
    db.expire_all()
    assert db.query(PushSubscription).count() == 0


def test_push_routes_require_login():
    assert TestClient(app).get("/api/v1/push/status").status_code == 401


# --- envio -------------------------------------------------------------------------------------------------


def test_send_delivers_title_body_and_link_to_each_device(db, ana, vapid_on, sent):
    subscribe(api_as(ana), ENDPOINT)
    subscribe(api_as(ana), "https://updates.push.services.mozilla.com/wpush/v2/other")
    count = push.send_to_users([(ana.id, {"id": 7, "title": "Novo compromisso", "body": "qua, 28/10", "link": "/agenda?evento=7", "extra": "x"})])

    assert count == 2
    assert {c["endpoint"] for c in sent.calls} == {ENDPOINT, "https://updates.push.services.mozilla.com/wpush/v2/other"}
    assert sent.calls[0]["data"] == {"id": 7, "title": "Novo compromisso", "body": "qua, 28/10", "link": "/agenda?evento=7"}
    assert sent.calls[0]["claims"]["sub"].startswith("mailto:") and sent.calls[0]["ttl"] > 0


def test_send_does_nothing_when_disabled_or_user_has_no_device(db, ana, sent, monkeypatch):
    assert push.send_to_users([(ana.id, {"title": "x"})]) == 0 and sent.calls == []  # chaves vazias
    monkeypatch.setattr(settings, "VAPID_PUBLIC_KEY", "pub")
    monkeypatch.setattr(settings, "VAPID_PRIVATE_KEY", "priv")
    assert push.send_to_users([(ana.id, {"title": "x"})]) == 0 and sent.calls == []  # sem aparelho


@pytest.mark.parametrize("status", [404, 410])
def test_gone_devices_are_removed(db, ana, vapid_on, sent, status):
    subscribe(api_as(ana))
    sent.fail[ENDPOINT] = status
    assert push.send_to_users([(ana.id, {"title": "x"})]) == 0
    db.expire_all()
    assert db.query(PushSubscription).count() == 0


def test_temporary_errors_keep_the_device(db, ana, vapid_on, sent):
    subscribe(api_as(ana))
    sent.fail[ENDPOINT] = 503
    push.send_to_users([(ana.id, {"title": "x"})])
    db.expire_all()
    assert db.query(PushSubscription).count() == 1


# --- integração com os avisos --------------------------------------------------------------------------------


def test_new_calendar_event_pushes_to_guests_only(db, ana, bia, vapid_on, sent):
    subscribe(api_as(bia), "https://fcm.googleapis.com/fcm/send/bia")
    subscribe(api_as(ana), "https://fcm.googleapis.com/fcm/send/ana")
    res = api_as(ana).post(
        "/api/v1/agenda/events",
        json={"title": "Alinhamento", "starts_at": "2026-10-28T14:00:00-03:00", "ends_at": "2026-10-28T15:00:00-03:00", "participant_ids": [bia.id]},
    )
    assert res.status_code == 201
    assert [c["endpoint"] for c in sent.calls] == ["https://fcm.googleapis.com/fcm/send/bia"]  # quem marcou não recebe
    assert sent.calls[0]["data"]["title"] == "Novo compromisso: Alinhamento"
    assert sent.calls[0]["data"]["link"] == f"/agenda?evento={res.json()['id']}"


def test_push_failure_never_breaks_the_request(db, ana, bia, vapid_on, monkeypatch):
    subscribe(api_as(bia))

    def boom(items):
        raise RuntimeError("serviço de push fora do ar")

    monkeypatch.setattr(push, "send_to_users", boom)
    res = api_as(ana).post(
        "/api/v1/agenda/events",
        json={"title": "X", "starts_at": "2026-10-28T14:00:00-03:00", "ends_at": "2026-10-28T15:00:00-03:00", "participant_ids": [bia.id]},
    )
    assert res.status_code == 201


def test_test_endpoint_needs_a_device_then_pushes(db, ana, vapid_on, sent):
    c = api_as(ana)
    assert c.post("/api/v1/push/test").status_code == 400
    subscribe(c)
    assert c.post("/api/v1/push/test").json() == {"sent": 1}
    assert sent.calls[0]["data"]["title"] == "Simbora CRM"


def test_deleting_a_user_removes_their_devices(db, ana, bia, vapid_on):
    admin = make_user(db, 7, admin=True)
    subscribe(api_as(bia))
    bia_id = bia.id
    assert api_as(admin).delete(f"/api/v1/users/{bia_id}").status_code == 204
    db.expire_all()
    assert db.query(PushSubscription).count() == 0


# --- envio de verdade (criptografia + assinatura), contra um servidor local ---------------------------------------


def test_real_send_is_signed_with_vapid_and_encrypted_for_the_device(db, ana, vapid_on, monkeypatch):
    """Sem simular o `webpush`: prova que as chaves geradas servem e que o corpo sai criptografado pro aparelho."""
    import threading
    from http.server import BaseHTTPRequestHandler, HTTPServer

    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import ec

    received = {}

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):  # noqa: N802
            received["headers"] = {k.lower(): v for k, v in self.headers.items()}
            received["body"] = self.rfile.read(int(self.headers.get("Content-Length", 0)))
            self.send_response(201)
            self.end_headers()

        def log_message(self, *args):
            pass

    server = HTTPServer(("127.0.0.1", 0), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()

    # O "aparelho": par de chaves P-256 + segredo de autenticação, como o navegador entrega.
    device_key = ec.generate_private_key(ec.SECP256R1())
    device_public = device_key.public_key().public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
    b64 = lambda raw: base64.urlsafe_b64encode(raw).rstrip(b"=").decode()  # noqa: E731
    db.add(PushSubscription(
        user_id=ana.id, endpoint=f"http://127.0.0.1:{server.server_port}/push/abc",
        p256dh=b64(device_public), auth=b64(b"0123456789abcdef"),
    ))
    db.commit()

    try:
        assert push.send_to_users([(ana.id, {"id": 1, "title": "Vence amanhã: Card", "body": "Prazo 28/10", "link": "/production"})]) == 1
    finally:
        server.shutdown()

    headers = received["headers"]
    assert headers["authorization"].startswith("vapid t=") and f"k={vapid_on}" in headers["authorization"]
    assert headers["content-encoding"] == "aes128gcm" and int(headers["ttl"]) > 0
    assert b"Card" not in received["body"] and len(received["body"]) > 80  # criptografado, não texto puro
