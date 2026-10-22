# backend/app/routers/calendar_periods.py
import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_permission
from app.core.security import decode_calendar_approval_token
from app.models.calendar_period import CalendarPeriod
from app.models.client import Client
from app.models.user import User
from app.schemas.calendar_period import (
    CalendarApprovalPublicOut,
    CalendarPeriodDecisaoAmanda,
    CalendarPeriodDecisaoCliente,
    CalendarPeriodEnviarAprovacao,
    CalendarPeriodOut,
    CalendarPeriodPendingOut,
    CalendarPeriodSetStatus,
)
from app.services import calendar_approval

router = APIRouter()


def get_period_status(db: Session, client_id: int, year: int, month: int) -> str:
    """Não persiste nada — mês sem registro é simplesmente 'em_andamento'."""
    period = (
        db.query(CalendarPeriod)
        .filter(
            CalendarPeriod.client_id == client_id,
            CalendarPeriod.year == year,
            CalendarPeriod.month == month,
        )
        .first()
    )
    return period.status if period else "em_andamento"


def _get_or_404(db: Session, client_id: int, year: int, month: int) -> CalendarPeriod:
    period = (
        db.query(CalendarPeriod)
        .filter(
            CalendarPeriod.client_id == client_id,
            CalendarPeriod.year == year,
            CalendarPeriod.month == month,
        )
        .first()
    )
    if period is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cronograma não encontrado")
    return period


@router.get("/calendar-periods/pending-approval", response_model=list[CalendarPeriodPendingOut])
async def listar_aprovacoes_pendentes(
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("calendar.approve")),
):
    """
    Caixa de entrada central: todo período que está em qualquer etapa da
    cadeia de aprovação (ver docs/plano-aprovacao-calendario.md), pra não
    precisar entrar cliente por cliente pra descobrir o que está pendente.
    """
    periods = (
        db.query(CalendarPeriod)
        .filter(CalendarPeriod.status.in_(["enviado_aprovacao_amanda", "enviado_aprovacao_cliente"]))
        .order_by(CalendarPeriod.updated_at.desc())
        .all()
    )
    if not periods:
        return []

    client_ids = {p.client_id for p in periods}
    clients_by_id = {c.id: c for c in db.query(Client).filter(Client.id.in_(client_ids)).all()}

    return [
        CalendarPeriodPendingOut(
            client_id=p.client_id,
            client_name=clients_by_id[p.client_id].name if p.client_id in clients_by_id else "Cliente removido",
            year=p.year,
            month=p.month,
            status=p.status,
            pdf_url=p.pdf_url,
            updated_at=p.updated_at.isoformat(),
        )
        for p in periods
    ]


@router.get("/calendar-periods", response_model=CalendarPeriodOut)
async def get_calendar_period(
    client_id: int = Query(...),
    year: int = Query(...),
    month: int = Query(...),
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("calendar.view")),
):
    return CalendarPeriodOut(
        client_id=client_id,
        year=year,
        month=month,
        status=get_period_status(db, client_id, year, month),
    )


@router.put("/calendar-periods", response_model=CalendarPeriodOut)
async def set_calendar_period_status(
    payload: CalendarPeriodSetStatus,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("calendar.edit")),
):
    period = (
        db.query(CalendarPeriod)
        .filter(
            CalendarPeriod.client_id == payload.client_id,
            CalendarPeriod.year == payload.year,
            CalendarPeriod.month == payload.month,
        )
        .first()
    )

    if period is None:
        period = CalendarPeriod(client_id=payload.client_id, year=payload.year, month=payload.month)
        db.add(period)

    period.status = payload.status

    db.commit()
    db.refresh(period)
    return period


