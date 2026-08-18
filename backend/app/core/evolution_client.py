"""
Cliente HTTP fino para a Evolution API (gateway self-hosted de WhatsApp).

Não há multi-tenant aqui: o sistema usa uma única instância global, cujo
nome vem de `settings.EVOLUTION_INSTANCE_NAME`. Erros de rede/config viram
`HTTPException` claras pro router traduzir em respostas amigáveis pro
frontend, em vez de um 500 cru.
"""
from typing import Any

import httpx
from fastapi import HTTPException, status

from app.core.config import settings


def _base_url() -> str:
    if not settings.EVOLUTION_API_URL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Evolution API não configurada (defina EVOLUTION_API_URL no .env).",
        )
    return settings.EVOLUTION_API_URL.rstrip("/")


def _headers() -> dict[str, str]:
    return {"apikey": settings.EVOLUTION_API_KEY, "Content-Type": "application/json"}


async def _request(method: str, path: str, **kwargs: Any) -> httpx.Response:
    url = f"{_base_url()}{path}"
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.request(method, url, headers=_headers(), **kwargs)
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Não foi possível conectar ao servidor Evolution API: {exc}",
        ) from exc

    if response.status_code >= 400:
        detail = response.text
        try:
            data = response.json()
            detail = data.get("message") or data.get("error") or detail
        except ValueError:
            pass
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Evolution API retornou erro: {detail}",
        )

    return response


def _instance_name() -> str:
    if not settings.EVOLUTION_INSTANCE_NAME:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Evolution API não configurada (defina EVOLUTION_INSTANCE_NAME no .env).",
        )
    return settings.EVOLUTION_INSTANCE_NAME


async def get_connection_state() -> str:
    """Retorna o estado bruto da conexão, ex.: 'open', 'connecting', 'close'."""
    instance = _instance_name()
    try:
        response = await _request("GET", f"/instance/connectionState/{instance}")
    except HTTPException as exc:
        # Instância ainda não existe no servidor Evolution — trata como desconectada.
        if exc.status_code == status.HTTP_502_BAD_GATEWAY and "404" in str(exc.detail):
            return "close"
        raise

    data = response.json()
    instance_data = data.get("instance", data)
    return instance_data.get("state", "close")


async def create_instance() -> None:
    instance = _instance_name()
    await _request(
        "POST",
        "/instance/create",
        json={
            "instanceName": instance,
            "qrcode": True,
            "integration": "WHATSAPP-BAILEYS",
        },
    )


async def connect_instance() -> dict[str, Any]:
    """
    Garante que a instância existe e devolve o payload de QR code da Evolution
    API (formato varia por versão: `base64`, `qrcode.base64` ou `code`).
    """
    instance = _instance_name()

    state = await get_connection_state()
    if state == "open":
        return {"connected": True}

    if state == "close":
        try:
            await create_instance()
        except HTTPException as exc:
            # Instância já existe — segue pro connect normalmente.
            if "already" not in str(exc.detail).lower() and "409" not in str(exc.detail):
                raise

    response = await _request("GET", f"/instance/connect/{instance}")
    data = response.json()

    qrcode = data.get("qrcode") if isinstance(data.get("qrcode"), dict) else data
    base64_qr = qrcode.get("base64") if isinstance(qrcode, dict) else None
    code = qrcode.get("code") if isinstance(qrcode, dict) else data.get("code")

    return {"connected": False, "base64": base64_qr, "code": code, "pairing_code": data.get("pairingCode")}


async def logout_instance() -> None:
    instance = _instance_name()
    await _request("DELETE", f"/instance/logout/{instance}")


async def delete_instance() -> None:
    instance = _instance_name()
    await _request("DELETE", f"/instance/delete/{instance}")


async def find_chats() -> list[dict[str, Any]]:
    instance = _instance_name()
    response = await _request("POST", f"/chat/findChats/{instance}", json={})
    data = response.json()
    return data if isinstance(data, list) else data.get("chats", [])


async def find_messages(remote_jid: str, limit: int = 50, page: int = 1) -> list[dict[str, Any]]:
    instance = _instance_name()
    response = await _request(
        "POST",
        f"/chat/findMessages/{instance}",
        json={"where": {"key": {"remoteJid": remote_jid}}, "limit": limit, "page": page},
    )
    data = response.json()
    if isinstance(data, list):
        return data
    if isinstance(data, dict) and "messages" in data:
        messages = data["messages"]
        return messages.get("records", messages) if isinstance(messages, dict) else messages
    return data.get("records", []) if isinstance(data, dict) else []


async def send_text_message(remote_jid: str, text: str) -> dict[str, Any]:
    instance = _instance_name()
    response = await _request(
        "POST",
        f"/message/sendText/{instance}",
        json={"number": remote_jid, "text": text},
    )
    return response.json()
