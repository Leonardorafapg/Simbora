# backend/app/services/oauth.py
"""
Regras do login OAuth 2.1 dos clientes MCP (Claude, Codex, Gemini, Antigravity...).
O router (routers/oauth.py) só traduz HTTP; toda a lógica fica aqui.
"""
import base64
import hashlib
import hmac
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

import jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import verify_password
from app.models.oauth import OAuthAuthorizationCode, OAuthClient, OAuthGrant, OAuthRefreshToken
from app.models.user import User

SCOPES: dict[str, str] = {
    "crm.read": "Ler clientes, calendário e equipe",
    "crm.write": "Criar e editar",
    "crm.delete": "Apagar",
}
DEFAULT_SCOPES = ["crm.read", "crm.write", "crm.delete"]

CODE_TTL = timedelta(minutes=5)
TOKEN_TYP = "mcp_access"
LAST_USED_THROTTLE = timedelta(minutes=1)

# Rotas (após /api/v1) que um token MCP pode tocar. Precisa crescer junto com as tools do MCP.
MCP_ALLOWED_PREFIXES = (
    "/auth/me",
    "/clients",
    "/calendar-entries",
    "/calendar-periods",
    "/tags",
    "/search",
    "/users/directory",
    "/team/members",
    "/team/permissions",
    "/uploads/from-url",
)

TRUSTED_REDIRECT_HOSTS = {"claude.ai", "claude.com"}
LOOPBACK_HOSTS = {"localhost", "127.0.0.1", "[::1]", "::1"}


class OAuthError(Exception):
    """Erro no formato RFC 6749 (error + error_description)."""

    def __init__(self, error: str, description: str = "", status_code: int = 400):
        super().__init__(description or error)
        self.error = error
        self.description = description
        self.status_code = status_code


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def issuer() -> str:
    url = settings.PUBLIC_API_URL.rstrip("/")
    if not url:
        raise OAuthError("server_error", "PUBLIC_API_URL não configurada no backend", 503)
    return url


def resource_url() -> str:
    url = settings.MCP_RESOURCE_URL.rstrip("/")
    if not url:
        raise OAuthError("server_error", "MCP_RESOURCE_URL não configurada no backend", 503)
    return url


def _same_resource(value: str | None) -> bool:
    return (value or "").rstrip("/") == resource_url()


def is_configured() -> bool:
    return bool(settings.PUBLIC_API_URL and settings.MCP_RESOURCE_URL)


# --- Redirect URIs -------------------------------------------------------------------


def _extra_hosts() -> set[str]:
    return {h.strip().lower() for h in settings.OAUTH_EXTRA_REDIRECT_HOSTS.split(",") if h.strip()}


def is_redirect_allowed(uri: str) -> bool:
    """Loopback (RFC 8252) em qualquer porta, ou HTTPS em host confiável. Mais nada."""
    try:
        parsed = urlparse(uri)
        host = (parsed.hostname or "").lower()
        _ = parsed.port  # valida a porta
    except ValueError:
        return False
    if parsed.fragment or not host:
        return False
    if parsed.scheme == "http":
        return host in {"localhost", "127.0.0.1", "::1"}
    if parsed.scheme == "https":
        return host in TRUSTED_REDIRECT_HOSTS or host in _extra_hosts()
    return False


# --- Clientes (DCR) ------------------------------------------------------------------


def register_client(db: Session, payload: dict) -> dict:
    redirect_uris = payload.get("redirect_uris")
    if not isinstance(redirect_uris, list) or not redirect_uris or not all(isinstance(u, str) for u in redirect_uris):
        raise OAuthError("invalid_redirect_uri", "redirect_uris deve ser uma lista não vazia")
    if len(redirect_uris) > 10:
        raise OAuthError("invalid_redirect_uri", "redirect_uris demais")
    bad = [u for u in redirect_uris if not is_redirect_allowed(u)]
    if bad:
        raise OAuthError("invalid_redirect_uri", f"redirect_uri não permitida: {bad[0][:200]}")

    method = payload.get("token_endpoint_auth_method") or "none"
    if method not in ("none", "client_secret_post", "client_secret_basic"):
        raise OAuthError("invalid_client_metadata", "token_endpoint_auth_method não suportado")

    name = str(payload.get("client_name") or "Cliente MCP").strip()[:200] or "Cliente MCP"
    client_id = secrets.token_urlsafe(24)
    client_secret = secrets.token_urlsafe(32) if method != "none" else None

    db.add(
        OAuthClient(
            client_id=client_id,
            client_secret_hash=sha256(client_secret) if client_secret else None,
            client_name=name,
            redirect_uris=redirect_uris,
            token_endpoint_auth_method=method,
        )
    )
    db.commit()

    out = {
        "client_id": client_id,
        "client_id_issued_at": int(utcnow().replace(tzinfo=timezone.utc).timestamp()),
        "client_name": name,
        "redirect_uris": redirect_uris,
        "grant_types": ["authorization_code", "refresh_token"],
        "response_types": ["code"],
        "token_endpoint_auth_method": method,
    }
    if client_secret:
        out["client_secret"] = client_secret
        out["client_secret_expires_at"] = 0
    return out


