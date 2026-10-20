# backend/app/routers/calendar.py
from datetime import date, datetime, timezone
from calendar import monthrange

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, exists, extract, inspect, text
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_permission
from app.models.calendar_entry import CalendarEntry
from app.models.calendar_period import CalendarPeriod
from app.models.tag import Tag
from app.models.client import Client
from app.models.user import User
from app.routers.calendar_periods import get_period_status
from app.schemas.calendar_entry import (
    DELIVERED_STATUSES,
    CalendarEntryBulkCreate,
    CalendarEntryBulkResult,
    CalendarEntryCreate,
    CalendarEntryOut,
    CalendarEntryUpdate,
)

router = APIRouter()


_LOCKED_PERIOD_STATUSES = {
    "finalizado",
    "enviado_aprovacao_amanda",
    "aprovado_amanda",
    "enviado_aprovacao_cliente",
}


def _ensure_period_editable(db: Session, client_id: int, entry_date: date) -> None:
    period_status = get_period_status(db, client_id, entry_date.year, entry_date.month)
    if period_status in _LOCKED_PERIOD_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Esse cronograma está em aprovação ou já foi finalizado — reprove antes de editar.",
        )


# Campos de planejamento: travados quando o cronograma do mês está finalizado.
# Status, arte final, legenda e o nome da publicação (título) continuam
# editáveis — a Produção precisa nomear postagens de cronogramas finalizados.
PLANNING_FIELDS = (
    "client_id",
    "scheduled_date",
    "theme",
    "execution_notes",
    "reference_link",
    "reference_image",
    "material_files",
    "material_notes",
)


def _load_tags(db: Session, tag_ids: list[int]) -> list[Tag]:
    unique_ids = list(dict.fromkeys(tag_ids))
    if not unique_ids:
        return []
    tags = db.query(Tag).filter(Tag.id.in_(unique_ids)).all()
    if len(tags) != len(unique_ids):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Etiqueta inválida")
    return tags


@router.get("/calendar-entries", response_model=list[CalendarEntryOut])
async def list_calendar_entries(
    client_id: int | None = Query(default=None),
    month: str | None = Query(default=None, description="YYYY-MM"),
    period_status: str | None = Query(default=None, description="Só postagens cujo mês do cliente está nesse status"),
    assignee_id: int | None = Query(default=None, description="Só postagens desse responsável"),
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("calendar.view")),
):
    query = db.query(CalendarEntry)

    if period_status is not None:
        query = query.filter(
            exists().where(
                and_(
                    CalendarPeriod.client_id == CalendarEntry.client_id,
                    CalendarPeriod.year == extract("year", CalendarEntry.scheduled_date),
                    CalendarPeriod.month == extract("month", CalendarEntry.scheduled_date),
                    CalendarPeriod.status == period_status,
                )
            )
        )

    if client_id is not None:
        query = query.filter(CalendarEntry.client_id == client_id)

    if assignee_id is not None:
        query = query.filter(CalendarEntry.assignee_id == assignee_id)

    if month is not None:
        try:
            year_str, month_str = month.split("-")
            year, month_num = int(year_str), int(month_str)
        except (ValueError, AttributeError):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Parâmetro month inválido (use YYYY-MM)")

        start = date(year, month_num, 1)
        end = date(year, month_num, monthrange(year, month_num)[1])
        query = query.filter(CalendarEntry.scheduled_date >= start, CalendarEntry.scheduled_date <= end)

    return query.order_by(CalendarEntry.scheduled_date).all()


@router.get("/calendar-entries/{entry_id}", response_model=CalendarEntryOut)
async def get_calendar_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("calendar.view")),
):
    entry = db.get(CalendarEntry, entry_id)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entrada não encontrada")
    return entry


