# backend/app/routers/oauth.py
"""
Servidor de autorização OAuth 2.1 dos clientes MCP (RFC 8414, 7591, 7009, 7662, PKCE S256).

`router` fica na raiz (metadata em /.well-known e /oauth/*); `api_router` (prefixo /api/v1) traz a
listagem/revogação de conexões usada pela tela do CRM.
"""
import base64
import binascii
import hmac
import secrets
import time
from datetime import datetime
from html import escape
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.rate_limit import client_ip, limiter
from app.models.oauth import OAuthGrant
from app.models.user import User
from app.services import oauth as svc

router = APIRouter()
api_router = APIRouter()

REQUEST_PURPOSE = "mcp_authorize"
REQUEST_MINUTES = 10
CSRF_COOKIE = "mcp_oauth_csrf"

LOGIN_WINDOW = 15 * 60
LOGIN_LIMIT_IP = 10
LOGIN_LIMIT_EMAIL = 5
REGISTER_WINDOW = 60 * 60
REGISTER_LIMIT = 20

NO_STORE = {"Cache-Control": "no-store", "Pragma": "no-cache"}


# --- Respostas -----------------------------------------------------------------------


def _oauth_json(body: dict, status_code: int = 200) -> JSONResponse:
    return JSONResponse(body, status_code=status_code, headers=NO_STORE)


def _error_json(exc: svc.OAuthError) -> JSONResponse:
    body = {"error": exc.error}
    if exc.description:
        body["error_description"] = exc.description
    return _oauth_json(body, exc.status_code)


def _redirect_with(redirect_uri: str, params: dict) -> RedirectResponse:
    parts = urlparse(redirect_uri)
    query = parse_qsl(parts.query, keep_blank_values=True) + [(k, v) for k, v in params.items() if v is not None]
    return RedirectResponse(urlunparse(parts._replace(query=urlencode(query))), status_code=303, headers=NO_STORE)


# --- Metadata ------------------------------------------------------------------------


def _metadata() -> dict:
    base = svc.issuer()
    return {
        # Com "/" no fim: é como o MCP anuncia o authorization server (authorization_servers) e clientes
        # estritos comparam o issuer do metadata com essa URL, texto por texto.
        "issuer": f"{base}/",
        "authorization_endpoint": f"{base}/oauth/authorize",
        "token_endpoint": f"{base}/oauth/token",
        "registration_endpoint": f"{base}/oauth/register",
        "revocation_endpoint": f"{base}/oauth/revoke",
        "introspection_endpoint": f"{base}/oauth/introspect",
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code", "refresh_token"],
        "code_challenge_methods_supported": ["S256"],
        "token_endpoint_auth_methods_supported": ["none", "client_secret_post", "client_secret_basic"],
        "scopes_supported": list(svc.SCOPES),
    }


@router.get("/.well-known/oauth-authorization-server")
@router.get("/.well-known/openid-configuration")
def authorization_server_metadata():
    try:
        return JSONResponse(_metadata(), headers={"Cache-Control": "public, max-age=300"})
    except svc.OAuthError as exc:
        return _error_json(exc)


# --- Registro dinâmico de cliente (RFC 7591) -----------------------------------------


@router.post("/oauth/register")
async def register(request: Request, db: Session = Depends(get_db)):
    ip = client_ip(request)
    if limiter.is_limited(f"reg:{ip}", REGISTER_LIMIT, REGISTER_WINDOW):
        return _oauth_json({"error": "temporarily_unavailable", "error_description": "Muitos registros"}, 429)
    limiter.hit(f"reg:{ip}", REGISTER_WINDOW)

    try:
        payload = await request.json()
        if not isinstance(payload, dict):
            raise ValueError
    except ValueError:
        return _oauth_json({"error": "invalid_client_metadata", "error_description": "Corpo JSON inválido"}, 400)

    try:
        return _oauth_json(svc.register_client(db, payload), 201)
    except svc.OAuthError as exc:
        return _error_json(exc)


# --- Tela de login / autorização -----------------------------------------------------