@router.post("/calendar-periods/enviar-aprovacao", response_model=CalendarPeriodOut)
async def enviar_para_aprovacao(
    payload: CalendarPeriodEnviarAprovacao,
    db: Session = Depends(get_db),
    _: User = Depends(require_permission("calendar.edit")),
):
    """Time marca o mês como pronto — avança pra 'enviado_aprovacao_amanda'."""
    period = (
        db.query(CalendarPeriod)
        .filter(
            CalendarPeriod.client_id == payload.client_id,
            CalendarPeriod.year == payload.year,
            CalendarPeriod.month == payload.month,
        )
        .first()
    )
    if period is None:
        # Status explícito aqui: o default da coluna só é aplicado no INSERT,
        # então sem isso `period.status` fica None até o commit e a checagem
        # abaixo recusaria até o primeiro envio de um cliente/mês novo.
        period = CalendarPeriod(client_id=payload.client_id, year=payload.year, month=payload.month, status="em_andamento")
        db.add(period)

    if period.status not in ("em_andamento", "reprovado"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Só é possível enviar para aprovação um cronograma em andamento ou reprovado.",
        )

    period.status = "enviado_aprovacao_amanda"
    period.pdf_url = payload.pdf_url

    db.commit()
    db.refresh(period)
    return period


@router.post("/calendar-periods/decisao-amanda", response_model=CalendarPeriodOut)
async def decidir_amanda(
    payload: CalendarPeriodDecisaoAmanda,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("calendar.approve")),
):
    period = _get_or_404(db, payload.client_id, payload.year, payload.month)

    if period.status != "enviado_aprovacao_amanda":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este cronograma não está aguardando a aprovação da Amanda.",
        )

    calendar_approval.record_decision(
        db, period, stage="amanda", decision=payload.decision, reason=payload.reason, decided_by_user_id=current_user.id
    )

    if payload.decision == "reprovado":
        period.status = "em_andamento"
        db.commit()
        db.refresh(period)
        return period

    period.status = "enviado_aprovacao_cliente"
    db.commit()
    db.refresh(period)

    client = db.get(Client, period.client_id)
    if client is not None:
        await calendar_approval.send_pdf_to_client(db, period, client)

    return period


@router.get("/calendar-periods/approval/{token}", response_model=CalendarApprovalPublicOut)
async def obter_aprovacao_publica(token: str, db: Session = Depends(get_db)):
    """Rota pública (sem login) — a página que o cliente abre pelo link do WhatsApp."""
    try:
        period_id = decode_calendar_approval_token(token)
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Link inválido ou expirado")

    period = db.get(CalendarPeriod, period_id)
    if period is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cronograma não encontrado")

    client = db.get(Client, period.client_id)
    if client is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente não encontrado")

    return CalendarApprovalPublicOut(
        client_id=client.id,
        client_name=client.name,
        year=period.year,
        month=period.month,
        status=period.status,
        pdf_url=period.pdf_url,
    )


@router.post("/calendar-periods/approval/{token}/decisao", response_model=CalendarApprovalPublicOut)
async def decidir_cliente(token: str, payload: CalendarPeriodDecisaoCliente, db: Session = Depends(get_db)):
    """Decisão do cliente pelo link assinado — sem autenticação de usuário."""
    try:
        period_id = decode_calendar_approval_token(token)
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Link inválido ou expirado")

    period = db.get(CalendarPeriod, period_id)
    if period is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cronograma não encontrado")

    if period.status != "enviado_aprovacao_cliente":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este link já foi usado ou o cronograma não está mais aguardando aprovação do cliente.",
        )

    calendar_approval.record_decision(
        db, period, stage="cliente", decision=payload.decision, reason=payload.reason, decided_by_user_id=None
    )

    period.status = "finalizado" if payload.decision == "aprovado" else "em_andamento"
    db.commit()
    db.refresh(period)

    client = db.get(Client, period.client_id)
    return CalendarApprovalPublicOut(
        client_id=period.client_id,
        client_name=client.name if client else "",
        year=period.year,
        month=period.month,
        status=period.status,
        pdf_url=period.pdf_url,
    )
