# backend/tests/test_post_review.py
"""Revisão de posts: só quem tem `post.review` (a redatora) tira o post da "Checagem e aprovação"."""
from datetime import date

import pytest
from fastapi.testclient import TestClient

from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.calendar_entry import CalendarEntry
from app.models.calendar_entry_review import CalendarEntryReview
from app.models.notification import Notification
from app.models.user import User

BASE = ["calendar.view", "calendar.edit", "calendar.create"]


def make_user(db, n: int, permissions=()) -> User:
    user = User(
        full_name=f"Pessoa {n}", cpf=f"5000000000{n}", birth_date=date(1990, 1, 1), email=f"r{n}@x.com",
        password_hash=hash_password("x"), cargo="Equipe", is_admin=False, permissions=list(permissions),
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
def redatora(db):
    return make_user(db, 1, BASE + ["post.review"])


@pytest.fixture()
def designer(db):
    return make_user(db, 2, BASE)


@pytest.fixture()
def entry(db, client_row, designer):
    row = CalendarEntry(
        client_id=client_row.id, scheduled_date=date(2026, 11, 10), theme="Tema", title="Post 10", format="",
        assignee_id=designer.id, created_by=designer.id, status="andamento",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def move(c: TestClient, entry_id: int, status: str, **extra):
    return c.patch(f"/api/v1/calendar-entries/{entry_id}", json={"status": status, **extra})


def current_status(db, entry_id: int) -> str:
    db.expire_all()
    return db.get(CalendarEntry, entry_id).status


def test_designer_can_send_to_review(db, designer, entry):
    assert move(api_as(designer), entry.id, "checagem_aprovacao").status_code == 200
    assert current_status(db, entry.id) == "checagem_aprovacao"


@pytest.mark.parametrize("target", ["finalizados", "publicados", "modificacoes"])
def test_designer_cannot_decide_the_review(db, designer, entry, target):
    c = api_as(designer)
    move(c, entry.id, "checagem_aprovacao")
    res = move(c, entry.id, target, review_reason="x")
    assert res.status_code == 403
    assert current_status(db, entry.id) == "checagem_aprovacao"


def test_designer_cannot_skip_the_review(db, designer, entry):
    assert move(api_as(designer), entry.id, "finalizados").status_code == 403
    assert current_status(db, entry.id) == "andamento"


def test_reviewer_approves_and_it_is_recorded(db, redatora, designer, entry):
    move(api_as(designer), entry.id, "checagem_aprovacao")
    assert move(api_as(redatora), entry.id, "finalizados").status_code == 200

    (review,) = db.query(CalendarEntryReview).all()
    assert (review.decision, review.reason, review.decided_by_user_id) == ("aprovado", None, redatora.id)
    assert current_status(db, entry.id) == "finalizados"


def test_rejecting_needs_a_reason_and_notifies_the_designer(db, redatora, designer, entry):
    move(api_as(designer), entry.id, "checagem_aprovacao")
    c = api_as(redatora)

    assert move(c, entry.id, "modificacoes").status_code == 422
    assert current_status(db, entry.id) == "checagem_aprovacao"

    assert move(c, entry.id, "modificacoes", review_reason="Faltou a legenda").status_code == 200
    (review,) = db.query(CalendarEntryReview).all()
    assert (review.decision, review.reason) == ("reprovado", "Faltou a legenda")
    (notice,) = db.query(Notification).filter(Notification.user_id == designer.id, Notification.type == "post_revisado").all()
    assert notice.title.startswith("Ajustes pedidos") and notice.body == "Faltou a legenda"


def test_designer_can_resend_after_adjustments(db, redatora, designer, entry):
    c = api_as(designer)
    move(c, entry.id, "checagem_aprovacao")
    move(api_as(redatora), entry.id, "modificacoes", review_reason="Ajustar")
    assert move(c, entry.id, "andamento").status_code == 200
    assert move(c, entry.id, "checagem_aprovacao").status_code == 200
    assert move(api_as(redatora), entry.id, "finalizados").status_code == 200
    assert [r.decision for r in db.query(CalendarEntryReview).order_by(CalendarEntryReview.id)] == ["reprovado", "aprovado"]


def test_reviewers_are_notified_when_a_post_arrives(db, redatora, designer, entry):
    move(api_as(designer), entry.id, "checagem_aprovacao")
    (notice,) = db.query(Notification).filter(Notification.type == "post_revisao").all()
    assert notice.user_id == redatora.id and notice.title.startswith("Post para revisar")


def test_approved_post_can_go_to_published_by_anyone(db, redatora, designer, entry):
    move(api_as(designer), entry.id, "checagem_aprovacao")
    move(api_as(redatora), entry.id, "finalizados")
    assert move(api_as(designer), entry.id, "publicados").status_code == 200


def test_admin_passes_without_the_permission(db, admin, designer, entry):
    move(api_as(designer), entry.id, "checagem_aprovacao")
    assert move(api_as(admin), entry.id, "finalizados").status_code == 200


def test_create_and_bulk_cannot_start_a_post_as_approved(db, designer, redatora, client_row):
    body = {"client_id": client_row.id, "scheduled_date": "2026-11-12", "theme": "Tema", "status": "finalizados"}
    assert api_as(designer).post("/api/v1/calendar-entries", json=body).status_code == 403
    assert api_as(designer).post("/api/v1/calendar-entries/bulk", json={"entries": [body]}).status_code == 403
    assert api_as(redatora).post("/api/v1/calendar-entries", json=body).status_code == 201


def test_history_endpoint_and_delete_cleanup(db, redatora, designer, entry):
    move(api_as(designer), entry.id, "checagem_aprovacao")
    move(api_as(redatora), entry.id, "modificacoes", review_reason="Ajustar")

    history = api_as(designer).get(f"/api/v1/calendar-entries/{entry.id}/reviews").json()
    assert [(h["decision"], h["reason"]) for h in history] == [("reprovado", "Ajustar")]

    admin_api = api_as(make_user(db, 3, BASE + ["calendar.delete"]))
    assert admin_api.delete(f"/api/v1/calendar-entries/{entry.id}").status_code == 204
    assert db.query(CalendarEntryReview).count() == 0


def test_change_request_is_separate_from_description_and_notifies_the_designer(db, redatora, designer, entry):
    res = api_as(redatora).patch(f"/api/v1/calendar-entries/{entry.id}", json={"change_request": "Trocar a foto da capa"})
    assert res.status_code == 200
    body = res.json()
    assert body["change_request"] == "Trocar a foto da capa"
    assert body["theme"] == "Tema"  # a descrição original não é tocada
    notice = db.query(Notification).filter(Notification.user_id == designer.id, Notification.type == "post_alteracao").one()
    assert "Trocar a foto da capa" in notice.body


def test_unchanged_change_request_does_not_notify_again(db, redatora, designer, entry):
    client = api_as(redatora)
    client.patch(f"/api/v1/calendar-entries/{entry.id}", json={"change_request": "Ajustar texto"})
    client.patch(f"/api/v1/calendar-entries/{entry.id}", json={"change_request": "Ajustar texto", "title": "Novo título"})
    assert db.query(Notification).filter(Notification.type == "post_alteracao").count() == 1


def test_assignee_editing_own_change_request_is_not_notified(db, designer, entry):
    api_as(designer).patch(f"/api/v1/calendar-entries/{entry.id}", json={"change_request": "Anotação minha"})
    assert db.query(Notification).filter(Notification.type == "post_alteracao").count() == 0


def test_bulk_create_keeps_the_given_assignee_and_rejects_unknown_users(db, redatora, designer, client_row):
    c = api_as(redatora)
    row = {"client_id": client_row.id, "scheduled_date": "2026-11-05", "theme": "Jogos", "assignee_id": designer.id}

    ok = c.post("/api/v1/calendar-entries/bulk", json={"entries": [row], "dry_run": False})
    assert ok.status_code == 200
    assert ok.json()["entries"][0]["assignee_id"] == designer.id

    bad = c.post("/api/v1/calendar-entries/bulk", json={"entries": [{**row, "assignee_id": 99999}], "dry_run": False})
    assert bad.status_code == 400
