# backend/tests/test_calendar_approval_flow.py
"""Aprovação do calendário: o time envia, a Amanda aprova e as postagens vão direto pra Produção
(não existe mais etapa de aprovação do cliente)."""
from datetime import date

import pytest
from fastapi.testclient import TestClient

from app.core import evolution_client
from app.core.database import run_light_migrations
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.calendar_approval import CalendarApproval
from app.models.calendar_entry import CalendarEntry
from app.models.calendar_period import CalendarPeriod
from app.models.client import Client
from app.models.notification import Notification
from app.models.user import User

MONTH = {"year": 2026, "month": 11}


def make_user(db, n: int, *, admin: bool = False, permissions=()) -> User:
    user = User(
        full_name=f"Pessoa {n}", cpf=f"4000000000{n}", birth_date=date(1990, 1, 1), email=f"s{n}@x.com",
        password_hash=hash_password("x"), cargo="Designer", is_admin=admin, permissions=list(permissions),
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
def amanda(db):
    return make_user(db, 1, permissions=["calendar.view", "calendar.edit", "calendar.approve"])


@pytest.fixture()
def social(db):
    return make_user(db, 2, permissions=["calendar.view", "calendar.edit"])  # sem calendar.approve


@pytest.fixture()
def designer(db):
    return make_user(db, 3)


@pytest.fixture()
def client_row(db):
    row = Client(name="Honshu", whatsapp_group_id="120363@g.us")
    db.add(row)
    db.commit()
    return row


@pytest.fixture()
def no_whatsapp(monkeypatch):
    """O PDF não vai mais pro grupo do cliente: qualquer envio pela Evolution quebra o teste."""

    def boom(*a, **k):
        raise AssertionError("não devia enviar nada pelo WhatsApp do cliente")

    for name in ("send_document_url", "send_text_message", "send_media_base64"):
        monkeypatch.setattr(evolution_client, name, boom)


def add_entries(db, client_id, assignee_id, created_by, days=(3, 5, 7)):
    for day in days:
        db.add(CalendarEntry(
            client_id=client_id, scheduled_date=date(2026, 11, day), theme="Tema", title=f"Post {day}", format="",
            assignee_id=assignee_id, created_by=created_by,
        ))
    db.commit()


def send_for_approval(c: TestClient, client_id: int, **extra):
    return c.post("/api/v1/calendar-periods/enviar-aprovacao", json={"client_id": client_id, **MONTH, **extra})


def decide(c: TestClient, client_id: int, decision: str, reason: str | None = None):
    body = {"client_id": client_id, **MONTH, "decision": decision}
    if reason:
        body["reason"] = reason
    return c.post("/api/v1/calendar-periods/decisao-amanda", json=body)


def period_status(db, client_id: int) -> str:
    db.expire_all()
    return db.query(CalendarPeriod).filter_by(client_id=client_id, **MONTH).one().status


def production(c: TestClient):
    return c.get("/api/v1/calendar-entries", params={"period_status": "finalizado", "month": "2026-11"}).json()


# --- envio -----------------------------------------------------------------------------------------


def test_send_for_approval_needs_no_pdf(db, social, client_row):
    res = send_for_approval(api_as(social), client_row.id)
    assert res.status_code == 200
    assert res.json()["status"] == "enviado_aprovacao_amanda"
    assert period_status(db, client_row.id) == "enviado_aprovacao_amanda"


def test_send_for_approval_still_accepts_a_legacy_pdf_url(client_row, social):
    assert send_for_approval(api_as(social), client_row.id, pdf_url="https://media.test/x.pdf").status_code == 200


def test_cannot_send_twice_while_waiting(client_row, social):
    c = api_as(social)
    send_for_approval(c, client_row.id)
    assert send_for_approval(c, client_row.id).status_code == 409


# --- aprovação da Amanda ----------------------------------------------------------------------------


def test_approval_goes_straight_to_finalizado_and_records_the_decision(db, amanda, social, client_row, no_whatsapp):
    send_for_approval(api_as(social), client_row.id)
    res = decide(api_as(amanda), client_row.id, "aprovado")

    assert res.status_code == 200 and res.json()["status"] == "finalizado"
    assert period_status(db, client_row.id) == "finalizado"
    (record,) = db.query(CalendarApproval).all()
    assert (record.stage, record.decision, record.decided_by_user_id) == ("amanda", "aprovado", amanda.id)


def test_approval_sends_the_posts_to_production_and_notifies_each_designer_once(
    db, amanda, social, designer, client_row, no_whatsapp
):
    add_entries(db, client_row.id, designer.id, social.id)
    send_for_approval(api_as(social), client_row.id)
    assert production(api_as(amanda)) == []  # ainda não aprovado: fora da Produção

    decide(api_as(amanda), client_row.id, "aprovado")

    assert len(production(api_as(amanda))) == 3
    db.expire_all()
    (notice,) = db.query(Notification).filter(Notification.user_id == designer.id).all()
    assert notice.title == "3 novas demandas: Honshu" and "novembro/2026" in notice.body


def test_rejection_needs_a_reason_and_keeps_posts_out_of_production(db, amanda, social, designer, client_row, no_whatsapp):
    add_entries(db, client_row.id, designer.id, social.id)
    send_for_approval(api_as(social), client_row.id)

    assert decide(api_as(amanda), client_row.id, "reprovado").status_code == 422  # sem motivo
    res = decide(api_as(amanda), client_row.id, "reprovado", "Faltou legenda")
    assert res.status_code == 200 and res.json()["status"] == "reprovado"
    assert db.query(Notification).count() == 0
    assert production(api_as(amanda)) == []


def test_rejected_month_can_be_resent_and_approved(db, amanda, social, client_row, no_whatsapp):
    send_for_approval(api_as(social), client_row.id)
    decide(api_as(amanda), client_row.id, "reprovado", "Ajustar")
    assert send_for_approval(api_as(social), client_row.id).status_code == 200
    assert decide(api_as(amanda), client_row.id, "aprovado").json()["status"] == "finalizado"


def test_only_amanda_can_decide(db, social, client_row):
    send_for_approval(api_as(social), client_row.id)
    assert decide(api_as(social), client_row.id, "aprovado").status_code == 403
    assert period_status(db, client_row.id) == "enviado_aprovacao_amanda"


def test_cannot_decide_a_month_that_is_not_waiting(amanda, social, client_row, no_whatsapp):
    assert decide(api_as(amanda), client_row.id, "aprovado").status_code == 404  # nem foi enviado
    send_for_approval(api_as(social), client_row.id)
    decide(api_as(amanda), client_row.id, "aprovado")
    assert decide(api_as(amanda), client_row.id, "aprovado").status_code == 409  # já aprovado


# --- caixa de aprovações ---------------------------------------------------------------------------------


def test_pending_inbox_lists_only_months_waiting_for_amanda(db, amanda, social, client_row, no_whatsapp):
    other = Client(name="Outro")
    db.add(other)
    db.commit()
    send_for_approval(api_as(social), client_row.id)
    send_for_approval(api_as(social), other.id)
    decide(api_as(amanda), other.id, "aprovado")

    pending = api_as(amanda).get("/api/v1/calendar-periods/pending-approval").json()
    assert [(p["client_name"], p["status"]) for p in pending] == [("Honshu", "enviado_aprovacao_amanda")]


# --- o que saiu do sistema ------------------------------------------------------------------------------------


def test_client_approval_routes_no_longer_exist():
    c = TestClient(app)
    assert c.get("/api/v1/calendar-periods/approval/qualquer-token").status_code == 404
    assert c.post("/api/v1/calendar-periods/approval/qualquer-token/decisao", json={"decision": "aprovado"}).status_code == 404


def test_the_client_status_can_no_longer_be_set(amanda, client_row):
    res = api_as(amanda).put(
        "/api/v1/calendar-periods", json={"client_id": client_row.id, **MONTH, "status": "enviado_aprovacao_cliente"}
    )
    assert res.status_code == 422


# --- migração dos meses que esperavam o cliente -------------------------------------------------------------------


def test_months_waiting_for_the_client_become_approved_by_the_migration(db, client_row):
    other = Client(name="Outro")
    third = Client(name="Terceiro")
    db.add_all([other, third])
    db.commit()
    db.add_all([
        CalendarPeriod(client_id=client_row.id, **MONTH, status="enviado_aprovacao_cliente"),
        CalendarPeriod(client_id=other.id, **MONTH, status="aprovado_amanda"),
        CalendarPeriod(client_id=third.id, **MONTH, status="enviado_aprovacao_amanda"),
    ])
    db.commit()

    run_light_migrations()
    run_light_migrations()  # idempotente

    assert period_status(db, client_row.id) == "finalizado"
    assert period_status(db, other.id) == "finalizado"
    assert period_status(db, third.id) == "enviado_aprovacao_amanda"  # ainda espera a Amanda: não mexe
