# backend/app/core/deps.py
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
import jwt

from app.core.database import get_db
from app.core.permissions import has_permission
from app.core.security import decode_access_token
from app.models.user import User

bearer_scheme = HTTPBearer(auto_error=False)

API_PREFIX = "/api/v1"


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


def _forbidden(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)


def _mcp_user(request: Request, token: str, db: Session) -> User:
    """Token de conexão de IA (MCP): vale o usuário dono + travas de escopo e de rota."""
    from app.services import oauth  # import tardio: o serviço depende de core.security

    info = oauth.decode_mcp_access_token(db, token)
    if info is None:
        raise _unauthorized("Token inválido ou expirado")

    path = request.url.path.removeprefix(API_PREFIX)
    if not oauth.path_allowed(path):
        raise _forbidden("Rota não disponível via MCP")

    needed = oauth.required_scope(request.method)
    if needed not in info.scopes:
        raise _forbidden(f"Esta conexão de IA não tem o escopo {needed}. Reconecte autorizando esse acesso.")

    request.state.mcp = info
    return info.user


def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise _unauthorized("Não autenticado")

    token = credentials.credentials
    try:
        unverified = jwt.decode(token, options={"verify_signature": False})
    except jwt.PyJWTError:
        raise _unauthorized("Token inválido ou expirado")

    if unverified.get("typ") == "mcp_access":
        return _mcp_user(request, token, db)

    try:
        payload = decode_access_token(token)
        user_id = int(payload["sub"])
    except (jwt.PyJWTError, KeyError, TypeError, ValueError):
        raise _unauthorized("Token inválido ou expirado")

    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise _unauthorized("Usuário inválido")

    return user


def require_admin(request: Request, current_user: User = Depends(get_current_user)) -> User:
    # Conexões de IA nunca fazem ações de administrador, nem quando o dono é admin.
    if getattr(request.state, "mcp", None) is not None:
        raise _forbidden("Ação de administrador não está disponível via MCP")
    if not current_user.is_admin:
        raise _forbidden("Permissão insuficiente")
    return current_user


def require_permission(key: str):
    """Dependency factory: `Depends(require_permission("client.view"))`."""

    def checker(current_user: User = Depends(get_current_user)) -> User:
        if not has_permission(current_user, key):
            raise _forbidden("Permissão insuficiente")
        return current_user

    return checker
