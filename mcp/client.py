"""Cliente HTTP do backend Simbora: repassa o token do usuário logado no MCP e traduz erros em mensagens legíveis."""
import os
from typing import Any

import httpx
from mcp.server.auth.middleware.auth_context import get_access_token
from mcp.server.fastmcp.exceptions import ToolError


class BackendClient:
    def __init__(self) -> None:
        self.base_url = os.environ.get("BACKEND_URL", "").rstrip("/")
        self._http = httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=10.0))

    @staticmethod
    def _user_token() -> str:
        access = get_access_token()
        if access is None:
            raise ToolError("Sem usuário autenticado. Reconecte o MCP e faça login no Simbora.")
        return access.token

    async def request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        json: Any = None,
    ) -> Any:
        if not self.base_url:
            raise ToolError("Servidor MCP sem configuração: falta a variável BACKEND_URL no serviço mcp.")
        url = f"{self.base_url}/api/v1{path}"
        clean_params = {k: v for k, v in (params or {}).items() if v is not None}

        try:
            resp = await self._http.request(
                method,
                url,
                params=clean_params,
                json=json,
                headers={"Authorization": f"Bearer {self._user_token()}"},
            )
        except httpx.HTTPError as exc:
            raise ToolError(f"Não consegui falar com o backend: {exc.__class__.__name__}") from exc

        if resp.status_code == 401:
            raise ToolError("Sua sessão no Simbora expirou ou foi revogada. Reconecte o MCP e faça login de novo.")
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
            return "Você não tem permissão para essa ação no CRM. Peça a um administrador para liberar."
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
