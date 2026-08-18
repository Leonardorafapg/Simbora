"""
Cliente HTTP fino para a Evolution API (gateway self-hosted de WhatsApp).

Não há multi-tenant aqui: o sistema usa uma única instância global, cujo
nome vem de `settings.EVOLUTION_INSTANCE_NAME`. Erros de rede/config viram
`HTTPException` claras pro router traduzir em respostas amigáveis pro
frontend, em vez de um 500 cru.
"""
import logging
from typing import Any

import httpx
from fastapi import HTTPException, status

from app.core.config import settings

logger = logging.getLogger("evolution_client")


def _base_url() -> str:
    if not settings.EVOLUTION_API_URL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Evolution API não configurada (defina EVOLUTION_API_URL no .env).",
        )
    return settings.EVOLUTION_API_URL.rstrip("/")


def _headers() -> dict[str, str]:
    return {"apikey": settings.EVOLUTION_API_KEY, "Content-Type": "application/json"}


def _key_fingerprint() -> str:
    """Nunca loga a key inteira — só o suficiente (tamanho + últimos 4
    caracteres) pra comparar com o valor real sem expor o segredo."""
    key = settings.EVOLUTION_API_KEY
    if not key:
        return "(vazia)"
    return f"len={len(key)} termina_em='{key[-4:]}'"


async def _request(method: str, path: str, **kwargs: Any) -> httpx.Response:
    url = f"{_base_url()}{path}"
    # Diagnóstico temporário de um bug de integração em produção — nunca loga
    # a apikey inteira, só instância/URL/status/fingerprint, pra achar a causa
    # real do 502 sem depender do usuário abrir o DevTools.
    logger.warning(
        "Evolution API request: %s %s (instance=%s, apikey=%s)",
        method,
        url,
        settings.EVOLUTION_INSTANCE_NAME,
        _key_fingerprint(),
    )
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.request(method, url, headers=_headers(), **kwargs)
    except httpx.RequestError as exc:
        logger.warning("Evolution API connection failed: %s %s -> %r", method, url, exc)
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
        logger.warning("Evolution API returned error: %s %s -> %s %s", method, url, response.status_code, detail)
        exc = HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Evolution API retornou erro: {detail}",
        )
        # Guarda o status real da Evolution à parte — não dá pra confiar em achar
        # "404"/"409" dentro do texto de `detail`: a Evolution manda o código em
        # `statusCode` e a mensagem como lista de string, sem o número dentro
        # (visto comparando com o slzfood-api, que fala com o mesmo servidor).
        exc.upstream_status = response.status_code  # type: ignore[attr-defined]
        raise exc

    return response


def _instance_name() -> str:
    if not settings.EVOLUTION_INSTANCE_NAME:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Evolution API não configurada (defina EVOLUTION_INSTANCE_NAME no .env).",
        )
    return settings.EVOLUTION_INSTANCE_NAME


async def get_connection_state() -> str:
    """
    Retorna o estado bruto da conexão, ex.: 'open', 'connecting', 'close'.

    Usa `fetchInstances`, não `connectionState/{instance}` — esse último não é
    confiável nessa versão da Evolution (confirmado comparando com o
    slzfood-api, que fala com o mesmo servidor em produção e usa fetchInstances).
    """
    instance = _instance_name()
    try:
        response = await _request("GET", "/instance/fetchInstances", params={"instanceName": instance})
    except HTTPException as exc:
        # Instância nunca foi criada — a Evolution responde 404 pra fetchInstances
        # filtrado por um nome que não existe. Não é erro: é exatamente o estado
        # "ainda não conectado", que deixa o connect_instance() seguir pro create.
        if getattr(exc, "upstream_status", 0) == 404:
            return "close"
        raise

    data = response.json()
    instances = data if isinstance(data, list) else [data]
    found = next((i for i in instances if i.get("name") == instance), None)
    if found is None:
        return "close"
    return found.get("connectionStatus") or found.get("state") or "close"


