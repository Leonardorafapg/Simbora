# backend/app/services/deadlines.py
"""Prazo de entrega das demandas — mesma regra do CRM (crm/lib/deadline.ts).

Todo post da semana (segunda a domingo) deve ser entregue até a quinta-feira da semana
anterior, a menos que a demanda tenha um prazo personalizado.
"""
from datetime import date, timedelta

from app.models.calendar_entry import CalendarEntry
from app.schemas.calendar_entry import DELIVERED_STATUSES

# Demanda ainda "na mão" do designer: só nesses status faz sentido lembrar do prazo.
PENDING_STATUSES = ("producao", "andamento")


def deadline_for(scheduled_date: date) -> date:
    """Quinta-feira da semana anterior à semana (seg-dom) da data da postagem."""
    return scheduled_date - timedelta(days=scheduled_date.weekday() + 4)


def entry_deadline(entry: CalendarEntry) -> date:
    return entry.custom_deadline or deadline_for(entry.scheduled_date)


def is_delivered(status: str) -> bool:
    return status in DELIVERED_STATUSES
