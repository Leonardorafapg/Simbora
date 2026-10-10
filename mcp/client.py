"""Cliente HTTP do backend Simbora: login da conta de serviço, cache de token e erros legíveis."""
import asyncio
import os
import time
from typing import Any

import httpx
from mcp.server.fastmcp.exceptions import ToolError


class BackendClient:
    def __init__(self) -> None:
        self.base_url = os.environ.get("BACKEND_URL", "").rstrip("/")
        self.email = os.environ.get("MCP_SERVICE_EMAIL", "")
        self.password = os.environ.get("MCP_SERVICE_PASSWORD", "")
        self._token: str | None = None
        self._token_exp: float = 0.0
        self._lock = asyncio.Lock()
        self._http = httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=10.0))

    # --- auth -----------------------------------------------------------------
    def _check_config(self) -> None:
        missing = [
            name
            for name, value in (
                ("BACKEND_URL", self.base_url),
                ("MCP_SERVICE_EMAIL", self.email),
                ("MCP_SERVICE_PASSWORD", self.password),
            )
            if not value
        ]
        if missing:
            raise ToolError(
                "Servidor MCP sem configuração: faltam as variáveis " + ", ".join(missing) + " no serviço mcp."
            )

    async def _login(self) -> str:
        self._check_config()
        try:
            resp = await self._http.post(
                f"{self.base_url}/api/v1/auth/login",
                json={"email": self.email, "password": self.password},
            )
        except httpx.HTTPError as exc:
            raise ToolError(f"Não consegui falar com o backend: {exc.__class__.__name__}") from exc

        if resp.status_code == 401:
            raise ToolError("A conta de serviço do MCP não conseguiu entrar (email/senha inválidos ou usuário inativo).")
        if resp.status_code >= 400:
            raise ToolError(f"Falha no login da conta de serviço (HTTP {resp.status_code}).")

        data = resp.json()
        self._token = data["access_token"]
        # Renova um pouco antes de expirar de verdade.
        self._token_exp = time.time() + max(60, int(data.get("expires_in", 3600)) - 120)
        return self._token

    async def _get_token(self) -> str:
        async with self._lock:
            if self._token is None or time.time() >= self._token_exp:
                await self._login()
            assert self._token is not None
            return self._token

    # --- requests -------------------------------------------------------------
    async def request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        json: Any = None,
    ) -> Any:
        url = f"{self.base_url}/api/v1{path}"
        clean_params = {k: v for k, v in (params or {}).items() if v is not None}

        for attempt in (1, 2):
            token = await self._get_token()
            try:
                resp = await self._http.request(
                    method,
                    url,
                    params=clean_params,
                    json=json,
                    headers={"Authorization": f"Bearer {token}"},
                )
            except httpx.HTTPError as exc:
                raise ToolError(f"Não consegui falar com o backend: {exc.__class__.__name__}") from exc

            if resp.status_code == 401 and attempt == 1:
                self._token = None  # token expirou/foi invalidado: reloga e tenta uma vez
                continue
            break

        if resp.status_code == 204:
            return None
        if resp.status_code >= 400:
            raise ToolError(self._format_error(resp))
        return resp.json()

    @staticmethod
    def _format_error(resp: httpx.Response) -> str:
        try:
            detail = resp.json().get("detail")
        except Exception:
            detail = None

        if isinstance(detail, list):
            # 422 do FastAPI (lista de erros) ou erros do bulk (lista de strings)
            parts = []
            for item in detail:
                if isinstance(item, dict):
                    loc = ".".join(str(x) for x in item.get("loc", []) if x != "body")
                    parts.append(f"{loc}: {item.get('msg')}" if loc else str(item.get("msg")))
                else:
                    parts.append(str(item))
            detail = "; ".join(parts)

        if resp.status_code == 403:
            if detail and detail != "Permissão insuficiente":
                return f"Não permitido: {detail}"  # regra de negócio do backend, mensagem já é clara
            return "Sem permissão para essa ação: a conta de serviço do MCP não tem a permissão necessária."
        if resp.status_code == 404:
            return f"Não encontrado: {detail or 'recurso inexistente'}"
        return f"O backend recusou (HTTP {resp.status_code}): {detail or 'erro sem detalhe'}"

    async def get(self, path: str, **params: Any) -> Any:
        return await self.request("GET", path, params=params)

    async def post(self, path: str, body: Any) -> Any:
        return await self.request("POST", path, json=body)

    async def patch(self, path: str, body: Any) -> Any:
        return await self.request("PATCH", path, json=body)

    async def put(self, path: str, body: Any) -> Any:
        return await self.request("PUT", path, json=body)

    async def delete(self, path: str) -> Any:
        return await self.request("DELETE", path)
