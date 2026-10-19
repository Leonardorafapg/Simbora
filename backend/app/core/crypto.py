# backend/app/core/crypto.py
"""Criptografia simétrica de tokens de integração (ex.: access token do Instagram)
antes de gravar no banco — nunca guardar token em texto puro."""
import base64
import hashlib
from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings


class TokenDecryptError(Exception):
    """Token gravado com outra chave (TOKEN_ENCRYPTION_KEY/SECRET_KEY trocado)."""


@lru_cache(maxsize=1)
def _fernet() -> Fernet:
    key = settings.TOKEN_ENCRYPTION_KEY.strip()
    if not key:
        # Deriva uma chave Fernet válida (32 bytes, base64url) do SECRET_KEY.
        digest = hashlib.sha256(f"simbora-token-key:{settings.SECRET_KEY}".encode("utf-8")).digest()
        key = base64.urlsafe_b64encode(digest).decode("ascii")
    return Fernet(key.encode("ascii"))


def encrypt_token(plain: str) -> str:
    return _fernet().encrypt(plain.encode("utf-8")).decode("ascii")


def decrypt_token(encrypted: str) -> str:
    try:
        return _fernet().decrypt(encrypted.encode("ascii")).decode("utf-8")
    except InvalidToken as exc:
        raise TokenDecryptError("Token gravado com outra chave de criptografia") from exc