_STYLE = """
:root{color-scheme:light dark;--bg:#f6f6f4;--card:#fff;--fg:#1a1a1a;--muted:#6b6b6b;--line:#e2e2de;--brand:#c8421f;--brand-fg:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#161616;--card:#1f1f1f;--fg:#f2f2f2;--muted:#9a9a9a;--line:#333}}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--fg);
font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:16px}
.card{width:100%;max-width:420px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:28px}
h1{font-size:19px;margin:0 0 6px}p{margin:0 0 14px;color:var(--muted)}.who{color:var(--fg);font-weight:600}
.dest{font-size:13px;background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:8px 10px;margin-bottom:16px;word-break:break-all}
label.f{display:block;font-size:13px;color:var(--muted);margin:12px 0 4px}
input[type=email],input[type=password]{width:100%;padding:10px 12px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--fg);font:inherit}
.scopes{margin:16px 0;padding:0;list-style:none}.scopes li{display:flex;gap:8px;align-items:flex-start;padding:4px 0}
.err{background:#fde8e4;color:#8a2410;border-radius:8px;padding:9px 12px;margin-bottom:12px;font-size:14px}
.row{display:flex;gap:10px;margin-top:20px}button{flex:1;padding:11px;border-radius:8px;border:1px solid var(--line);font:inherit;font-weight:600;cursor:pointer;background:transparent;color:var(--fg)}
button.go{background:var(--brand);border-color:var(--brand);color:var(--brand-fg)}
"""


def _origin(uri: str) -> str:
    parts = urlparse(uri)
    return f"{parts.scheme}://{parts.netloc}"


def _html(body: str, *, status_code: int = 200, form_action_origin: str | None = None, csrf: str | None = None) -> HTMLResponse:
    form_action = "'self'" + (f" {form_action_origin}" if form_action_origin else "")
    page = (
        '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">'
        f"<title>Simbora CRM — autorizar acesso</title><style>{_STYLE}</style></head><body>"
        f'<main class="card">{body}</main></body></html>'
    )
    response = HTMLResponse(page, status_code=status_code)
    response.headers.update(NO_STORE)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Content-Security-Policy"] = (
        f"default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data: https:; "
        f"form-action {form_action}; frame-ancestors 'none'; base-uri 'none'"
    )
    if csrf:
        response.set_cookie(
            CSRF_COOKIE, csrf, max_age=REQUEST_MINUTES * 60, httponly=True,
            secure=settings.PUBLIC_API_URL.startswith("https://"), samesite="lax", path="/oauth",
        )
    return response


def _error_page(message: str, status_code: int = 400) -> HTMLResponse:
    return _html(f"<h1>Não foi possível continuar</h1><p>{escape(message)}</p>", status_code=status_code)


def _login_form(
    *, client_name: str, redirect_uri: str, signed_request: str, scopes: list[str], csrf: str,
    email: str = "", error: str | None = None, status_code: int = 200,
) -> HTMLResponse:
    host = urlparse(redirect_uri).netloc
    items = "".join(
        f'<li><input type="checkbox" name="scope" value="{escape(key)}" id="s-{escape(key)}" checked'
        f'{" disabled" if key == "crm.read" else ""}>'
        f'<label for="s-{escape(key)}">{escape(svc.SCOPES[key])}</label></li>'
        for key in scopes
    )
    error_html = f'<div class="err" role="alert">{escape(error)}</div>' if error else ""
    body = f"""
<h1>Autorizar acesso ao CRM Simbora</h1>
<p><span class="who">{escape(client_name)}</span> quer acessar o CRM em seu nome, com as suas permissões.</p>
<div class="dest">Depois de autorizar, você volta para: <strong>{escape(host)}</strong></div>
{error_html}
<form method="post" action="/oauth/authorize" autocomplete="on">
<input type="hidden" name="request" value="{escape(signed_request)}">
<input type="hidden" name="csrf" value="{escape(csrf)}">
<label class="f" for="email">Email</label>
<input type="email" id="email" name="email" value="{escape(email)}" required autofocus autocomplete="username">
<label class="f" for="password">Senha</label>
<input type="password" id="password" name="password" required autocomplete="current-password">
<ul class="scopes">{items}</ul>
<div class="row"><button type="submit" name="action" value="deny" formnovalidate>Cancelar</button>
<button type="submit" name="action" value="allow" class="go">Entrar e autorizar</button></div>
</form>"""
    return _html(body, status_code=status_code, form_action_origin=_origin(redirect_uri), csrf=csrf)


