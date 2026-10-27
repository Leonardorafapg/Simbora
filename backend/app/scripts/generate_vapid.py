# backend/app/scripts/generate_vapid.py
"""Gera o par de chaves VAPID do push. Rode UMA vez e guarde nas variáveis de ambiente do backend:

    cd backend && python -m app.scripts.generate_vapid

A chave PRIVADA é segredo (só no ambiente do servidor, nunca no git nem no front). Trocar o par
depois invalida todas as inscrições de aparelhos — cada pessoa teria que ativar de novo.
"""
import base64

from cryptography.hazmat.primitives import serialization
from py_vapid import Vapid


def _b64url(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def generate() -> tuple[str, str]:
    """(chave_pública, chave_privada), ambas em base64 url-safe sem '='."""
    vapid = Vapid()
    vapid.generate_keys()
    private_raw = vapid.private_key.private_numbers().private_value.to_bytes(32, "big")
    public_raw = vapid.public_key.public_bytes(
        serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
    )
    return _b64url(public_raw), _b64url(private_raw)


if __name__ == "__main__":
    public, private = generate()
    print("Cole estas variáveis no ambiente do backend (Railway):\n")
    print(f"VAPID_PUBLIC_KEY={public}")
    print(f"VAPID_PRIVATE_KEY={private}")
    print("VAPID_SUBJECT=mailto:seu-email@dominio.com")