@router.post("/calendar-entries/bulk", response_model=CalendarEntryBulkResult)
async def bulk_create_calendar_entries(
    payload: CalendarEntryBulkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("calendar.create")),
):
    """
    Cria várias postagens numa transação só: valida tudo antes de gravar e,
    se qualquer linha falhar, não grava nenhuma. Com `dry_run=true` roda a
    mesma validação e devolve o resultado sem persistir nada.
    """
    errors: list[str] = []
    clients_ok: dict[int, bool] = {}
    client_by_id: dict[int, Client] = {}
    period_ok: dict[tuple[int, int, int], bool] = {}

    for index, item in enumerate(payload.entries, start=1):
        if item.client_id not in clients_ok:
            client = db.get(Client, item.client_id)
            clients_ok[item.client_id] = client is not None
            if client is not None:
                client_by_id[item.client_id] = client
        if not clients_ok[item.client_id]:
            errors.append(f"Linha {index}: cliente {item.client_id} inválido")
            continue

        key = (item.client_id, item.scheduled_date.year, item.scheduled_date.month)
        if key not in period_ok:
            period_ok[key] = get_period_status(db, *key) != "finalizado"
        if not period_ok[key]:
            errors.append(
                f"Linha {index}: o cronograma {key[2]:02d}/{key[1]} do cliente {item.client_id} "
                "já foi finalizado — reprove antes de editar"
            )

    if errors:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=errors)

    if payload.dry_run:
        return CalendarEntryBulkResult(dry_run=True, count=len(payload.entries), entries=[])

    created = []
    for item in payload.entries:
        data = item.model_dump(exclude={"tag_ids"})
        client = client_by_id[item.client_id]
        # Mesmo padrão da criação avulsa: solicitante = social do cliente,
        # responsável = designer do cliente (quando não vierem informados).
        if data["requester_id"] is None:
            data["requester_id"] = client.default_social_id
        if data["assignee_id"] is None:
            data["assignee_id"] = client.default_designer_id
        created.append(CalendarEntry(**data, created_by=current_user.id))
    for entry in created:
        db.add(entry)
    db.commit()
    for entry in created:
        db.refresh(entry)
    return CalendarEntryBulkResult(dry_run=False, count=len(created), entries=created)


@router.post("/calendar-entries", response_model=CalendarEntryOut, status_code=201)
async def create_calendar_entry(
    payload: CalendarEntryCreate,
    from_production: bool = Query(
        default=False,
        description="Demanda criada pelo quadro de Produção: aceita mês já finalizado",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("calendar.create")),
):
    client = db.get(Client, payload.client_id)
    if client is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cliente inválido")

    for user_id in (payload.requester_id, payload.assignee_id):
        if user_id is not None and db.get(User, user_id) is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Usuário inválido")

    # Cronograma finalizado trava o planejamento, mas o quadro de Produção
    # pode abrir demandas novas nele.
    if not from_production:
        _ensure_period_editable(db, payload.client_id, payload.scheduled_date)

    data = payload.model_dump()
    tags = _load_tags(db, data.pop("tag_ids"))
    # Sem escolha explícita: solicitante = social do cliente, responsável = designer do cliente.
    if data["requester_id"] is None:
        data["requester_id"] = client.default_social_id
    if data["assignee_id"] is None:
        data["assignee_id"] = client.default_designer_id

    entry = CalendarEntry(**data, created_by=current_user.id)
    entry.tags = tags
    if entry.status in DELIVERED_STATUSES:
        entry.delivered_at = datetime.now(timezone.utc)
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.patch("/calendar-entries/{entry_id}", response_model=CalendarEntryOut)
async def update_calendar_entry(
    entry_id: int,
    payload: CalendarEntryUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("calendar.edit")),
):
    entry = db.get(CalendarEntry, entry_id)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entrada não encontrada")

    data = payload.model_dump(exclude_unset=True)
    # Etiquetas são do fluxo de produção: editáveis mesmo com o mês finalizado.
    tag_ids = data.pop("tag_ids", None)
    if tag_ids is not None:
        entry.tags = _load_tags(db, tag_ids)

    # Mês finalizado só aceita mudanças do fluxo de produção (status, arte
    # final, legenda); o planejamento fica travado. Reenviar o mesmo valor
    # de um campo de planejamento é aceito (o drawer manda o form inteiro).
    if any(
        field in data and data[field] != getattr(entry, field)
        for field in PLANNING_FIELDS
    ):
        _ensure_period_editable(db, entry.client_id, entry.scheduled_date)

    if "client_id" in data and db.get(Client, data["client_id"]) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cliente inválido")

    for key in ("requester_id", "assignee_id"):
        if data.get(key) is not None and db.get(User, data[key]) is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Usuário inválido")

    # Controle de prazo: registra a 1ª entrega; voltar pra produção/andamento zera.
    new_status = data.get("status")
    if new_status is not None:
        if new_status in DELIVERED_STATUSES:
            if entry.delivered_at is None:
                entry.delivered_at = datetime.now(timezone.utc)
        else:
            entry.delivered_at = None

    for field, value in data.items():
        setattr(entry, field, value)

    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/calendar-entries/{entry_id}", status_code=204)
async def delete_calendar_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("calendar.delete")),
):
    entry = db.get(CalendarEntry, entry_id)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entrada não encontrada")

    _ensure_period_editable(db, entry.client_id, entry.scheduled_date)

    # A tabela legada `demands` (módulo removido) ainda pode existir no banco
    # com FK pra postagem — solta o vínculo, senão apagar daria IntegrityError.
    if inspect(db.get_bind()).has_table("demands"):
        db.execute(text("UPDATE demands SET calendar_entry_id = NULL WHERE calendar_entry_id = :id"), {"id": entry_id})

    db.delete(entry)
    db.commit()