def get_client(db: Session, client_id: str | None) -> OAuthClient | None:
    if not client_id:
        return None
    return db.query(OAuthClient).filter(OAuthClient.client_id == client_id).first()


def authenticate_client(db: Session, client_id: str | None, client_secret: str | None) -> OAuthClient:
    client = get_client(db, client_id)
    if client is None:
        raise OAuthError("invalid_client", "Cliente desconhecido", 401)
    if client.token_endpoint_auth_method != "none":
        if not client_secret or not client.client_secret_hash or not hmac.compare_digest(
            sha256(client_secret), client.client_secret_hash
        ):
            raise OAuthError("invalid_client", "Credenciais do cliente inválidas", 401)
    client.last_used_at = utcnow()
    return client


# --- Autorização ---------------------------------------------------------------------


@dataclass
class AuthorizeRequest:
    client: OAuthClient
    redirect_uri: str
    code_challenge: str
    scopes: list[str]
    resource: str
    state: str | None


class AuthorizeError(Exception):
    """Erro na requisição de autorização. `redirect_ok` diz se dá pra devolver o erro por redirect."""

    def __init__(self, error: str, description: str, *, redirect_uri: str | None = None, state: str | None = None):
        super().__init__(description)
        self.error = error
        self.description = description
        self.redirect_uri = redirect_uri
        self.state = state


def validate_authorize_request(db: Session, params: dict) -> AuthorizeRequest:
    # Antes de validar client + redirect_uri, erro NUNCA vira redirect (evita open redirect).
    client = get_client(db, params.get("client_id"))
    if client is None:
        raise AuthorizeError("invalid_request", "Aplicativo desconhecido (client_id inválido).")
    redirect_uri = params.get("redirect_uri") or ""
    if redirect_uri not in (client.redirect_uris or []):
        raise AuthorizeError("invalid_request", "redirect_uri não corresponde ao registrado para este aplicativo.")

    state = params.get("state")

    def fail(error: str, description: str) -> AuthorizeError:
        return AuthorizeError(error, description, redirect_uri=redirect_uri, state=state)

    if params.get("response_type") != "code":
        raise fail("unsupported_response_type", "response_type deve ser 'code'")
    challenge = params.get("code_challenge") or ""
    if not challenge or len(challenge) > 128:
        raise fail("invalid_request", "code_challenge (PKCE) é obrigatório")
    if params.get("code_challenge_method") != "S256":
        raise fail("invalid_request", "code_challenge_method deve ser S256")

    resource = params.get("resource") or resource_url()
    if not _same_resource(resource):
        raise fail("invalid_target", "resource não corresponde a este servidor MCP")

    unknown = [s for s in (params.get("scope") or "").split() if s not in SCOPES]
    if unknown:
        raise fail("invalid_scope", f"Escopo desconhecido: {unknown[0]}")
    # O escopo pedido pelo cliente é só uma sugestão (muitos pedem só o que o MCP anuncia, crm.read):
    # a tela mostra todos os escopos, marcados, e quem decide o que vale é o usuário logado.
    scopes = list(DEFAULT_SCOPES)

    return AuthorizeRequest(
        client=client,
        redirect_uri=redirect_uri,
        code_challenge=challenge,
        scopes=scopes,
        resource=resource_url(),
        state=state,
    )


def authenticate_user(db: Session, email: str, password: str) -> User | None:
    user = db.query(User).filter(User.email == email.strip()).first()
    if user is None or not user.is_active or not verify_password(password, user.password_hash):
        return None
    return user


def create_authorization_code(db: Session, req: AuthorizeRequest, user: User, scopes: list[str]) -> str:
    code = secrets.token_urlsafe(32)
    db.add(
        OAuthAuthorizationCode(
            code_hash=sha256(code),
            client_pk=req.client.id,
            user_id=user.id,
            redirect_uri=req.redirect_uri,
            code_challenge=req.code_challenge,
            scope=" ".join(scopes),
            resource=req.resource,
            expires_at=utcnow() + CODE_TTL,
        )
    )
    db.commit()
    return code


