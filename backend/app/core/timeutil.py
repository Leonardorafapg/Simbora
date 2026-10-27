# backend/app/core/timeutil.py
"""Horários: o banco guarda UTC sem fuso; a API fala com fuso explícito; o usuário vê Brasília."""
from datetime import datetime, timedelta, timezone

BRT = timezone(timedelta(hours=-3))

MONTHS_PT = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"]

_WEEKDAYS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"]


def utcnow() -> datetime:
    """UTC sem fuso — mesmo formato que as colunas DateTime do banco."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def to_utc_naive(value: datetime) -> datetime:
    """Entrada da API -> UTC sem fuso. Horário sem fuso é lido como Brasília (o que o usuário digita)."""
    if value.tzinfo is None:
        value = value.replace(tzinfo=BRT)
    return value.astimezone(timezone.utc).replace(tzinfo=None)


def as_utc(value: datetime | None) -> datetime | None:
    """UTC sem fuso (banco) -> com fuso explícito na resposta, senão o navegador leria como local."""
    if value is None:
        return None
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def brt_today(now: datetime):
    """Data de hoje em Brasília (a partir de um UTC sem fuso)."""
    return as_utc(now).astimezone(BRT).date()


def format_when(value: datetime) -> str:
    """'qua, 28/10 às 14:00' em horário de Brasília (texto das notificações)."""
    local = as_utc(value).astimezone(BRT)
    return f"{_WEEKDAYS[local.weekday()]}, {local:%d/%m} às {local:%H:%M}"
