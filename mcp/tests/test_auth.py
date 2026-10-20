"""Verificador de tokens do MCP. Rodar com: cd mcp && python -m pytest tests"""
import asyncio
import os
import sys
import time

os.environ["BACKEND_URL"] = "https://api.test"
os.environ["MCP_RESOURCE_URL"] = "https://mcp.test/mcp"
os.environ["MCP_INTROSPECTION_SECRET"] = "segredo"
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import httpx  # noqa: E402

from auth import IntrospectionVerifier  # noqa: E402


def active_body(**over):
    body = {
        "active": True, "sub": "7", "username": "a@a.com", "client_id": "app", "scope": "crm.read crm.write",
        "exp": int(time.time()) + 600, "aud": "https://mcp.test/mcp",
    }
    body.update(over)
    return body


def make(handler):
    calls = []

    def wrapped(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return handler(request)

    http = httpx.AsyncClient(transport=httpx.MockTransport(wrapped))
    return IntrospectionVerifier(http), calls


def verify(verifier, token="tok"):
    return asyncio.run(verifier.verify_token(token))


def test_active_token_maps_user_and_scopes():
    verifier, calls = make(lambda r: httpx.Response(200, json=active_body()))
    access = verify(verifier)
    assert access.subject == "7" and access.claims == {"email": "a@a.com"}
    assert access.scopes == ["crm.read", "crm.write"]
    assert calls[0].headers["authorization"] == "Bearer segredo"
    assert calls[0].url == "https://api.test/oauth/introspect"


def test_inactive_wrong_audience_and_errors_are_rejected():
    assert verify(make(lambda r: httpx.Response(200, json={"active": False}))[0]) is None
    assert verify(make(lambda r: httpx.Response(200, json=active_body(aud="https://outro/mcp")))[0]) is None
    assert verify(make(lambda r: httpx.Response(401, json={}))[0]) is None
    assert verify(make(lambda r: httpx.Response(200, text="não é json"))[0]) is None

    def boom(request):
        raise httpx.ConnectTimeout("timeout")

    assert verify(make(boom)[0]) is None


def test_cache_avoids_second_call_but_not_for_rejections():
    verifier, calls = make(lambda r: httpx.Response(200, json=active_body()))
    verify(verifier)
    verify(verifier)
    assert len(calls) == 1

    rejecting, rejected_calls = make(lambda r: httpx.Response(200, json={"active": False}))
    verify(rejecting)
    verify(rejecting)
    assert len(rejected_calls) == 2


def test_cache_respects_token_expiry():
    verifier, calls = make(lambda r: httpx.Response(200, json=active_body(exp=int(time.time()) - 1)))
    verify(verifier)
    verify(verifier)
    assert len(calls) == 2
