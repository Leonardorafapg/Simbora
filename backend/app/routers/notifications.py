# backend/app/routers/notifications.py
import asyncio

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session

from app.core.database import SessionLocal, get_db
from app.core.deps import get_current_user
from app.core.security import decode_access_token
from app.core.ws_manager import user_manager
from app.models.user import User
from app.schemas.notification import NotificationOut, UnreadCountOut
from app.services import notifications

router = APIRouter()


@router.get("/notifications", response_model=list[NotificationOut])
async def list_notifications(
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    unread_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return notifications.list_for_user(db, current_user.id, limit=limit, offset=offset, unread_only=unread_only)


@router.get("/notifications/unread-count", response_model=UnreadCountOut)
async def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return UnreadCountOut(unread=notifications.unread_count(db, current_user.id))


# Rotas fixas ANTES de `/{id}` — senão "read-all" seria lido como um id.
@router.post("/notifications/read-all", response_model=UnreadCountOut)
async def read_all(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notifications.mark_all_read(db, current_user.id)
    return UnreadCountOut(unread=0)


@router.post("/notifications/{notification_id}/read", response_model=NotificationOut)
async def read_one(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notification = notifications.mark_read(db, current_user.id, notification_id)
    if notification is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Aviso não encontrado.")
    return notification


@router.websocket("/notifications/ws")
async def notifications_ws(websocket: WebSocket, token: str = Query(...)):
    """Avisos em tempo real só pra quem está logado — o JWT vem no query param
    (o navegador não manda header Authorization em WebSocket)."""
    try:
        user_id = int(decode_access_token(token)["sub"])
    except Exception:
        await websocket.close(code=4401)
        return

    db = SessionLocal()
    try:
        user = db.get(User, user_id)
        active = user is not None and user.is_active
    finally:
        db.close()
    if not active:
        await websocket.close(code=4401)
        return

    await user_manager.connect(websocket, user_id)
    try:
        while True:
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
            except asyncio.TimeoutError:
                await websocket.send_json({"type": "ping"})
    except WebSocketDisconnect:
        pass
    finally:
        user_manager.disconnect(websocket, user_id)
