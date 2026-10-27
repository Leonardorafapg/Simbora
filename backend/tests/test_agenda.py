# backend/tests/test_agenda.py
"""Agenda da equipe: compromissos com vários participantes e avisos de marcação/alteração/cancelamento."""
from datetime import date, datetime

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.core.security import create_access_token, hash_password
from app.core.timeutil import BRT, as_utc, format_when, to_utc_naive
from app.main import app
from app.models.agenda import AgendaEvent
from app.models.notification import Notification
from app.models.user import User
from app.services import agenda as agenda_service
from app.services import notifications

START = "2026-10-28T14:00:00-03:00"  # quarta
END = "2026-10-28T15:00:00-03:00"


def make_user(db, n: int, *, active: bool = True, admin: bool = False) -> User:
    user = User(
        full_name=f"Pessoa {n}", cpf=f"1000000000{n}", birth_date=date(1990, 1, 1), email=f"p{n}@x.com",
        password_hash=hash_password("x"), cargo="Designer", is_admin=admin, permissions=[], is_active=active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def client_for(user: User) -> TestClient:
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
def caio(db):
    return make_user(db, 3)


def create_event(c: TestClient, participants=(), **extra):
    body = {"title": "Reunião", "starts_at": START, "ends_at": END, "participant_ids": list(participants), **extra}
    return c.post("/api/v1/agenda/events", json=body)


def inbox(db, user: User) -> list[Notification]:
    db.expire_all()
    return db.query(Notification).filter(Notification.user_id == user.id).order_by(Notification.id).all()


# --- horário ------------------------------------------------------------------------------


def test_naive_time_is_read_as_brasilia_and_returned_with_timezone(ana):
    res = create_event(client_for(ana), starts_at="2026-10-28T14:00:00", ends_at="2026-10-28T15:00:00")
    assert res.status_code == 201
    assert res.json()["starts_at"] == "2026-10-28T17:00:00Z"


def test_time_helpers():
    assert to_utc_naive(datetime(2026, 10, 28, 14, 0, tzinfo=BRT)) == datetime(2026, 10, 28, 17, 0)
    assert as_utc(datetime(2026, 10, 28, 17, 0)).tzinfo is not None
    assert format_when(datetime(2026, 10, 28, 17, 0)) == "qua, 28/10 às 14:00"


# --- criação e visibilidade -----------------------------------------------------------------


def test_only_tagged_people_are_participants(ana, bia):
    body = create_event(client_for(ana), [bia.id]).json()
    assert {p["id"] for p in body["participants"]} == {bia.id}  # quem cria não entra sozinho
    assert body["created_by"] == ana.id
    assert {p["id"] for p in create_event(client_for(ana), [ana.id, bia.id]).json()["participants"]} == {ana.id, bia.id}


def test_creator_still_sees_and_manages_event_without_being_tagged(ana, bia):
    event_id = create_event(client_for(ana), [bia.id]).json()["id"]
    window = {"start": "2026-10-01T00:00:00-03:00", "end": "2026-11-01T00:00:00-03:00"}
    assert [e["id"] for e in client_for(ana).get("/api/v1/agenda/events", params=window).json()] == [event_id]
    assert client_for(ana).patch(f"/api/v1/agenda/events/{event_id}", json={"title": "Novo"}).status_code == 200


def test_everyone_sees_every_event(ana, bia, caio):
    event_id = create_event(client_for(ana), [bia.id]).json()["id"]
    window = {"start": "2026-10-01T00:00:00-03:00", "end": "2026-11-01T00:00:00-03:00"}

    for person in (ana, bia, caio):  # caio não foi marcado e ainda assim vê
        assert [e["id"] for e in client_for(person).get("/api/v1/agenda/events", params=window).json()] == [event_id]
        assert client_for(person).get(f"/api/v1/agenda/events/{event_id}").status_code == 200


def test_list_filters_by_window_overlap(ana):
    c = client_for(ana)
    create_event(c)
    inside = c.get("/api/v1/agenda/events", params={"start": "2026-10-28T00:00:00-03:00", "end": "2026-10-29T00:00:00-03:00"})
    outside = c.get("/api/v1/agenda/events", params={"start": "2026-10-29T00:00:00-03:00", "end": "2026-10-30T00:00:00-03:00"})
    assert len(inside.json()) == 1 and outside.json() == []


def test_list_rejects_huge_or_inverted_window(ana):
    c = client_for(ana)
    assert c.get("/api/v1/agenda/events", params={"start": "2026-01-01T00:00:00Z", "end": "2027-01-01T00:00:00Z"}).status_code == 400
    assert c.get("/api/v1/agenda/events", params={"start": "2026-10-02T00:00:00Z", "end": "2026-10-01T00:00:00Z"}).status_code == 400


def test_requires_login():
    assert TestClient(app).get("/api/v1/agenda/events", params={"start": START, "end": END}).status_code == 401


# --- validação ------------------------------------------------------------------------------


def test_rejects_end_before_start_and_blank_title(ana):
    c = client_for(ana)
    assert create_event(c, starts_at=END, ends_at=START).status_code == 422
    assert create_event(c, title="   ").status_code == 422


def test_rejects_unknown_or_inactive_participant(db, ana):
    inactive = make_user(db, 9, active=False)
    c = client_for(ana)
    assert create_event(c, [99999]).status_code == 400
    assert create_event(c, [inactive.id]).status_code == 400


# --- avisos ao marcar -----------------------------------------------------------------------


def test_creating_notifies_participants_but_not_the_creator(db, ana, bia, caio):
    event_id = create_event(client_for(ana), [bia.id, caio.id], title="Alinhamento").json()["id"]

    assert inbox(db, ana) == []
    for person in (bia, caio):
        (n,) = inbox(db, person)
        assert n.type == agenda_service.TYPE_INVITE
        assert n.title == "Novo compromisso: Alinhamento"
        assert "qua, 28/10 às 14:00" in n.body and "Pessoa 1" in n.body
        assert n.link == f"/agenda?evento={event_id}"


# --- avisos ao alterar ------------------------------------------------------------------------


def test_changing_time_notifies_kept_participants_with_old_and_new(db, ana, bia):
    event_id = create_event(client_for(ana), [bia.id]).json()["id"]
    res = client_for(ana).patch(
        f"/api/v1/agenda/events/{event_id}",
        json={"starts_at": "2026-10-29T10:00:00-03:00", "ends_at": "2026-10-29T11:00:00-03:00"},
    )
    assert res.status_code == 200
    changed = [n for n in inbox(db, bia) if n.type == agenda_service.TYPE_CHANGED]
    assert len(changed) == 1
    assert "qui, 29/10 às 10:00" in changed[0].body and "qua, 28/10 às 14:00" in changed[0].body


def test_no_notification_when_nothing_relevant_changed(db, ana, bia):
    event_id = create_event(client_for(ana), [bia.id], title="Igual").json()["id"]
    client_for(ana).patch(f"/api/v1/agenda/events/{event_id}", json={"title": "Igual"})
    assert [n.type for n in inbox(db, bia)] == [agenda_service.TYPE_INVITE]


def test_adding_and_removing_participants_notifies_each_side(db, ana, bia, caio):
    event_id = create_event(client_for(ana), [bia.id]).json()["id"]
    client_for(ana).patch(f"/api/v1/agenda/events/{event_id}", json={"participant_ids": [caio.id]})

    assert [n.type for n in inbox(db, caio)] == [agenda_service.TYPE_INVITE]
    assert agenda_service.TYPE_REMOVED in [n.type for n in inbox(db, bia)]
    still = client_for(ana).get(f"/api/v1/agenda/events/{event_id}").json()
    assert {p["id"] for p in still["participants"]} == {caio.id}
    assert client_for(bia).get(f"/api/v1/agenda/events/{event_id}").status_code == 200  # segue vendo, só não é mais marcada


def test_agenda_edit_permission_lets_others_edit_and_delete(db, ana, bia):
    event_id = create_event(client_for(ana), [bia.id]).json()["id"]
    bia.permissions = ["agenda.edit"]
    db.commit()
    assert client_for(bia).patch(f"/api/v1/agenda/events/{event_id}", json={"title": "Outro"}).json()["title"] == "Outro"
    assert client_for(bia).delete(f"/api/v1/agenda/events/{event_id}").status_code == 204


def test_seeing_an_event_does_not_allow_editing_it(ana, bia, caio):
    event_id = create_event(client_for(ana), [bia.id]).json()["id"]
    assert client_for(caio).patch(f"/api/v1/agenda/events/{event_id}", json={"title": "X"}).status_code == 403
    assert client_for(caio).delete(f"/api/v1/agenda/events/{event_id}").status_code == 403


def test_only_creator_can_edit_or_delete(ana, bia):
    event_id = create_event(client_for(ana), [bia.id]).json()["id"]
    assert client_for(bia).patch(f"/api/v1/agenda/events/{event_id}", json={"title": "Outro"}).status_code == 403
    assert client_for(bia).delete(f"/api/v1/agenda/events/{event_id}").status_code == 403


def test_patch_rejects_end_before_start(ana):
    c = client_for(ana)
    event_id = create_event(c).json()["id"]
    assert c.patch(f"/api/v1/agenda/events/{event_id}", json={"ends_at": "2026-10-28T13:00:00-03:00"}).status_code == 400
    assert c.get(f"/api/v1/agenda/events/{event_id}").json()["ends_at"] == "2026-10-28T18:00:00Z"


# --- cancelamento -------------------------------------------------------------------------------


def test_deleting_notifies_participants_and_removes_event(db, ana, bia):
    event_id = create_event(client_for(ana), [bia.id], title="Cancelável").json()["id"]
    assert client_for(ana).delete(f"/api/v1/agenda/events/{event_id}").status_code == 204

    db.expire_all()
    assert db.get(AgendaEvent, event_id) is None
    canceled = [n for n in inbox(db, bia) if n.type == agenda_service.TYPE_CANCELED]
    assert len(canceled) == 1 and canceled[0].title == "Compromisso cancelado: Cancelável"


# --- serviço de avisos ----------------------------------------------------------------------------


def test_dedupe_key_never_creates_the_same_notice_twice(db, ana):
    for _ in range(2):
        notifications.create_notifications(db, [ana.id], type="t", title="x", dedupe_key="lembrete:7:30min")
        db.commit()
    assert len(inbox(db, ana)) == 1


def test_changed_fields_ignores_irrelevant_edits():
    base = dict(id=1, title="A", description=None, participant_ids=frozenset({1}))
    t = datetime(2026, 10, 28, 17, 0)
    before = agenda_service.EventSnapshot(starts_at=t, ends_at=t, **base)
    assert agenda_service.changed_fields(before, before) == []
    later = agenda_service.EventSnapshot(starts_at=datetime(2026, 10, 28, 18, 0), ends_at=t, **base)
    assert agenda_service.changed_fields(before, later) == ["horário"]


# --- central de avisos (rotas) --------------------------------------------------------------------


def test_notification_inbox_is_private_and_can_be_read(db, ana, bia):
    create_event(client_for(ana), [bia.id])
    create_event(client_for(ana), [bia.id], title="Segundo")
    c = client_for(bia)

    assert c.get("/api/v1/notifications/unread-count").json() == {"unread": 2}
    items = c.get("/api/v1/notifications").json()
    assert [i["title"] for i in items] == ["Novo compromisso: Segundo", "Novo compromisso: Reunião"]  # mais novo primeiro

    first = items[0]["id"]
    assert c.post(f"/api/v1/notifications/{first}/read").json()["read_at"] is not None
    assert c.get("/api/v1/notifications/unread-count").json() == {"unread": 1}
    assert len(c.get("/api/v1/notifications", params={"unread_only": True}).json()) == 1

    assert client_for(ana).post(f"/api/v1/notifications/{first}/read").status_code == 404  # aviso de outra pessoa


def test_read_all_only_touches_own_notices(db, ana, bia):
    create_event(client_for(ana), [bia.id])
    create_event(client_for(bia), [ana.id])
    assert client_for(bia).post("/api/v1/notifications/read-all").json() == {"unread": 0}
    assert client_for(ana).get("/api/v1/notifications/unread-count").json() == {"unread": 1}


# --- tempo real -----------------------------------------------------------------------------------


def test_websocket_delivers_notice_only_to_the_recipient(ana, bia, caio):
    with TestClient(app) as http:
        http.headers["Authorization"] = f"Bearer {create_access_token(ana)}"
        bia_token = create_access_token(bia)
        with http.websocket_connect(f"/api/v1/notifications/ws?token={bia_token}") as bia_ws:
            res = http.post(
                "/api/v1/agenda/events",
                json={"title": "Ao vivo", "starts_at": START, "ends_at": END, "participant_ids": [bia.id]},
            )
            assert res.status_code == 201
            message = bia_ws.receive_json()
    assert message["type"] == "notification"
    assert message["notification"]["title"] == "Novo compromisso: Ao vivo"
    assert caio  # (sem socket: nada a receber)


def test_websocket_rejects_bad_token():
    with TestClient(app) as http:
        with pytest.raises(WebSocketDisconnect) as exc:
            with http.websocket_connect("/api/v1/notifications/ws?token=lixo"):
                pass
    assert exc.value.code == 4401


# --- excluir usuário -------------------------------------------------------------------------------


def test_deleting_a_user_cleans_their_agenda_and_notices(db, ana, bia):
    admin = make_user(db, 7, admin=True)
    create_event(client_for(ana), [bia.id])  # bia recebe aviso
    create_event(client_for(bia), [ana.id])  # bia é dona de um compromisso
    bia_id, ana_id = bia.id, ana.id  # lidos antes: depois da exclusão o objeto não existe mais
    assert client_for(admin).delete(f"/api/v1/users/{bia_id}").status_code == 204

    db.expire_all()
    assert db.query(Notification).filter(Notification.user_id == bia_id).count() == 0
    assert db.query(AgendaEvent).filter(AgendaEvent.created_by == bia_id).count() == 0
    # o compromisso de Ana continua, só sem Bia (e Ana, que marcou, segue como dona dele)
    (remaining,) = db.query(AgendaEvent).all()
    assert remaining.created_by == ana_id
    assert {p.id for p in remaining.participants} == set()


def test_event_tells_who_created_it_even_when_not_a_participant(ana, bia):
    body = create_event(client_for(ana), [bia.id]).json()
    assert body["created_by_name"] == "Pessoa 1"
    assert ana.id not in {p["id"] for p in body["participants"]}
    assert client_for(bia).get(f"/api/v1/agenda/events/{body['id']}").json()["created_by_name"] == "Pessoa 1"


def test_event_with_nobody_tagged_has_no_participants_but_is_still_listed_for_its_creator(ana):
    body = create_event(client_for(ana)).json()
    assert body["participants"] == []
    window = {"start": "2026-10-01T00:00:00-03:00", "end": "2026-11-01T00:00:00-03:00"}
    assert [e["id"] for e in client_for(ana).get("/api/v1/agenda/events", params=window).json()] == [body["id"]]


def test_creator_gets_no_reminder_unless_tagged(db, ana, bia):
    from datetime import datetime, timedelta

    from app.services import reminders

    now = datetime(2026, 10, 28, 12, 0)
    for guests, creator_tagged in (([bia.id], False), ([ana.id, bia.id], True)):
        body = client_for(ana).post("/api/v1/agenda/events", json={
            "title": "Lembrete", "participant_ids": guests,
            "starts_at": (now + timedelta(minutes=20)).isoformat() + "Z", "ends_at": (now + timedelta(minutes=80)).isoformat() + "Z",
        }).json()
        recipients = {n.user_id for n in reminders.agenda_reminders(db, now) if f"evento={body['id']}" in (n.link or "")}
        assert (ana.id in recipients) is creator_tagged
        assert bia.id in recipients
