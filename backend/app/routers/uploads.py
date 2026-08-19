# backend/app/routers/uploads.py
import asyncio
import logging

import cloudinary.uploader
from fastapi import APIRouter, Depends, HTTPException, UploadFile, status

from app.core.cloudinary_client import ensure_configured, is_configured
from app.core.config import settings
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.upload import UploadOut

logger = logging.getLogger("uploads")

router = APIRouter()


@router.post("/uploads/image", response_model=UploadOut)
async def upload_image(
    file: UploadFile,
    _: User = Depends(get_current_user),
):
    if not is_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Armazenamento de imagens não configurado (credenciais do Cloudinary ausentes)",
        )

    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Selecione um arquivo de imagem")

    # Sem limite de tamanho por decisão de produto — quem estourar o teto do
    # plano do Cloudinary recebe o 502 abaixo, que já é uma mensagem clara.
    contents = await file.read()

    ensure_configured()

    try:
        # `cloudinary.uploader.upload` é síncrono/bloqueante (chamada de rede
        # sem await) — rodar direto aqui trava o event loop inteiro (webhook
        # do WhatsApp, WebSocket, outras requisições) até o Cloudinary
        # responder. `run_in_executor` tira isso da thread principal.
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(
            None,
            lambda: cloudinary.uploader.upload(
                contents,
                folder=settings.CLOUDINARY_FOLDER,
                resource_type="image",
            ),
        )
    except Exception as exc:
        # Sem logar o erro real, um 502 do Cloudinary (credencial errada,
        # cota estourada, formato recusado) e um timeout de rede ficavam
        # indistinguíveis nos logs — sempre a mesma mensagem genérica.
        logger.exception("Falha ao enviar imagem para o Cloudinary: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Falha ao enviar a imagem para o armazenamento externo",
        )

    return UploadOut(url=result["secure_url"])
