# backend/app/core/security.py
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.core.config import settings
from app.models.user import User


def hash_password(plain_password: str) -> str:
    return bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), password_hash.encode("utf-8"))


def create_access_token(user: User) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "name": user.full_name,
        "photo_url": user.photo_url,
        "cargo": user.cargo,
        "is_admin": user.is_admin,
        "permissions": user.permissions,
        "iat": now,
        "exp": now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> dict:
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])


_CALENDAR_APPROVAL_TOKEN_TYPE = "calendar_approval"


def create_calendar_approval_token(period_id: int) -> str:
    """
    Token assinado (sem usuário associado) que vira o link mandado ao cliente
    no WhatsApp — ele aprova/reprova sem precisar de conta no CRM. Validade
    curta (`CALENDAR_APPROVAL_TOKEN_EXPIRE_DAYS`): não é pensado pra ficar
    reutilizável depois que a rodada de aprovação daquele período terminou.
    """
    now = datetime.now(timezone.utc)
    payload = {
        "typ": _CALENDAR_APPROVAL_TOKEN_TYPE,
        "period_id": period_id,
        "iat": now,
        "exp": now + timedelta(days=settings.CALENDAR_APPROVAL_TOKEN_EXPIRE_DAYS),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_calendar_approval_token(token: str) -> int:
    """Devolve o `period_id` do token, ou lança `jwt.PyJWTError` se inválido/expirado/de outro tipo."""
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    if payload.get("typ") != _CALENDAR_APPROVAL_TOKEN_TYPE:
        raise jwt.InvalidTokenError("Token não é de aprovação de calendário")
    return int(payload["period_id"])