# --- Tokens --------------------------------------------------------------------------


def _pkce_matches(verifier: str, challenge: str) -> bool:
    digest = hashlib.sha256(verifier.encode("ascii", "ignore")).digest()
    expected = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
    return hmac.compare_digest(expected, challenge)


def issue_tokens(db: Session, grant: OAuthGrant, client: OAuthClient) -> dict:
    now = datetime.now(timezone.utc)
    minutes = settings.OAUTH_ACCESS_TOKEN_MINUTES
    access = jwt.encode(
        {
            "typ": TOKEN_TYP,
            "iss": issuer(),
            "aud": grant.resource,
            "sub": str(grant.user_id),
            "client_id": client.client_id,
            "gid": grant.id,
            "scope": grant.scope,
            "iat": now,
            "exp": now + timedelta(minutes=minutes),
            "jti": secrets.token_urlsafe(8),
        },
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )
    refresh = secrets.token_urlsafe(48)
    db.add(
        OAuthRefreshToken(
            token_hash=sha256(refresh),
            grant_id=grant.id,
            expires_at=utcnow() + timedelta(days=settings.OAUTH_REFRESH_TOKEN_DAYS),
        )
    )
    db.commit()
    return {
        "access_token": access,
        "token_type": "Bearer",
        "expires_in": minutes * 60,
        "refresh_token": refresh,
        "scope": grant.scope,
    }


def exchange_code(
    db: Session, client: OAuthClient, code: str | None, redirect_uri: str | None, code_verifier: str | None, resource: str | None
) -> dict:
    if not code or not code_verifier:
        raise OAuthError("invalid_request", "code e code_verifier são obrigatórios")
    row = db.query(OAuthAuthorizationCode).filter(OAuthAuthorizationCode.code_hash == sha256(code)).first()
    if row is None or row.client_pk != client.id:
        raise OAuthError("invalid_grant", "Código inválido")
    if row.used_at is not None:
        # Reuso de code: possível roubo — derruba a conexão que ele gerou.
        if row.grant_id:
            grant = db.get(OAuthGrant, row.grant_id)
            if grant:
                revoke_grant(db, grant)
        raise OAuthError("invalid_grant", "Código já utilizado")
    if row.expires_at <= utcnow():
        raise OAuthError("invalid_grant", "Código expirado")
    if row.redirect_uri != (redirect_uri or ""):
        raise OAuthError("invalid_grant", "redirect_uri diferente da usada na autorização")
    if resource and not _same_resource(resource):
        raise OAuthError("invalid_target", "resource não corresponde")
    if not _pkce_matches(code_verifier, row.code_challenge):
        raise OAuthError("invalid_grant", "code_verifier inválido")

    user = db.get(User, row.user_id)
    if user is None or not user.is_active:
        raise OAuthError("invalid_grant", "Usuário inativo")

    row.used_at = utcnow()
    grant = OAuthGrant(user_id=user.id, client_pk=client.id, scope=row.scope, resource=row.resource)
    db.add(grant)
    db.flush()
    row.grant_id = grant.id
    db.commit()
    return issue_tokens(db, grant, client)


def refresh(db: Session, client: OAuthClient, refresh_token: str | None, scope: str | None) -> dict:
    if not refresh_token:
        raise OAuthError("invalid_request", "refresh_token é obrigatório")
    row = db.query(OAuthRefreshToken).filter(OAuthRefreshToken.token_hash == sha256(refresh_token)).first()
    if row is None:
        raise OAuthError("invalid_grant", "Refresh token inválido")
    grant = db.get(OAuthGrant, row.grant_id)
    if grant is None or grant.client_pk != client.id:
        raise OAuthError("invalid_grant", "Refresh token inválido")
    if row.rotated_at is not None:
        # Token antigo reapresentado: trata como roubo e derruba a conexão inteira.
        revoke_grant(db, grant)
        raise OAuthError("invalid_grant", "Refresh token já utilizado")
    if row.revoked_at is not None or grant.revoked_at is not None or row.expires_at <= utcnow():
        raise OAuthError("invalid_grant", "Refresh token expirado ou revogado")
    user = db.get(User, grant.user_id)
    if user is None or not user.is_active:
        raise OAuthError("invalid_grant", "Usuário inativo")

    if scope:
        wanted = scope.split()
        if not set(wanted) <= set(grant.scope.split()):
            raise OAuthError("invalid_scope", "Escopo maior que o autorizado")
        grant.scope = " ".join(wanted)

    row.rotated_at = utcnow()
    db.commit()
    return issue_tokens(db, grant, client)


# --- Verificação do access token ----------------------------------------------------