async def create_instance() -> dict[str, Any]:
    instance = _instance_name()
    response = await _request(
        "POST",
        "/instance/create",
        json={
            "instanceName": instance,
            "qrcode": True,
            "integration": "WHATSAPP-BAILEYS",
        },
    )
    return response.json()


async def connect_instance() -> dict[str, Any]:
    """
    Garante que a instância existe e devolve o payload de QR code da Evolution
    API (formato varia por versão: `base64`, `qrcode.base64` ou `code`).
    """
    instance = _instance_name()

    state = await get_connection_state()
    if state == "open":
        return {"connected": True}

    try:
        data = await create_instance()
    except HTTPException as exc:
        # Instância já existe (a Evolution responde 401/403/409) — só reconecta
        # pra pegar o QR, em vez de confiar em achar "already"/"409" no texto.
        if getattr(exc, "upstream_status", 0) in (401, 403, 409):
            response = await _request("GET", f"/instance/connect/{instance}")
            data = response.json()
        else:
            raise

    qrcode = data.get("qrcode") if isinstance(data.get("qrcode"), dict) else data
    base64_qr = qrcode.get("base64") if isinstance(qrcode, dict) else None
    code = qrcode.get("code") if isinstance(qrcode, dict) else data.get("code")
    pairing_code = data.get("pairingCode") or (qrcode.get("pairingCode") if isinstance(qrcode, dict) else None)

    return {"connected": False, "base64": base64_qr, "code": code, "pairing_code": pairing_code}


async def delete_instance() -> None:
    instance = _instance_name()
    await _request("DELETE", f"/instance/delete/{instance}")


async def set_webhook(webhook_url: str) -> None:
    """
    Registra o webhook na instância — chamado sempre após criar/reconectar
    (nunca só na criação: a Evolution não garante manter a config numa
    instância já existente). Best-effort de propósito (mesmo padrão do
    slzfood-api): falha aqui não pode travar o QR code por causa do webhook.
    """
    instance = _instance_name()
    try:
        await _request(
            "POST",
            f"/webhook/set/{instance}",
            json={
                "webhook": {
                    "enabled": True,
                    "url": webhook_url,
                    "webhookByEvents": True,
                    "events": ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "CONNECTION_UPDATE", "PRESENCE_UPDATE"],
                    "headers": {"x-webhook-secret": settings.EVOLUTION_WEBHOOK_SECRET or ""},
                }
            },
        )
    except HTTPException as exc:
        logger.warning("Falha ao registrar webhook (ignorado): %s", exc.detail)


async def send_presence(remote_jid: str, presence: str, delay_ms: int = 2000) -> None:
    """
    Manda o indicador de "digitando"/"gravando áudio" pro contato ver na tela
    dele. Best-effort: nunca pode travar o envio da mensagem de verdade por
    causa disso. Payload PLANO (number/presence/delay direto na raiz, sem
    aninhar em "options") — é isso que a Evolution realmente espera, apesar da
    documentação mostrar aninhado (ver comentário equivalente no slzfood-api).
    """
    instance = _instance_name()
    try:
        await _request(
            "POST",
            f"/chat/sendPresence/{instance}",
            json={"number": remote_jid, "presence": presence, "delay": delay_ms},
        )
    except HTTPException as exc:
        logger.warning("Falha ao mandar presença '%s' (ignorado): %s", presence, exc.detail)


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
        records = data
    elif isinstance(data, dict) and "messages" in data:
        messages = data["messages"]
        records = messages.get("records", messages) if isinstance(messages, dict) else messages
    else:
        records = data.get("records", []) if isinstance(data, dict) else []

    # A Evolution pagina da mais recente pra mais antiga (page 1 = últimas N) —
    # sem reordenar aqui, o chat renderizava de trás pra frente (mais recente
    # no topo, precisava rolar pra cima pra achar as primeiras da conversa).
    return sorted(records, key=lambda m: m.get("messageTimestamp") or 0)


async def send_text_message(remote_jid: str, text: str) -> dict[str, Any]:
    instance = _instance_name()
    response = await _request(
        "POST",
        f"/message/sendText/{instance}",
        json={"number": remote_jid, "text": text},
    )
    return response.json()
