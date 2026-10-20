"""
Validação dos tokens de acesso do MCP.

O MCP é só "resource server": quem emite e valida os tokens é o backend (OAuth). Aqui cada token é
conferido em POST {BACKEND_URL}/oauth/introspect, com cache curto — o MCP nunca conhece a SECRET_KEY.
Revogar uma conexão vale em até CACHE_TTL segundos.
"""
import hashlib
import os
import time

import httpx
from mcp.server.auth.provider import AccessToken

CACHE_TTL = 60.0
CACHE_MAX = 1000


class IntrospectionVerifier:
    def __init__(self, http: httpx.AsyncClient | None = None) -> None:
        self.backend_url = os.environ.get("BACKEND_URL", "").rstrip("/")
        self.secret = os.environ.get("MCP_INTROSPECTION_SECRET", "")
        self.resource = os.environ.get("MCP_RESOURCE_URL", "").rstrip("/")
        self._http = http or httpx.AsyncClient(timeout=httpx.Timeout(5.0, connect=3.0))
        self._cache: dict[str, tuple[AccessToken, float]] = {}

    def _cache_get(self, key: str) -> AccessToken | None:
        hit = self._cache.get(key)
        if hit is None:
            return None
        token, until = hit
        if time.monotonic() >= until or (token.expires_at is not None and token.expires_at <= time.time()):
            self._cache.pop(key, None)
            return None
        return token

    def _cache_put(self, key: str, token: AccessToken) -> None:
        if len(self._cache) >= CACHE_MAX:
            now = time.monotonic()
            for stale in [k for k, (_, until) in self._cache.items() if until <= now]:
                del self._cache[stale]
            if len(self._cache) >= CACHE_MAX:
                self._cache.clear()
        self._cache[key] = (token, time.monotonic() + CACHE_TTL)

    async def verify_token(self, token: str) -> AccessToken | None:
        key = hashlib.sha256(token.encode()).hexdigest()
        cached = self._cache_get(key)
        if cached is not None:
            return cached

        try:
            resp = await self._http.post(
                f"{self.backend_url}/oauth/introspect",
                headers={"Authorization": f"Bearer {self.secret}"},
                data={"token": token},
            )
        except httpx.HTTPError:
            return None
        if resp.status_code != 200:
            return None
        try:
            body = resp.json()
        except ValueError:
            return None

        if not body.get("active") or str(body.get("aud", "")).rstrip("/") != self.resource:
            return None

        access = AccessToken(
            token=token,
            client_id=str(body.get("client_id") or ""),
            scopes=str(body.get("scope") or "").split(),
            expires_at=int(body["exp"]) if body.get("exp") else None,
            resource=str(body.get("aud")),
            subject=str(body.get("sub") or ""),
            claims={"email": body.get("username")},
        )
        self._cache_put(key, access)
        return access
