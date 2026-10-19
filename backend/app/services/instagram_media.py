# backend/app/services/instagram_media.py
"""
Validação e preparo das mídias antes de agendar — tudo que dá pra pegar aqui
vira erro na hora de agendar (com mensagem clara), em vez de falhar horas
depois, na publicação, com um erro obscuro da Meta.

- A API de publicação só aceita imagem JPEG: PNG/WebP/GIF/AVIF são convertidas
  (o GBRAND mandava o arquivo original e a Meta recusava).
- Feed (imagem e carrossel) só aceita proporção entre 4:5 e 1,91:1.
- Imagem com mais de 1440 px de largura é reduzida (o Instagram não usa mais
  que isso e o limite é 8 MB).
"""
import io
from urllib.parse import urlparse

import httpx
from PIL import Image, ImageOps, UnidentifiedImageError

from app.core import r2_client

MEDIA_TYPES = ("IMAGE", "CAROUSEL", "REELS", "STORIES")
VIDEO_EXTS = (".mp4", ".mov")
IMAGE_EXTS = (".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif")

FEED_MIN_RATIO = 4 / 5
FEED_MAX_RATIO = 1.91
RATIO_TOLERANCE = 0.01
MAX_WIDTH = 1440
MAX_JPEG_BYTES = 8 * 1024 * 1024
MAX_DOWNLOAD_BYTES = 60 * 1024 * 1024
PREPARED_FOLDER = "instagram"


class MediaError(Exception):
    """Mídia inválida pra publicar — a mensagem vai direto pro usuário."""


def is_video(url: str) -> bool:
    return urlparse(url).path.lower().endswith(VIDEO_EXTS)


def _is_image(url: str) -> bool:
    return urlparse(url).path.lower().endswith(IMAGE_EXTS)


def validate_media(media_type: str, urls: list[str]) -> None:
    if media_type not in MEDIA_TYPES:
        raise MediaError("Formato inválido. Use feed (imagem), carrossel, Reels ou Story.")
    if not urls:
        raise MediaError("Adicione a mídia do post.")
    for url in urls:
        if not url.lower().startswith("https://"):
            raise MediaError("A mídia precisa ser enviada pelo CRM (link https público).")
        if not r2_client.is_public_url(url):
            raise MediaError("Use mídias enviadas pelo CRM — links de outros sites não são aceitos.")
        if not (is_video(url) or _is_image(url)):
            raise MediaError("Arquivo não suportado. Use imagem (JPG, PNG, WebP) ou vídeo (MP4, MOV).")

    videos = [u for u in urls if is_video(u)]
    if media_type == "IMAGE":
        if len(urls) != 1 or videos:
            raise MediaError("Post de feed precisa de exatamente 1 imagem (pra vídeo, use Reels).")
    elif media_type == "REELS":
        if len(urls) != 1 or not videos:
            raise MediaError("Reels precisa de exatamente 1 vídeo (MP4 ou MOV).")
    elif media_type == "STORIES":
        if len(urls) != 1:
            raise MediaError("Story precisa de exatamente 1 imagem ou vídeo.")
    elif media_type == "CAROUSEL":
        if not 2 <= len(urls) <= 10:
            raise MediaError("Carrossel precisa de 2 a 10 imagens/vídeos.")


def _download(url: str) -> bytes:
    try:
        with httpx.Client(timeout=httpx.Timeout(30.0, connect=10.0), follow_redirects=False) as client:
            with client.stream("GET", url) as resp:
                resp.raise_for_status()
                body = bytearray()
                for chunk in resp.iter_bytes():
                    body.extend(chunk)
                    if len(body) > MAX_DOWNLOAD_BYTES:
                        raise MediaError("Imagem grande demais.")
                return bytes(body)
    except httpx.HTTPError:
        raise MediaError("Não foi possível baixar a imagem enviada. Envie de novo.") from None


def _to_jpeg(data: bytes, *, check_feed_ratio: bool, position: int | None) -> bytes:
    label = f"A imagem {position}" if position else "A imagem"
    try:
        img = Image.open(io.BytesIO(data))
        img.seek(0)  # GIF animado: usa o primeiro quadro
        img = ImageOps.exif_transpose(img)
    except (UnidentifiedImageError, OSError):
        raise MediaError(f"{label} está corrompida ou num formato não suportado.") from None

    width, height = img.size
    if width < 1 or height < 1:
        raise MediaError(f"{label} está vazia.")
    ratio = width / height
    if check_feed_ratio and not (FEED_MIN_RATIO - RATIO_TOLERANCE <= ratio <= FEED_MAX_RATIO + RATIO_TOLERANCE):
        raise MediaError(
            f"{label} tem proporção {width}x{height}, que o feed do Instagram não aceita. "
            "Use entre 4:5 (retrato, ex.: 1080x1350) e 1,91:1 (paisagem, ex.: 1080x566)."
        )

    if img.mode in ("RGBA", "LA", "P"):
        img = img.convert("RGBA")
        background = Image.new("RGB", img.size, (255, 255, 255))  # transparência vira branco
        background.paste(img, mask=img.split()[-1])
        img = background
    elif img.mode != "RGB":
        img = img.convert("RGB")

    if width > MAX_WIDTH:
        img = img.resize((MAX_WIDTH, max(1, round(MAX_WIDTH / ratio))), Image.LANCZOS)

    for quality in (90, 82, 72, 60):
        out = io.BytesIO()
        img.save(out, "JPEG", quality=quality, optimize=True, progressive=True)
        if out.tell() <= MAX_JPEG_BYTES:
            return out.getvalue()
    raise MediaError(f"{label} continua acima de 8 MB mesmo comprimida.")


def _is_prepared(url: str) -> bool:
    """Imagem que já passou por aqui (não converte de novo ao reagendar)."""
    return f"/{PREPARED_FOLDER}/" in urlparse(url).path and urlparse(url).path.lower().endswith(".jpg")


def prepare_publish_urls(media_type: str, urls: list[str]) -> list[str]:
    """Valida e devolve as URLs que vão pra Meta (imagens em JPEG no R2)."""
    validate_media(media_type, urls)
    if not r2_client.is_configured():
        raise MediaError("Armazenamento de mídia (R2) não configurado no servidor.")

    check_ratio = media_type in ("IMAGE", "CAROUSEL")
    prepared: list[str] = []
    for index, url in enumerate(urls, start=1):
        if is_video(url) or _is_prepared(url):
            prepared.append(url)
            continue
        jpeg = _to_jpeg(_download(url), check_feed_ratio=check_ratio, position=index if len(urls) > 1 else None)
        key = r2_client.new_object_key("image/jpeg", folder=PREPARED_FOLDER)
        try:
            r2_client.put_object(key, "image/jpeg", jpeg)
        except Exception:
            raise MediaError("Falha ao gravar a imagem convertida no armazenamento. Tente de novo.") from None
        prepared.append(r2_client.public_url(key))
    return prepared
