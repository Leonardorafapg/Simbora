"""Login OAuth do MCP: fluxo completo, segurança do code/refresh, escopos, rotas e revogação."""
import base64
import hashlib
import re
import secrets
from datetime import date
from html import unescape
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi.testclient import TestClient

from app.core.rate_limit import limiter
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.oauth import OAuthAuthorizationCode, OAuthGrant
from app.models.user import User

REDIRECT = "http://localhost:53412/callback"
INTRO = {"Authorization": "Bearer introspection-secret-for-tests-only"}
PASSWORD = "senha-do-membro"


@pytest.fixture(autouse=True)
def _reset_limiter():
    limiter.reset()
    yield
    limiter.reset()


@pytest.fixture()
def member(db):
    user = User(
        full_name="Membro", cpf="11111111111", birth_date=date(1995, 5, 5), email="membro@a.com",
        password_hash=hash_password(PASSWORD), cargo="Social", is_admin=False,
        permissions=["client.view", "calendar.view", "calendar.edit"],
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture()
def anon():
    return TestClient(app, base_url="https://api.test", follow_redirects=False)


def pkce():
    verifier = secrets.token_urlsafe(48)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    return verifier, challenge


def register(anon, redirect=REDIRECT, **extra):
    resp = anon.post("/oauth/register", json={"redirect_uris": [redirect], "client_name": "Claude Code", **extra})
    assert resp.status_code == 201, resp.text
    return resp.json()


def authorize_params(client_id, challenge, **over):
    params = {
        "response_type": "code", "client_id": client_id, "redirect_uri": REDIRECT, "code_challenge": challenge,
        "code_challenge_method": "S256", "state": "xyz", "resource": "https://mcp.test/mcp",
    }
    params.update(over)
    return params


def open_form(anon, params):
    resp = anon.get("/oauth/authorize", params=params)
    assert resp.status_code == 200, resp.text
    html = resp.text
    request_value = unescape(re.search(r'name="request" value="([^"]+)"', html).group(1))
    csrf = unescape(re.search(r'name="csrf" value="([^"]+)"', html).group(1))
    return request_value, csrf


def submit(anon, request_value, csrf, email="membro@a.com", password=PASSWORD, scopes=None, action="allow"):
    # Sem `scopes`, simula o navegador com todos os checkboxes marcados (o padrão da tela).
    data = {
        "request": request_value, "csrf": csrf, "email": email, "password": password, "action": action,
        "scope": ["crm.write", "crm.delete"] if scopes is None else scopes,
    }
    return anon.post("/oauth/authorize", data=data)


def code_from(resp):
    assert resp.status_code == 303, resp.text
    return parse_qs(urlparse(resp.headers["location"]).query)["code"][0]


def token_request(anon, **data):
    return anon.post("/oauth/token", data=data)


def full_flow(anon, scopes=None, email="membro@a.com", password=PASSWORD):
    client = register(anon)
    verifier, challenge = pkce()
    request_value, csrf = open_form(anon, authorize_params(client["client_id"], challenge))
    code = code_from(submit(anon, request_value, csrf, email=email, password=password, scopes=scopes))
    resp = token_request(
        anon, grant_type="authorization_code", client_id=client["client_id"], code=code,
        redirect_uri=REDIRECT, code_verifier=verifier,
    )
    assert resp.status_code == 200, resp.text
    return client, resp.json()


def bearer(tokens):
    return {"Authorization": f"Bearer {tokens['access_token']}"}


# --- Metadata e registro -------------------------------------------------------------


def test_metadata_exposes_issuer_and_pkce(anon):
    meta = anon.get("/.well-known/oauth-authorization-server").json()
    assert meta["issuer"] == "https://api.test/"
    assert meta["code_challenge_methods_supported"] == ["S256"]
    assert meta["registration_endpoint"] == "https://api.test/oauth/register"


@pytest.mark.parametrize(
    "uri,ok",
    [
        ("http://localhost:1234/callback", True),
        ("http://127.0.0.1:8080/cb", True),
        ("https://claude.ai/api/mcp/auth_callback", True),
        ("https://evil.com/cb", False),
        ("http://evil.com/cb", False),
        ("http://claude.ai/cb", False),
        ("myapp://callback", False),
        ("https://claude.ai/cb#frag", False),
    ],
)
def test_dynamic_registration_redirect_allowlist(anon, uri, ok):
    resp = anon.post("/oauth/register", json={"redirect_uris": [uri]})
    assert (resp.status_code == 201) is ok
    if not ok:
        assert resp.json()["error"] == "invalid_redirect_uri"


# --- Tela de autorização -------------------------------------------------------------


def test_authorize_with_unregistered_redirect_shows_error_without_redirect(anon):
    client = register(anon)
    _, challenge = pkce()
    resp = anon.get("/oauth/authorize", params=authorize_params(client["client_id"], challenge, redirect_uri="http://localhost:9/other"))
    assert resp.status_code == 400
    assert "location" not in resp.headers


def test_authorize_unknown_client_shows_error(anon):
    _, challenge = pkce()
    resp = anon.get("/oauth/authorize", params=authorize_params("nope", challenge))
    assert resp.status_code == 400 and "location" not in resp.headers


@pytest.mark.parametrize("over", [{"code_challenge_method": "plain"}, {"code_challenge": ""}])
def test_authorize_requires_pkce_s256(anon, over):
    client = register(anon)
    _, challenge = pkce()
    resp = anon.get("/oauth/authorize", params=authorize_params(client["client_id"], challenge, **over))
    assert resp.status_code == 303
    assert parse_qs(urlparse(resp.headers["location"]).query)["error"] == ["invalid_request"]


def test_authorize_rejects_other_resource(anon):
    client = register(anon)
    _, challenge = pkce()
    resp = anon.get("/oauth/authorize", params=authorize_params(client["client_id"], challenge, resource="https://other.test/mcp"))
    assert parse_qs(urlparse(resp.headers["location"]).query)["error"] == ["invalid_target"]


def test_login_page_escapes_client_name_and_sets_headers(anon):
    client = anon.post("/oauth/register", json={"redirect_uris": [REDIRECT], "client_name": "<script>alert(1)</script>"}).json()
    _, challenge = pkce()
    resp = anon.get("/oauth/authorize", params=authorize_params(client["client_id"], challenge))
    assert "<script>alert(1)</script>" not in resp.text
    assert "&lt;script&gt;" in resp.text
    assert resp.headers["x-frame-options"] == "DENY"
    assert "frame-ancestors 'none'" in resp.headers["content-security-policy"]
    assert "localhost:53412" in resp.text


def test_wrong_password_rerenders_and_rate_limits_by_email(anon, member):
    client = register(anon)
    _, challenge = pkce()
    request_value, csrf = open_form(anon, authorize_params(client["client_id"], challenge))
    for _ in range(5):
        resp = submit(anon, request_value, csrf, password="errada")
        assert resp.status_code == 400 and "inválidos" in resp.text
    resp = submit(anon, request_value, csrf, password=PASSWORD)
    assert resp.status_code == 429


def test_submit_without_matching_csrf_is_rejected(anon, member):
    client = register(anon)
    _, challenge = pkce()
    request_value, _csrf = open_form(anon, authorize_params(client["client_id"], challenge))
    resp = submit(anon, request_value, "outro-valor")
    assert resp.status_code == 400 and "location" not in resp.headers


def test_deny_redirects_with_access_denied(anon, member):
    client = register(anon)
    _, challenge = pkce()
    request_value, csrf = open_form(anon, authorize_params(client["client_id"], challenge))
    resp = submit(anon, request_value, csrf, action="deny")
    query = parse_qs(urlparse(resp.headers["location"]).query)
    assert query["error"] == ["access_denied"] and query["state"] == ["xyz"]


# --- Fluxo completo e tokens ---------------------------------------------------------


def test_full_flow_token_acts_as_the_user(anon, member):
    _, tokens = full_flow(anon)
    me = anon.get("/api/v1/auth/me", headers=bearer(tokens))
    assert me.status_code == 200 and me.json()["email"] == "membro@a.com"


def test_state_is_returned_in_redirect(anon, member):
    client = register(anon)
    _, challenge = pkce()
    request_value, csrf = open_form(anon, authorize_params(client["client_id"], challenge))
    resp = submit(anon, request_value, csrf)
    assert parse_qs(urlparse(resp.headers["location"]).query)["state"] == ["xyz"]


def test_code_cannot_be_reused_and_reuse_revokes_grant(anon, member, db):
    client = register(anon)
    verifier, challenge = pkce()
    request_value, csrf = open_form(anon, authorize_params(client["client_id"], challenge))
    code = code_from(submit(anon, request_value, csrf))
    args = dict(grant_type="authorization_code", client_id=client["client_id"], code=code, redirect_uri=REDIRECT, code_verifier=verifier)

    first = token_request(anon, **args)
    assert first.status_code == 200
    second = token_request(anon, **args)
    assert second.status_code == 400 and second.json()["error"] == "invalid_grant"
    assert anon.get("/api/v1/auth/me", headers=bearer(first.json())).status_code == 401


def test_wrong_code_verifier_is_rejected(anon, member):
    client = register(anon)
    _, challenge = pkce()
    request_value, csrf = open_form(anon, authorize_params(client["client_id"], challenge))
    code = code_from(submit(anon, request_value, csrf))
    resp = token_request(
        anon, grant_type="authorization_code", client_id=client["client_id"], code=code,
        redirect_uri=REDIRECT, code_verifier=secrets.token_urlsafe(48),
    )
    assert resp.status_code == 400 and resp.json()["error"] == "invalid_grant"


def test_expired_code_is_rejected(anon, member, db):
    client = register(anon)
    verifier, challenge = pkce()
    request_value, csrf = open_form(anon, authorize_params(client["client_id"], challenge))
    code = code_from(submit(anon, request_value, csrf))
    from datetime import timedelta
    row = db.query(OAuthAuthorizationCode).one()
    row.expires_at = row.expires_at - timedelta(minutes=10)
    db.commit()
    resp = token_request(
        anon, grant_type="authorization_code", client_id=client["client_id"], code=code,
        redirect_uri=REDIRECT, code_verifier=verifier,
    )
    assert resp.status_code == 400 and resp.json()["error"] == "invalid_grant"


def test_refresh_rotates_and_old_refresh_revokes_everything(anon, member):
    client, tokens = full_flow(anon)
    refreshed = token_request(anon, grant_type="refresh_token", client_id=client["client_id"], refresh_token=tokens["refresh_token"])
    assert refreshed.status_code == 200
    new_tokens = refreshed.json()
    assert anon.get("/api/v1/auth/me", headers=bearer(new_tokens)).status_code == 200

    replay = token_request(anon, grant_type="refresh_token", client_id=client["client_id"], refresh_token=tokens["refresh_token"])
    assert replay.status_code == 400 and replay.json()["error"] == "invalid_grant"
    assert anon.get("/api/v1/auth/me", headers=bearer(new_tokens)).status_code == 401
    again = token_request(anon, grant_type="refresh_token", client_id=client["client_id"], refresh_token=new_tokens["refresh_token"])
    assert again.status_code == 400


def test_refresh_from_another_client_is_rejected(anon, member):
    _, tokens = full_flow(anon)
    other = register(anon)
    resp = token_request(anon, grant_type="refresh_token", client_id=other["client_id"], refresh_token=tokens["refresh_token"])
    assert resp.status_code == 400


def test_confidential_client_needs_secret(anon, member):
    client = register(anon, token_endpoint_auth_method="client_secret_post")
    assert client["client_secret"]
    resp = token_request(anon, grant_type="refresh_token", client_id=client["client_id"], client_secret="errado", refresh_token="x")
    assert resp.status_code == 401 and resp.json()["error"] == "invalid_client"


# --- Escopos, rotas e permissões -----------------------------------------------------


def test_read_only_scope_blocks_writes(anon, member):
    _, tokens = full_flow(anon, scopes=[])  # só crm.read
    assert "crm.write" not in tokens["scope"].split()
    assert anon.get("/api/v1/clients", headers=bearer(tokens)).status_code == 200
    resp = anon.post("/api/v1/clients", headers=bearer(tokens), json={"name": "X"})
    assert resp.status_code == 403 and "crm.write" in resp.json()["detail"]


def test_route_outside_allowlist_is_blocked_even_for_admin(anon, admin):
    admin_email = admin.email
    # senha do fixture admin é "x" (curta demais pra o form, mas o hash vale pro authenticate_user)
    _, tokens = full_flow(anon, email=admin_email, password="x")
    assert anon.get("/api/v1/whatsapp/status", headers=bearer(tokens)).status_code == 403


def test_admin_only_routes_are_blocked_for_mcp_tokens(anon, admin):
    _, tokens = full_flow(anon, email=admin.email, password="x")
    assert anon.get("/api/v1/users", headers=bearer(tokens)).status_code == 403
    assert anon.get("/api/v1/team/members", headers=bearer(tokens)).status_code == 200


def test_user_permissions_still_decide(anon, member):
    _, tokens = full_flow(anon)
    assert anon.get("/api/v1/clients", headers=bearer(tokens)).status_code == 200
    resp = anon.post("/api/v1/clients", headers=bearer(tokens), json={"name": "Sem permissão"})
    assert resp.status_code == 403 and resp.json()["detail"] == "Permissão insuficiente"
    assert anon.get("/api/v1/team/members", headers=bearer(tokens)).status_code == 403


def test_permission_changes_apply_immediately(anon, member, db):
    _, tokens = full_flow(anon)
    assert anon.post("/api/v1/clients", headers=bearer(tokens), json={"name": "A"}).status_code == 403
    member.permissions = ["client.view", "client.create"]
    db.commit()
    assert anon.post("/api/v1/clients", headers=bearer(tokens), json={"name": "A"}).status_code == 201


def test_crm_session_token_still_works(api, admin):
    assert api.get("/api/v1/auth/me").status_code == 200
    assert api.get("/api/v1/users").status_code == 200
    assert api.get("/api/v1/whatsapp/status").status_code != 403


def test_mcp_token_is_not_a_crm_session_for_other_audiences(anon, member):
    _, tokens = full_flow(anon)
    # o token MCP não deve passar no decode de sessão (tem aud) — ex.: WebSocket do WhatsApp
    from app.core.security import decode_access_token
    import jwt
    with pytest.raises(jwt.PyJWTError):
        decode_access_token(tokens["access_token"])


# --- Revogação -----------------------------------------------------------------------


def test_admin_password_change_revokes_connections(anon, api, member):
    client, tokens = full_flow(anon)
    assert anon.get("/api/v1/auth/me", headers=bearer(tokens)).status_code == 200
    assert api.put(f"/api/v1/users/{member.id}/password", json={"password": "nova-senha"}).status_code == 204
    assert anon.get("/api/v1/auth/me", headers=bearer(tokens)).status_code == 401
    resp = token_request(anon, grant_type="refresh_token", client_id=client["client_id"], refresh_token=tokens["refresh_token"])
    assert resp.status_code == 400


def test_deactivated_user_loses_access(anon, api, member):
    _, tokens = full_flow(anon)
    assert api.patch(f"/api/v1/users/{member.id}", json={"is_active": False}).status_code == 200
    assert anon.get("/api/v1/auth/me", headers=bearer(tokens)).status_code == 401
    assert anon.post("/oauth/introspect", headers=INTRO, data={"token": tokens["access_token"]}).json() == {"active": False}


def test_deleting_user_removes_oauth_rows(anon, api, member, db):
    full_flow(anon)
    assert api.delete(f"/api/v1/users/{member.id}").status_code == 204
    assert db.query(OAuthGrant).count() == 0


def test_revoke_endpoint_with_refresh_token(anon, member):
    client, tokens = full_flow(anon)
    resp = anon.post("/oauth/revoke", data={"client_id": client["client_id"], "token": tokens["refresh_token"]})
    assert resp.status_code == 200
    assert anon.get("/api/v1/auth/me", headers=bearer(tokens)).status_code == 401


# --- Introspecção --------------------------------------------------------------------


def test_introspect_requires_secret(anon, member):
    _, tokens = full_flow(anon)
    assert anon.post("/oauth/introspect", data={"token": tokens["access_token"]}).status_code == 401
    assert anon.post("/oauth/introspect", headers={"Authorization": "Bearer errado"}, data={"token": "x"}).status_code == 401


def test_introspect_active_token(anon, member):
    _, tokens = full_flow(anon)
    body = anon.post("/oauth/introspect", headers=INTRO, data={"token": tokens["access_token"]}).json()
    assert body["active"] is True
    assert body["sub"] == str(member.id) and body["username"] == "membro@a.com"
    assert body["aud"] == "https://mcp.test/mcp"
    assert set(body["scope"].split()) == {"crm.read", "crm.write", "crm.delete"}


def test_introspect_rejects_crm_session_token(anon, admin):
    session_token = create_access_token(admin)
    assert anon.post("/oauth/introspect", headers=INTRO, data={"token": session_token}).json() == {"active": False}


# --- Conexões (tela do CRM) ----------------------------------------------------------


def test_grants_list_and_revoke_by_owner(anon, member, db):
    _, tokens = full_flow(anon)
    session = TestClient(app, base_url="https://api.test")
    session.headers["Authorization"] = f"Bearer {create_access_token(member)}"

    grants = session.get("/api/v1/oauth/grants").json()
    assert len(grants) == 1 and grants[0]["client_name"] == "Claude Code"
    assert set(grants[0]["scopes"]) == {"crm.read", "crm.write", "crm.delete"}

    assert session.delete(f"/api/v1/oauth/grants/{grants[0]['id']}").status_code == 204
    assert session.get("/api/v1/oauth/grants").json() == []
    assert anon.get("/api/v1/auth/me", headers=bearer(tokens)).status_code == 401


def test_grants_isolated_between_users_and_admin_can_manage(anon, api, member):
    _, tokens = full_flow(anon)
    member_session = TestClient(app, base_url="https://api.test")
    member_session.headers["Authorization"] = f"Bearer {create_access_token(member)}"
    grant_id = member_session.get("/api/v1/oauth/grants").json()[0]["id"]

    assert len(api.get(f"/api/v1/oauth/grants?user_id={member.id}").json()) == 1
    assert member_session.get("/api/v1/oauth/grants?user_id=1").status_code in (200, 403)
    assert api.delete(f"/api/v1/oauth/grants/{grant_id}").status_code == 204
    assert anon.get("/api/v1/auth/me", headers=bearer(tokens)).status_code == 401


def test_mcp_token_cannot_manage_connections(anon, member):
    _, tokens = full_flow(anon)
    assert anon.get("/api/v1/oauth/grants", headers=bearer(tokens)).status_code == 403
