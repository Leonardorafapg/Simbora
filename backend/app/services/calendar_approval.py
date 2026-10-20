# backend/app/services/calendar_approval.py
"""
Orquestra a cadeia de aprovação de um CalendarPeriod (ver
docs/plano-aprovacao-calendario.md): Amanda aprova internamente, depois o
PDF some automaticamente pro grupo de WhatsApp do cliente com um link de
aprovação assinado (sem login).
"""
import logging

from sqlalchemy.orm import Session

from app.core import evolution_client
from app.core.config import settings
from app.core.security import create_calendar_approval_token
from app.models.calendar_approval import CalendarApproval
from app.models.calendar_period import CalendarPeriod
from app.models.client import Client

logger = logging.getLogger("calendar_approval")


def _group_jid(value: str | None) -> str | None:
    """Mesma normalização usada em routers/whatsapp.py: aceita o JID inteiro ou só o número."""
    value = (value or "").strip()
    if not value:
        return None
    return value if "@" in value else f"{value}@g.us"


def build_approval_link(period_id: int) -> str:
    token = create_calendar_approval_token(period_id)
    return f"{settings.FRONTEND_ORIGIN}/aprovacao/{token}"


async def send_pdf_to_client(db: Session, period: CalendarPeriod, client: Client) -> None:
    """
    Dispara o PDF + link de aprovação pro grupo de WhatsApp do cliente.
    Best-effort de propósito (como o resto das integrações com a Evolution
    neste projeto): se o envio falhar, o período já avançou de status — quem
    toca o grupo do cliente vê o log e reenvia manualmente se precisar, em vez
    de travar o fluxo de aprovação interno por causa de uma falha externa.
    """
    jid = _group_jid(client.whatsapp_group_id)
    if not jid:
        logger.warning(
            "Cliente %s sem whatsapp_group_id configurado — PDF do período %s não foi enviado.",
            client.id,
            period.id,
        )
        return

    if not period.pdf_url:
        logger.warning("Período %s aprovado sem pdf_url — nada pra enviar.", period.id)
        return

    link = build_approval_link(period.id)
    caption = (
        f"📅 Calendário de conteúdo de {period.month:02d}/{period.year} aprovado internamente.\n\n"
        f"Para aprovar ou pedir ajustes, acesse: {link}"
    )
    file_name = f"calendario-{client.name}-{period.month:02d}-{period.year}.pdf"

    try:
        await evolution_client.send_document_url(jid, period.pdf_url, file_name, caption)
    except Exception:
        logger.exception("Falha ao enviar PDF do período %s pro grupo do cliente %s", period.id, client.id)


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
