# backend/tests/test_permissions_gaps.py
"""Furos de permissão: WhatsApp em tempo real, conectar/desconectar o número e a lista enxuta de clientes."""
from datetime import date

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.core import evolution_client
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.user import User


def make_user(db, n: int, permissions=(), active=True) -> User:
    user = User(
        full_name=f"Pessoa {n}", cpf=f"6000000000{n}", birth_date=date(1990, 1, 1), email=f"p{n}@x.com",
        password_hash=hash_password("x"), cargo="Equipe", is_admin=False, permissions=list(permissions),
        is_active=active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def api_as(user: User) -> TestClient:
    c = TestClient(app)
    c.headers["Authorization"] = f"Bearer {create_access_token(user)}"
    return c


def ws_path(user: User) -> str:
    return f"/api/v1/whatsapp/ws?token={create_access_token(user)}"


def test_whatsapp_websocket_requires_view_permission(db):
    nobody = make_user(db, 1, ["calendar.view"])
    with TestClient(app) as http:
        with pytest.raises(WebSocketDisconnect) as closed:
            with http.websocket_connect(ws_path(nobody)):
                pass
    assert closed.value.code == 4403


def test_whatsapp_websocket_accepts_viewer_and_rejects_deactivated(db):
    viewer = make_user(db, 2, ["whatsapp.view"])
    with TestClient(app) as http:
        with http.websocket_connect(ws_path(viewer)) as ws:
            ws.close()

        viewer.is_active = False
        db.commit()
        with pytest.raises(WebSocketDisconnect):
            with http.websocket_connect(ws_path(viewer)):
                pass


def test_connect_and_disconnect_need_manage_permission(db, monkeypatch):
    async def fake_connect():
        return {"connected": False, "base64": None, "code": None, "pairing_code": None}

    async def fake_delete():
        return None

    async def fake_webhook(url):
        return None

    monkeypatch.setattr(evolution_client, "connect_instance", fake_connect)
    monkeypatch.setattr(evolution_client, "delete_instance", fake_delete)
    monkeypatch.setattr(evolution_client, "set_webhook", fake_webhook)

    viewer = api_as(make_user(db, 3, ["whatsapp.view"]))
    assert viewer.post("/api/v1/whatsapp/connect").status_code == 403
    assert viewer.post("/api/v1/whatsapp/disconnect").status_code == 403

    manager = api_as(make_user(db, 4, ["whatsapp.view", "whatsapp.manage"]))
    assert manager.post("/api/v1/whatsapp/connect").status_code == 200
    assert manager.post("/api/v1/whatsapp/disconnect").status_code == 204


def test_clients_directory_is_slim_and_open_to_calendar_viewers(db, client_row):
    client_row.contact_name = "Fulana"
    client_row.email = "f@x.com"
    client_row.notes = "interno"
    db.commit()

    designer = api_as(make_user(db, 5, ["calendar.view"]))
    assert designer.get("/api/v1/clients").status_code == 403  # a lista completa segue protegida
    res = designer.get("/api/v1/clients/directory")
    assert res.status_code == 200
    (row,) = res.json()
    assert row["name"] == "Cliente Teste"
    assert set(row) == {"id", "name", "photo_url", "default_social_id", "default_designer_id", "is_active"}


def test_clients_directory_refuses_users_without_client_or_calendar_access(db, client_row):
    assert api_as(make_user(db, 6, ["whatsapp.view"])).get("/api/v1/clients/directory").status_code == 403
