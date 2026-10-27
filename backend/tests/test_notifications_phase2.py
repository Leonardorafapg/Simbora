# backend/tests/test_notifications_phase2.py
"""Avisos automáticos: demanda nova pro designer, lembretes da agenda e vencimento de prazo."""
from datetime import date, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError

from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.agenda import AgendaEvent
from app.models.calendar_entry import CalendarEntry
from app.models.calendar_period import CalendarPeriod
from app.models.client import Client
from app.models.notification import Notification
from app.models.user import User
from app.services import deadlines, demands, reminders
from app.services.notification_worker import NotificationWorker


# --- helpers ------------------------------------------------------------------------------------


def make_user(db, n: int, *, admin: bool = False) -> User:
    user = User(
        full_name=f"Pessoa {n}", cpf=f"2000000000{n}", birth_date=date(1990, 1, 1), email=f"q{n}@x.com",
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


def make_entry(db, client_id, assignee_id, *, scheduled=date(2026, 11, 11), status="producao", **extra) -> CalendarEntry:
    entry = CalendarEntry(
        client_id=client_id, scheduled_date=scheduled, theme="Tema", title=extra.pop("title", "Post"), format="",
        status=status, assignee_id=assignee_id, created_by=extra.pop("created_by", assignee_id), **extra,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def approve_month(db, client_id, year=2026, month=11):
    db.add(CalendarPeriod(client_id=client_id, year=year, month=month, status="finalizado"))
    db.commit()


def inbox(db, user_id: int, type_prefix: str = "") -> list[Notification]:
    db.expire_all()
    rows = db.query(Notification).filter(Notification.user_id == user_id).order_by(Notification.id).all()
    return [n for n in rows if n.type.startswith(type_prefix)]


@pytest.fixture()
def designer(db):
    return make_user(db, 1)


@pytest.fixture()
def designer2(db):
    return make_user(db, 2)


@pytest.fixture()
def boss(db):
    return make_user(db, 3, admin=True)


# --- prazo (paridade com crm/lib/deadline.ts) -------------------------------------------------------


@pytest.mark.parametrize(
    "scheduled,expected",
    [
        (date(2026, 10, 28), date(2026, 10, 22)),  # quarta -> quinta da semana anterior
        (date(2026, 10, 26), date(2026, 10, 22)),  # segunda
        (date(2026, 11, 1), date(2026, 10, 22)),   # domingo ainda é da semana de 26/10
        (date(2026, 11, 2), date(2026, 10, 29)),   # segunda seguinte
        (date(2026, 11, 11), date(2026, 11, 5)),
    ],
)
def test_deadline_matches_the_crm_rule(scheduled, expected):
    assert deadlines.deadline_for(scheduled) == expected
    assert deadlines.deadline_for(scheduled).weekday() == 3  # sempre quinta


def test_custom_deadline_wins(db):
    entry = CalendarEntry(scheduled_date=date(2026, 11, 11), custom_deadline=date(2026, 11, 9))
    assert deadlines.entry_deadline(entry) == date(2026, 11, 9)


# --- demanda nova ------------------------------------------------------------------------------------


def test_new_standalone_demand_notifies_the_designer_not_the_actor(db, designer, boss):
    client = Client(name="Honshu")
    db.add(client)
    db.commit()
    res = api_as(boss).post(
        "/api/v1/calendar-entries?from_production=true",
        json={"client_id": client.id, "scheduled_date": "2026-11-11", "theme": "Tema", "title": "Card de sushi",
              "assignee_id": designer.id},
    )
    assert res.status_code == 201
    (n,) = inbox(db, designer.id)
    assert n.type == demands.TYPE_NEW_DEMAND and n.title == "Nova demanda: Card de sushi"
    assert "Honshu" in n.body and "prazo 05/11" in n.body
    assert n.link == f"/production?demanda={res.json()['id']}&mes=2026-11"
    assert inbox(db, boss.id) == []


def test_creating_for_yourself_does_not_notify_you(db, designer):
    client = Client(name="X")
    db.add(client)
    db.commit()
    api_as(designer).post(
        "/api/v1/calendar-entries?from_production=true",
        json={"client_id": client.id, "scheduled_date": "2026-11-11", "theme": "T", "assignee_id": designer.id},
    )
    assert inbox(db, designer.id) == []


def test_calendar_entry_in_unapproved_month_is_not_a_demand_yet(db, designer, boss):
    client = Client(name="X")
    db.add(client)
    db.commit()
    api_as(boss).post(
        "/api/v1/calendar-entries",
        json={"client_id": client.id, "scheduled_date": "2026-11-11", "theme": "T", "assignee_id": designer.id},
    )
    assert inbox(db, designer.id) == []


def test_reassigning_notifies_only_the_new_designer(db, designer, designer2, boss):
    client = Client(name="X")
    db.add(client)
    db.commit()
    entry = make_entry(db, client.id, designer.id, from_production=True, title="Troca")
    res = api_as(boss).patch(f"/api/v1/calendar-entries/{entry.id}", json={"assignee_id": designer2.id})
    assert res.status_code == 200
    (n,) = inbox(db, designer2.id)
    assert n.title == "Demanda atribuída a você: Troca"
    assert inbox(db, designer.id) == []
    # editar outra coisa não avisa de novo
    api_as(boss).patch(f"/api/v1/calendar-entries/{entry.id}", json={"theme": "Outro"})
    assert len(inbox(db, designer2.id)) == 1


def test_month_approval_sends_one_notice_per_designer_with_the_count(db, designer, designer2, boss):
    client = Client(name="Honshu")
    db.add(client)
    db.commit()
    for day in (3, 5, 7):
        make_entry(db, client.id, designer.id, scheduled=date(2026, 11, day))
    make_entry(db, client.id, designer2.id, scheduled=date(2026, 11, 9), title="Única")

    res = api_as(boss).put(
        "/api/v1/calendar-periods", json={"client_id": client.id, "year": 2026, "month": 11, "status": "finalizado"}
    )
    assert res.status_code == 200

    (many,) = inbox(db, designer.id)
    assert many.type == demands.TYPE_MONTH_DEMANDS
    assert many.title == "3 novas demandas: Honshu" and "novembro/2026" in many.body
    assert many.link == "/production?mes=2026-11"
    (single,) = inbox(db, designer2.id)
    assert single.type == demands.TYPE_NEW_DEMAND and single.title == "Nova demanda: Única"


def test_approving_again_does_not_notify_twice(db, designer, boss):
    client = Client(name="X")
    db.add(client)
    db.commit()
    make_entry(db, client.id, designer.id)
    make_entry(db, client.id, designer.id, scheduled=date(2026, 11, 12))
    body = {"client_id": client.id, "year": 2026, "month": 11, "status": "finalizado"}
    api_as(boss).put("/api/v1/calendar-periods", json=body)
    api_as(boss).put("/api/v1/calendar-periods", json=body)
    assert len(inbox(db, designer.id)) == 1


def test_month_approval_ignores_standalone_demands_and_unassigned(db, designer, boss):
    client = Client(name="X")
    db.add(client)
    db.commit()
    make_entry(db, client.id, designer.id, from_production=True)  # avulsa: já foi avisada na criação
    make_entry(db, client.id, None, scheduled=date(2026, 11, 12), created_by=boss.id)
    api_as(boss).put("/api/v1/calendar-periods", json={"client_id": client.id, "year": 2026, "month": 11, "status": "finalizado"})
    assert inbox(db, designer.id) == []


def test_client_approval_link_also_notifies(db, designer):
    from app.core.security import create_calendar_approval_token

    client = Client(name="X")
    db.add(client)
    db.commit()
    period = CalendarPeriod(client_id=client.id, year=2026, month=11, status="enviado_aprovacao_cliente")
    db.add(period)
    db.commit()
    make_entry(db, client.id, designer.id)
    make_entry(db, client.id, designer.id, scheduled=date(2026, 11, 12))

    token = create_calendar_approval_token(period.id)
    res = TestClient(app).post(f"/api/v1/calendar-periods/approval/{token}/decisao", json={"decision": "aprovado"})
    assert res.status_code == 200
    (n,) = inbox(db, designer.id)
    assert n.title.startswith("2 novas demandas")


# --- lembretes da agenda -------------------------------------------------------------------------------


def make_event(db, creator, guests=(), *, starts, hours=1, created_ago=timedelta(days=3)) -> AgendaEvent:
    event = AgendaEvent(
        title="Reunião", starts_at=starts, ends_at=starts + timedelta(hours=hours), created_by=creator.id
    )
    event.participants = [creator, *guests]
    db.add(event)
    db.commit()
    event.updated_at = starts - created_ago  # "quando foi marcado/alterado pela última vez"
    db.commit()
    return event


NOW = datetime(2026, 10, 28, 12, 0)  # 09:00 em Brasília


def test_one_day_reminder_goes_to_every_participant(db, designer, designer2):
    event = make_event(db, designer, [designer2], starts=NOW + timedelta(hours=23))
    created = reminders.agenda_reminders(db, NOW)
    assert {n.user_id for n in created} == {designer.id, designer2.id}
    assert all(n.type == reminders.TYPE_AGENDA_1D and n.title == "Amanhã: Reunião" for n in created)
    assert created[0].link == f"/agenda?evento={event.id}"


def test_thirty_minute_reminder_replaces_the_one_day_one(db, designer):
    make_event(db, designer, starts=NOW + timedelta(minutes=25))
    (n,) = reminders.agenda_reminders(db, NOW)
    assert n.type == reminders.TYPE_AGENDA_30M and n.title == "Em 30 minutos: Reunião"


def test_no_reminder_before_the_window_or_after_it_started(db, designer):
    make_event(db, designer, starts=NOW + timedelta(hours=30))
    make_event(db, designer, starts=NOW - timedelta(minutes=5))
    assert reminders.agenda_reminders(db, NOW) == []


def test_reminders_are_not_repeated(db, designer):
    make_event(db, designer, starts=NOW + timedelta(hours=20))
    assert len(reminders.agenda_reminders(db, NOW)) == 1
    assert reminders.agenda_reminders(db, NOW + timedelta(minutes=1)) == []
    assert len(inbox(db, designer.id)) == 1


def test_rescheduling_rearms_the_reminders(db, designer):
    event = make_event(db, designer, starts=NOW + timedelta(hours=20))
    reminders.agenda_reminders(db, NOW)
    event.starts_at = NOW + timedelta(hours=22)
    event.ends_at = event.starts_at + timedelta(hours=1)
    event.updated_at = NOW - timedelta(days=2)  # (alteração antiga, só pra isolar a regra da chave)
    db.commit()
    assert len(reminders.agenda_reminders(db, NOW)) == 1


def test_event_marked_inside_the_day_window_skips_the_day_reminder(db, designer):
    # Marcado há 1 h pra daqui a 10 h: a pessoa acabou de ser avisada — "amanhã" seria repetição.
    make_event(db, designer, starts=NOW + timedelta(hours=10), created_ago=timedelta(hours=11))
    assert reminders.agenda_reminders(db, NOW) == []
    # ...mas o de 30 minutos ainda sai.
    (n,) = reminders.agenda_reminders(db, NOW + timedelta(hours=9, minutes=40))
    assert n.type == reminders.TYPE_AGENDA_30M


# --- lembretes de prazo ----------------------------------------------------------------------------------


def deadline_day(db, designer, *, days_from_today: int, **extra):
    """Demanda cujo prazo (personalizado) cai daqui a N dias, contando de hoje em Brasília."""
    client = Client(name="Cliente")
    db.add(client)
    db.commit()
    return make_entry(
        db, client.id, designer.id, from_production=True, scheduled=date(2026, 11, 20),
        custom_deadline=date(2026, 10, 28) + timedelta(days=days_from_today), **extra,
    )


def test_deadline_tomorrow_and_today_notify_the_designer(db, designer):
    tomorrow = deadline_day(db, designer, days_from_today=1, title="Amanhã")
    today = deadline_day(db, designer, days_from_today=0, title="Hoje")
    deadline_day(db, designer, days_from_today=2, title="Longe")

    created = reminders.deadline_reminders(db, NOW)
    by_type = {n.type: n for n in created}
    assert set(by_type) == {reminders.TYPE_DEADLINE_TOMORROW, reminders.TYPE_DEADLINE_TODAY}
    assert by_type[reminders.TYPE_DEADLINE_TOMORROW].title == "Vence amanhã: Amanhã"
    assert by_type[reminders.TYPE_DEADLINE_TODAY].title == "Vence hoje: Hoje"
    assert by_type[reminders.TYPE_DEADLINE_TODAY].link == f"/production?demanda={today.id}&mes=2026-11"
    assert tomorrow.id != today.id


def test_deadline_reminders_wait_until_9am_in_brasilia(db, designer):
    deadline_day(db, designer, days_from_today=1)
    assert reminders.deadline_reminders(db, datetime(2026, 10, 28, 11, 59)) == []  # 08:59 BRT
    assert len(reminders.deadline_reminders(db, datetime(2026, 10, 28, 12, 0))) == 1  # 09:00 BRT


def test_delivered_demands_do_not_get_deadline_reminders(db, designer):
    for status in ("checagem_aprovacao", "modificacoes", "finalizados", "publicados"):
        deadline_day(db, designer, days_from_today=1, status=status)
    assert reminders.deadline_reminders(db, NOW) == []


def test_calendar_posts_only_remind_after_the_month_is_approved(db, designer):
    client = Client(name="X")
    db.add(client)
    db.commit()
    entry = make_entry(db, client.id, designer.id, scheduled=date(2026, 11, 11), custom_deadline=date(2026, 10, 29))
    assert reminders.deadline_reminders(db, NOW) == []
    approve_month(db, client.id)
    (n,) = reminders.deadline_reminders(db, NOW)
    assert n.title.startswith("Vence amanhã") and entry.id


def test_unassigned_demands_have_nobody_to_remind(db, designer):
    client = Client(name="X")
    db.add(client)
    db.commit()
    make_entry(db, client.id, None, from_production=True, custom_deadline=date(2026, 10, 29), created_by=designer.id)
    assert reminders.deadline_reminders(db, NOW) == []


def test_deadline_reminders_not_repeated_and_rearm_when_deadline_changes(db, designer):
    entry = deadline_day(db, designer, days_from_today=1)
    assert len(reminders.deadline_reminders(db, NOW)) == 1
    assert reminders.deadline_reminders(db, NOW + timedelta(hours=1)) == []
    entry.custom_deadline = date(2026, 10, 29) + timedelta(days=0)  # mesmo prazo: continua sem repetir
    db.commit()
    assert reminders.deadline_reminders(db, NOW + timedelta(hours=2)) == []
    entry.custom_deadline = date(2026, 10, 30)
    db.commit()
    assert reminders.deadline_reminders(db, NOW + timedelta(days=1)) != []  # amanhã é o novo "amanhã"


def test_duplicate_key_from_another_process_is_swallowed(db, designer, monkeypatch):
    deadline_day(db, designer, days_from_today=1)

    def boom(*a, **k):
        raise IntegrityError("insert", {}, Exception("duplicate"))

    monkeypatch.setattr(reminders.notifications, "create_notifications", boom)
    assert reminders.deadline_reminders(db, NOW) == []  # não derruba o laço


# --- laço em segundo plano ----------------------------------------------------------------------------------


def test_worker_tick_creates_due_reminders_and_counts_them(db, designer, monkeypatch):
    make_event(db, designer, starts=datetime(2026, 10, 28, 12, 20))
    monkeypatch.setattr("app.services.notification_worker.utcnow", lambda: NOW)
    worker = NotificationWorker()
    assert worker.tick() == 1
    assert worker.tick() == 0  # segunda rodada: nada novo
    assert [n.type for n in inbox(db, designer.id)] == [reminders.TYPE_AGENDA_30M]