@dataclass
class McpTokenInfo:
    user: User
    scopes: set[str]
    grant_id: int
    client_id: str
    exp: int
    resource: str


def decode_mcp_access_token(db: Session, token: str) -> McpTokenInfo | None:
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            audience=resource_url(),
            issuer=issuer(),
        )
        if payload.get("typ") != TOKEN_TYP:
            return None
        user_id = int(payload["sub"])
        grant_id = int(payload["gid"])
    except (jwt.PyJWTError, KeyError, TypeError, ValueError, OAuthError):
        return None

    grant = db.get(OAuthGrant, grant_id)
    if grant is None or grant.revoked_at is not None or grant.user_id != user_id:
        return None
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        return None

    now = utcnow()
    if grant.last_used_at is None or now - grant.last_used_at >= LAST_USED_THROTTLE:
        grant.last_used_at = now
        db.commit()

    return McpTokenInfo(
        user=user,
        scopes=set((payload.get("scope") or "").split()),
        grant_id=grant_id,
        client_id=str(payload.get("client_id") or ""),
        exp=int(payload["exp"]),
        resource=str(payload.get("aud")),
    )


def introspect(db: Session, token: str) -> dict:
    info = decode_mcp_access_token(db, token)
    if info is None:
        return {"active": False}
    return {
        "active": True,
        "sub": str(info.user.id),
        "username": info.user.email,
        "client_id": info.client_id,
        "scope": " ".join(sorted(info.scopes)),
        "exp": info.exp,
        "aud": info.resource,
        "iss": issuer(),
        "token_type": "Bearer",
    }


def required_scope(method: str) -> str:
    if method in ("GET", "HEAD", "OPTIONS"):
        return "crm.read"
    if method == "DELETE":
        return "crm.delete"
    return "crm.write"


def path_allowed(path: str) -> bool:
    """`path` já sem o prefixo /api/v1."""
    return any(path == p or path.startswith(p + "/") for p in MCP_ALLOWED_PREFIXES)


# --- Revogação / listagem ------------------------------------------------------------


def revoke_grant(db: Session, grant: OAuthGrant) -> None:
    now = utcnow()
    if grant.revoked_at is None:
        grant.revoked_at = now
    for rt in db.query(OAuthRefreshToken).filter(
        OAuthRefreshToken.grant_id == grant.id, OAuthRefreshToken.revoked_at.is_(None)
    ):
        rt.revoked_at = now
    db.commit()


def revoke_all_for_user(db: Session, user_id: int) -> None:
    for grant in db.query(OAuthGrant).filter(OAuthGrant.user_id == user_id, OAuthGrant.revoked_at.is_(None)):
        revoke_grant(db, grant)


def delete_user_oauth_data(db: Session, user_id: int) -> None:
    """Remove tudo do usuário (usado ao apagar a conta, por causa das chaves estrangeiras)."""
    grant_ids = [g.id for g in db.query(OAuthGrant.id).filter(OAuthGrant.user_id == user_id)]
    db.query(OAuthAuthorizationCode).filter(OAuthAuthorizationCode.user_id == user_id).delete()
    if grant_ids:
        db.query(OAuthRefreshToken).filter(OAuthRefreshToken.grant_id.in_(grant_ids)).delete(synchronize_session=False)
        db.query(OAuthGrant).filter(OAuthGrant.id.in_(grant_ids)).delete(synchronize_session=False)
    db.flush()


def revoke_by_token(db: Session, token: str) -> None:
    """RFC 7009: aceita refresh token ou access token. Silencioso se não reconhecer."""
    row = db.query(OAuthRefreshToken).filter(OAuthRefreshToken.token_hash == sha256(token)).first()
    grant: OAuthGrant | None = db.get(OAuthGrant, row.grant_id) if row else None
    if grant is None:
        try:
            payload = jwt.decode(
                token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM], audience=resource_url(), issuer=issuer()
            )
            if payload.get("typ") == TOKEN_TYP:
                grant = db.get(OAuthGrant, int(payload["gid"]))
        except (jwt.PyJWTError, KeyError, TypeError, ValueError, OAuthError):
            grant = None
    if grant is not None:
        revoke_grant(db, grant)


def active_grants(db: Session, user_id: int) -> list[tuple[OAuthGrant, OAuthClient]]:
    rows = (
        db.query(OAuthGrant, OAuthClient)
        .join(OAuthClient, OAuthClient.id == OAuthGrant.client_pk)
        .filter(OAuthGrant.user_id == user_id, OAuthGrant.revoked_at.is_(None))
        .order_by(OAuthGrant.created_at.desc())
        .all()
    )
    return [(g, c) for g, c in rows]
