# backend/app/core/r2_client.py
import uuid
from datetime import datetime, timezone

import boto3
from botocore.config import Config

from app.core.config import settings

# SVG fica de fora de propósito: pode carregar script e é servido do domínio
# público do bucket.
IMAGE_EXTENSIONS = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/avif": "avif",
}

# Só pro Instagram (Reels/Stories em vídeo) — formatos que a Meta aceita.
VIDEO_EXTENSIONS = {
    "video/mp4": "mp4",
    "video/quicktime": "mov",
}

# PDFs do calendário (fluxo de aprovação) — upload separado do de imagens,
# mesmo mecanismo de presign.
DOCUMENT_EXTENSIONS = {
    "application/pdf": "pdf",
}

# Documentos aceitos como arte finalizada do post (além de imagem) — upload via
# /uploads/presign-artwork. Separado de DOCUMENT_EXTENSIONS, que é só o PDF do calendário.
ARTWORK_DOCUMENT_EXTENSIONS = {
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.ms-powerpoint": "ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "application/zip": "zip",
}

_client = None


def is_configured() -> bool:
    return bool(
        settings.R2_ACCOUNT_ID
        and settings.R2_ACCESS_KEY_ID
        and settings.R2_SECRET_ACCESS_KEY
        and settings.R2_BUCKET
        and settings.R2_PUBLIC_BASE_URL
    )


def get_client():
    """Cliente S3 do R2, criado uma única vez e sob demanda (o backend sobe
    normalmente sem as credenciais — só o upload fica indisponível)."""
    global _client
    if _client is None:
        _client = boto3.client(
            "s3",
            endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
            aws_access_key_id=settings.R2_ACCESS_KEY_ID,
            aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
            region_name="auto",
            config=Config(
                signature_version="s3v4",
                s3={"addressing_style": "path"},
                # Sem isso o boto3 injeta headers de checksum na URL assinada,
                # que o browser não envia e o R2 recusa.
                request_checksum_calculation="when_required",
                response_checksum_validation="when_required",
            ),
        )
    return _client


def new_object_key(content_type: str, folder: str | None = None, subdir: str = "") -> str:
    now = datetime.now(timezone.utc)
    ext = IMAGE_EXTENSIONS.get(content_type) or VIDEO_EXTENSIONS.get(content_type) or DOCUMENT_EXTENSIONS.get(content_type) or ARTWORK_DOCUMENT_EXTENSIONS[content_type]
    prefix = "/".join(p for p in (settings.R2_KEY_PREFIX.strip("/"), folder) if p)
    subdir = subdir.strip("/")
    name = f"{subdir}/{now:%Y/%m}/{uuid.uuid4().hex}.{ext}" if subdir else f"{now:%Y/%m}/{uuid.uuid4().hex}.{ext}"
    return f"{prefix}/{name}" if prefix else name


def public_url(key: str) -> str:
    return f"{settings.R2_PUBLIC_BASE_URL.rstrip('/')}/{key}"


def is_public_url(url: str) -> bool:
    """URL servida pelo próprio bucket (não um link qualquer da internet)."""
    base = settings.R2_PUBLIC_BASE_URL.rstrip("/")
    return bool(base) and url.startswith(base + "/")


def presign_put(key: str, content_type: str, size: int) -> str:
    return get_client().generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.R2_BUCKET,
            "Key": key,
            "ContentType": content_type,
            "ContentLength": size,
        },
        ExpiresIn=settings.R2_PRESIGN_EXPIRES_SECONDS,
        HttpMethod="PUT",
    )


def put_object(key: str, content_type: str, body: bytes) -> None:
    get_client().put_object(
        Bucket=settings.R2_BUCKET,
        Key=key,
        Body=body,
        ContentType=content_type,
    )
