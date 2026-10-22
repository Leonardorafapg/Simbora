# backend/app/routers/uploads.py
import asyncio
import ipaddress
import logging
import socket
from urllib.parse import urljoin, urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, status

from app.core import r2_client
from app.core.config import settings
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.upload import PresignOut, PresignRequest, UploadFromUrl, UploadOut

logger = logging.getLogger("uploads")

router = APIRouter()

_MAX_REDIRECTS = 3
_FETCH_TIMEOUT = httpx.Timeout(20.0, connect=5.0)


def _require_configured() -> None:
    if not r2_client.is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Armazenamento de imagens não configurado (credenciais do R2 ausentes)",
        )


def _normalize_content_type(value: str) -> str:
    return (value or "").split(";")[0].strip().lower()


def _check_image_type(content_type: str) -> None:
    if content_type not in r2_client.IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato não suportado. Envie uma imagem JPG, PNG, WebP, GIF ou AVIF.",
        )


def _check_size(size: int) -> None:
    if size > settings.UPLOAD_MAX_BYTES:
        limit_mb = settings.UPLOAD_MAX_BYTES // (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Imagem acima do limite de {limit_mb} MB",
        )


@router.post("/uploads/presign", response_model=PresignOut)
async def presign_upload(
    payload: PresignRequest,
    _: User = Depends(get_current_user),
):
    """
    Devolve uma URL pré-assinada de PUT no R2. O browser envia o arquivo direto
    pro bucket (sem passar por Next/FastAPI) e depois grava `url` no registro.
    """
    _require_configured()

    content_type = _normalize_content_type(payload.content_type)
    if content_type in r2_client.VIDEO_EXTENSIONS:
        # Vídeo só existe pro Instagram (Reels/Stories) — limite próprio, maior.
        if payload.size > settings.UPLOAD_VIDEO_MAX_BYTES:
            limit_mb = settings.UPLOAD_VIDEO_MAX_BYTES // (1024 * 1024)
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Vídeo acima do limite de {limit_mb} MB",
            )
    else:
        _check_image_type(content_type)
        _check_size(payload.size)

    key = r2_client.new_object_key(content_type)
    try:
        upload_url = r2_client.presign_put(key, content_type, payload.size)
    except Exception as exc:
        logger.exception("Falha ao assinar URL de upload do R2: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Falha ao preparar o envio da imagem",
        )

    return PresignOut(
        upload_url=upload_url,
        headers={"Content-Type": content_type},
        url=r2_client.public_url(key),
    )


@router.post("/uploads/presign-document", response_model=PresignOut)
async def presign_document_upload(
    payload: PresignRequest,
    _: User = Depends(get_current_user),
):
    """Mesma mecânica de `presign_upload`, mas para documentos (hoje só o PDF
    do calendário no fluxo de aprovação) — mantido à parte pra não afrouxar a
    validação de tipo/tamanho do upload de imagens."""
    _require_configured()

    content_type = _normalize_content_type(payload.content_type)
    if content_type not in r2_client.DOCUMENT_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato não suportado. Envie um PDF.",
        )
    _check_size(payload.size)

    key = r2_client.new_object_key(content_type, subdir="calendar-approvals")
    try:
        upload_url = r2_client.presign_put(key, content_type, payload.size)
    except Exception as exc:
        logger.exception("Falha ao assinar URL de upload de documento do R2: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Falha ao preparar o envio do documento",
        )

    return PresignOut(
        upload_url=upload_url,
        headers={"Content-Type": content_type},
        url=r2_client.public_url(key),
    )


@router.post("/uploads/presign-artwork", response_model=PresignOut)
async def presign_artwork_upload(
    payload: PresignRequest,
    _: User = Depends(get_current_user),
):
    """Arte finalizada do post: aceita imagem (como /uploads/presign) ou
    documento (PDF, Word, Excel, PowerPoint, ZIP)."""
    _require_configured()

    content_type = _normalize_content_type(payload.content_type)
    if content_type not in r2_client.IMAGE_EXTENSIONS and content_type not in r2_client.ARTWORK_DOCUMENT_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato não suportado. Envie uma imagem ou um documento (PDF, Word, Excel, PowerPoint ou ZIP).",
        )
    _check_size(payload.size)

    key = r2_client.new_object_key(content_type)
    try:
        upload_url = r2_client.presign_put(key, content_type, payload.size)
    except Exception as exc:
        logger.exception("Falha ao assinar URL de upload da arte final do R2: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Falha ao preparar o envio do arquivo",
        )

    return PresignOut(
        upload_url=upload_url,
        headers={"Content-Type": content_type},
        url=r2_client.public_url(key),
    )


async def _assert_public_host(url: str) -> None:
    """Recusa hosts que resolvem pra rede interna (anti-SSRF)."""
    host = urlparse(url).hostname
    if not host:
        raise ValueError("URL inválida")

    loop = asyncio.get_running_loop()
    infos = await loop.run_in_executor(None, lambda: socket.getaddrinfo(host, None, type=socket.SOCK_STREAM))
    for info in infos:
        if not ipaddress.ip_address(info[4][0]).is_global:
            raise ValueError("URL aponta para um endereço não público")


async def _download_image(url: str) -> tuple[bytes, str]:
    async with httpx.AsyncClient(timeout=_FETCH_TIMEOUT, follow_redirects=False) as client:
        current = url
        for _ in range(_MAX_REDIRECTS + 1):
            await _assert_public_host(current)

            async with client.stream("GET", current) as response:
                if response.is_redirect:
                    location = response.headers.get("location")
                    if not location:
                        raise ValueError("Redirecionamento inválido")
                    current = urljoin(current, location)
                    if not current.lower().startswith(("https://", "http://")):
                        raise ValueError("Redirecionamento inválido")
                    continue

                response.raise_for_status()

                content_type = _normalize_content_type(response.headers.get("content-type", ""))
                _check_image_type(content_type)

                declared = int(response.headers.get("content-length") or 0)
                _check_size(declared)

                body = bytearray()
                async for chunk in response.aiter_bytes():
                    body.extend(chunk)
                    _check_size(len(body))
                return bytes(body), content_type

        raise ValueError("Redirecionamentos demais")


@router.post("/uploads/from-url", response_model=UploadOut)
async def upload_image_from_url(
    payload: UploadFromUrl,
    _: User = Depends(get_current_user),
):
    """
    Baixa uma imagem de uma URL pública e a grava no R2. Serve a automações
    (MCP) que não têm o arquivo em mãos. Como quem busca é este servidor,
    hosts que resolvem pra IP não público são recusados.
    """
    _require_configured()

    try:
        body, content_type = await _download_image(payload.url)
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("Falha ao baixar imagem por URL (%s): %s", payload.url, exc)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Não foi possível buscar a imagem. Confira se a URL é pública e aponta para uma imagem.",
        )

    key = r2_client.new_object_key(content_type)
    try:
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, lambda: r2_client.put_object(key, content_type, body))
    except Exception as exc:
        logger.exception("Falha ao gravar imagem (por URL) no R2: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Falha ao enviar a imagem para o armazenamento externo",
        )

    return UploadOut(url=r2_client.public_url(key))