def _sign_request(req: svc.AuthorizeRequest) -> str:
    return jwt.encode(
        {
            "purpose": REQUEST_PURPOSE,
            "client_id": req.client.client_id,
            "redirect_uri": req.redirect_uri,
            "code_challenge": req.code_challenge,
            "scopes": req.scopes,
            "resource": req.resource,
            "state": req.state,
            "exp": int(time.time()) + REQUEST_MINUTES * 60,
        },
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )


@router.get("/oauth/authorize")
def authorize_page(request: Request, db: Session = Depends(get_db)):
    try:
        req = svc.validate_authorize_request(db, dict(request.query_params))
    except svc.OAuthError as exc:
        return _error_page(exc.description or exc.error, exc.status_code)
    except svc.AuthorizeError as exc:
        if exc.redirect_uri:
            return _redirect_with(
                exc.redirect_uri, {"error": exc.error, "error_description": exc.description, "state": exc.state}
            )
        return _error_page(exc.description)

    return _login_form(
        client_name=req.client.client_name,
        redirect_uri=req.redirect_uri,
        signed_request=_sign_request(req),
        scopes=req.scopes,
        csrf=secrets.token_urlsafe(32),
    )


@router.post("/oauth/authorize")
async def authorize_submit(request: Request, db: Session = Depends(get_db)):
    form = await request.form()
    csrf_form = str(form.get("csrf") or "")
    csrf_cookie = request.cookies.get(CSRF_COOKIE, "")
    if not csrf_form or not csrf_cookie or not hmac.compare_digest(csrf_form, csrf_cookie):
        return _error_page("Sessão de autorização inválida. Volte ao aplicativo e tente conectar de novo.")

    try:
        data = jwt.decode(str(form.get("request") or ""), settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if data.get("purpose") != REQUEST_PURPOSE:
            raise jwt.InvalidTokenError
    except jwt.PyJWTError:
        return _error_page("O pedido de autorização expirou. Volte ao aplicativo e tente conectar de novo.")

    client = svc.get_client(db, data.get("client_id"))
    redirect_uri = data.get("redirect_uri") or ""
    if client is None or redirect_uri not in (client.redirect_uris or []):
        return _error_page("Aplicativo não encontrado.")
    state = data.get("state")
    allowed_scopes: list[str] = [s for s in data.get("scopes", []) if s in svc.SCOPES]

    if form.get("action") == "deny":
        return _redirect_with(redirect_uri, {"error": "access_denied", "state": state})

    email = str(form.get("email") or "").strip()
    password = str(form.get("password") or "")
    ip_key, email_key = f"login-ip:{client_ip(request)}", f"login-email:{email.lower()}"

    def form_again(message: str, status_code: int) -> HTMLResponse:
        return _login_form(
            client_name=client.client_name, redirect_uri=redirect_uri, signed_request=str(form.get("request")),
            scopes=allowed_scopes, csrf=csrf_form, email=email, error=message, status_code=status_code,
        )

    if limiter.is_limited(ip_key, LOGIN_LIMIT_IP, LOGIN_WINDOW) or limiter.is_limited(
        email_key, LOGIN_LIMIT_EMAIL, LOGIN_WINDOW
    ):
        return form_again("Muitas tentativas. Aguarde alguns minutos e tente de novo.", 429)

    user = svc.authenticate_user(db, email, password) if email and password else None
    if user is None:
        limiter.hit(ip_key, LOGIN_WINDOW)
        limiter.hit(email_key, LOGIN_WINDOW)
        return form_again("Email ou senha inválidos.", 400)

    chosen = set(form.getlist("scope")) & set(allowed_scopes)
    scopes = [s for s in allowed_scopes if s == "crm.read" or s in chosen]

    req = svc.AuthorizeRequest(
        client=client, redirect_uri=redirect_uri, code_challenge=data["code_challenge"], scopes=scopes,
        resource=data["resource"], state=state,
    )
    code = svc.create_authorization_code(db, req, user, scopes)
    return _redirect_with(redirect_uri, {"code": code, "state": state})


# --- Token / revogação / introspecção ------------------------------------------------


def _client_credentials(request: Request, form) -> tuple[str | None, str | None]:
    header = request.headers.get("authorization", "")
    if header.lower().startswith("basic "):
        try:
            decoded = base64.b64decode(header[6:]).decode("utf-8")
            client_id, _, client_secret = decoded.partition(":")
            return client_id, client_secret
        except (binascii.Error, UnicodeDecodeError):
            return None, None
    return form.get("client_id"), form.get("client_secret")


@router.post("/oauth/token")
async def token(request: Request, db: Session = Depends(get_db)):
    form = await request.form()
    try:
        client_id, client_secret = _client_credentials(request, form)
        client = svc.authenticate_client(db, client_id, client_secret)
        grant_type = form.get("grant_type")
        if grant_type == "authorization_code":
            tokens = svc.exchange_code(
                db, client, form.get("code"), form.get("redirect_uri"), form.get("code_verifier"), form.get("resource")
            )
        elif grant_type == "refresh_token":
            tokens = svc.refresh(db, client, form.get("refresh_token"), form.get("scope"))
        else:
            raise svc.OAuthError("unsupported_grant_type", "grant_type não suportado")
    except svc.OAuthError as exc:
        db.rollback()
        return _error_json(exc)
    return _oauth_json(tokens)


@router.post("/oauth/revoke")
async def revoke(request: Request, db: Session = Depends(get_db)):
    form = await request.form()
    try:
        client_id, client_secret = _client_credentials(request, form)
        svc.authenticate_client(db, client_id, client_secret)
    except svc.OAuthError as exc:
        return _error_json(exc)
    value = form.get("token")
    if value:
        svc.revoke_by_token(db, str(value))
    return Response(status_code=200, headers=NO_STORE)


@router.post("/oauth/introspect")
async def introspect(request: Request, db: Session = Depends(get_db)):
    expected = settings.MCP_INTROSPECTION_SECRET
    if not expected:
        return _oauth_json({"error": "server_error", "error_description": "Introspecção não configurada"}, 503)
    header = request.headers.get("authorization", "")
    supplied = header[7:] if header.lower().startswith("bearer ") else ""
    if not hmac.compare_digest(supplied.encode(), expected.encode()):
        return _oauth_json({"error": "invalid_client"}, 401)

    form = await request.form()
    try:
        return _oauth_json(svc.introspect(db, str(form.get("token") or "")))
    except svc.OAuthError as exc:
        return _error_json(exc)


# --- Conexões de IA (tela do CRM) ----------------------------------------------------


class GrantOut(BaseModel):
    id: int
    user_id: int
    client_name: str
    scopes: list[str]
    created_at: datetime
    last_used_at: datetime | None = None


def _grant_out(grant: OAuthGrant, client_name: str) -> GrantOut:
    return GrantOut(
        id=grant.id, user_id=grant.user_id, client_name=client_name, scopes=grant.scope.split(),
        created_at=grant.created_at, last_used_at=grant.last_used_at,
    )


@api_router.get("/oauth/grants", response_model=list[GrantOut])
def list_grants(
    user_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    target = current_user.id
    if user_id is not None and user_id != current_user.id:
        if not current_user.is_admin:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permissão insuficiente")
        target = user_id
    return [_grant_out(g, c.client_name) for g, c in svc.active_grants(db, target)]


@api_router.delete("/oauth/grants/{grant_id}", status_code=204)
def revoke_grant(
    grant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    grant = db.get(OAuthGrant, grant_id)
    if grant is None or grant.revoked_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conexão não encontrada")
    if grant.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conexão não encontrada")
    svc.revoke_grant(db, grant)
