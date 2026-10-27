# backend/app/services/calendar_approval.py
"""
Aprovação de um CalendarPeriod (ver docs/plano-aprovacao-calendario.md): o time envia o mês,
a Amanda aprova (ou reprova com motivo) e, aprovado, as postagens entram direto na Produção.
Não há mais etapa do cliente.
"""
from sqlalchemy.orm import Session

from app.models.calendar_approval import CalendarApproval
from app.models.calendar_period import CalendarPeriod


def record_decision(
    db: Session,
    period: CalendarPeriod,
    stage: str,
    decision: str,
    reason: str | None,
    decided_by_user_id: int | None,
) -> CalendarApproval:
    approval = CalendarApproval(
        period_id=period.id,
        stage=stage,
        decision=decision,
        reason=reason,
        decided_by_user_id=decided_by_user_id,
    )
    db.add(approval)
    return approval
