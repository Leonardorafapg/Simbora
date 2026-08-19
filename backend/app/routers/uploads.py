# backend/app/routers/uploads.py
import cloudinary.uploader
from fastapi import APIRouter, Depends, HTTPException, UploadFile, status

from app.core.cloudinary_client import ensure_configured, is_configured
from app.core.config import settings
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.upload import UploadOut

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
        result = cloudinary.uploader.upload(
            contents,
            folder=settings.CLOUDINARY_FOLDER,
            resource_type="image",
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Falha ao enviar a imagem para o armazenamento externo",
        )

    return UploadOut(url=result["secure_url"])
