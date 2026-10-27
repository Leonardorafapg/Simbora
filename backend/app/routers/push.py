# backend/app/routers/push.py
import asyncio

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.push_subscription import PushSubscription
from app.models.user import User
from app.services import push

router = APIRouter()


class PushKeys(BaseModel):
    p256dh: str = Field(min_length=1, max_length=255)
    auth: str = Field(min_length=1, max_length=100)


class PushSubscribeIn(BaseModel):
    """Formato do `PushSubscription.toJSON()` do navegador."""

    endpoint: str = Field(min_length=10, max_length=1000)
    keys: PushKeys

    @property
    def secure(self) -> bool:
        return self.endpoint.startswith("https://")


class PushUnsubscribeIn(BaseModel):
    endpoint: str = Field(min_length=10, max_length=1000)


class PushStatusOut(BaseModel):
    enabled: bool
    public_key: str | None
    # Aparelhos da pessoa já inscritos.
    devices: int


@router.get("/push/status", response_model=PushStatusOut)
async def push_status(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return PushStatusOut(
        enabled=push.is_enabled(),
        public_key=settings.VAPID_PUBLIC_KEY if push.is_enabled() else None,
        devices=db.query(PushSubscription).filter(PushSubscription.user_id == current_user.id).count(),
    )


@router.post("/push/subscribe", status_code=204)
async def subscribe(
    payload: PushSubscribeIn,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not push.is_enabled():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Notificação no celular não está configurada no servidor.")
    if not payload.secure:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Endereço de push inválido.")
    push.subscribe(
        db,
        current_user.id,
        endpoint=payload.endpoint,
        p256dh=payload.keys.p256dh,
        auth=payload.keys.auth,
        user_agent=request.headers.get("user-agent"),
    )


@router.post("/push/unsubscribe", status_code=204)
async def unsubscribe(
    payload: PushUnsubscribeIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    push.unsubscribe(db, current_user.id, payload.endpoint)


@router.post("/push/test")
async def send_test(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Manda um push de teste pros aparelhos da própria pessoa."""
    if not push.is_enabled():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Notificação no celular não está configurada no servidor.")
    if db.query(PushSubscription).filter(PushSubscription.user_id == current_user.id).count() == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nenhum aparelho seu está inscrito ainda.")
    sent = await asyncio.to_thread(
        push.send_to_users,
        [(current_user.id, {"title": "Simbora CRM", "body": "Notificações ativadas neste aparelho. ✅", "link": "/agenda"})],
    )
    return {"sent": sent}
