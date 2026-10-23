# backend/app/services/links.py
"""Links anexados às postagens (pasta do Drive, Figma, etc.)."""
import re
from urllib.parse import urlparse

# "javascript:...", "data:...", "mailto:..." — esquema sem "//" não pode ganhar https:// na frente.
_SCHEME_WITHOUT_SLASHES = re.compile(r"^[a-zA-Z][a-zA-Z0-9+.-]*:(?!//|\d+(/|$))")

MAX_LINKS = 20
MAX_LINK_LENGTH = 500


def normalize_link(raw: str) -> str:
    """'drive.google.com/x' -> 'https://drive.google.com/x'. Só http/https com domínio."""
    value = (raw or "").strip()
    if not value:
        raise ValueError("Link vazio.")
    if _SCHEME_WITHOUT_SLASHES.match(value):
        raise ValueError(f"Link inválido: {raw.strip()[:60]}")
    if "://" not in value:
        value = f"https://{value}"
    parsed = urlparse(value)
    if parsed.scheme not in ("http", "https") or not parsed.netloc or " " in value:
        raise ValueError(f"Link inválido: {raw.strip()[:60]}")
    if len(value) > MAX_LINK_LENGTH:
        raise ValueError("Link longo demais (máximo 500 caracteres).")
    return value


def normalize_links(values: list[str] | None) -> list[str] | None:
    """Valida cada link, tira repetidos (mantém a ordem) e limita a quantidade."""
    if values is None:
        return None
    seen: list[str] = []
    for raw in values:
        link = normalize_link(raw)
        if link not in seen:
            seen.append(link)
    if len(seen) > MAX_LINKS:
        raise ValueError(f"No máximo {MAX_LINKS} links.")
    return seen
