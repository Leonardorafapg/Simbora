# backend/app/core/cloudinary_client.py
import cloudinary

from app.core.config import settings

_configured = False


def is_configured() -> bool:
    return bool(settings.CLOUDINARY_CLOUD_NAME and settings.CLOUDINARY_API_KEY and settings.CLOUDINARY_API_SECRET)


def ensure_configured() -> None:
    """Configura o SDK do Cloudinary uma única vez, sob demanda.

    Feito lazy (não no import do módulo) pra o backend continuar subindo
    normalmente mesmo sem as credenciais preenchidas — só o endpoint de
    upload fica indisponível, com uma mensagem clara, em vez do app inteiro
    falhar ao iniciar.
    """
    global _configured
    if _configured:
        return

    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True,
    )
    _configured = True
