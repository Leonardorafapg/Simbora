# backend/app/core/tag_colors.py
"""
Cor de etiqueta: uma das 10 chaves da paleta fixa (compatibilidade com o que
já existia) ou um hex livre "#rrggbb" (cor customizada). Hex aproximado de
cada chave da paleta — usado só pra ordenar por matiz junto com as cores
customizadas, não pra render (o front já tem as classes Tailwind próprias).
"""
import colorsys
import re

TAG_COLOR_KEYS = ["green", "yellow", "orange", "red", "purple", "blue", "teal", "lime", "pink", "gray"]

_PALETTE_HEX = {
    "green": "#047857",
    "yellow": "#ca8a04",
    "orange": "#c2410c",
    "red": "#b91c1c",
    "purple": "#7e22ce",
    "blue": "#1d4ed8",
    "teal": "#115e59",
    "lime": "#4d7c0f",
    "pink": "#be185d",
    "gray": "#475569",
}

_HEX_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


def is_valid_color(value: str) -> bool:
    return value in TAG_COLOR_KEYS or bool(_HEX_RE.match(value))


def normalize_color(value: str) -> str:
    """Chave da paleta passa direto; hex vira minúsculo (consistência de exibição/comparação)."""
    return value if value in TAG_COLOR_KEYS else value.lower()


def _resolve_hex(color: str) -> str:
    return _PALETTE_HEX.get(color, color if _HEX_RE.match(color) else _PALETTE_HEX["gray"])


def color_sort_key(color: str) -> tuple[float, float, float]:
    """(matiz, -luminosidade, -saturação) — agrupa por matiz (roda de cores),
    cores mais vivas/escuras primeiro dentro do mesmo matiz."""
    hex_color = _resolve_hex(color)
    try:
        r = int(hex_color[1:3], 16) / 255
        g = int(hex_color[3:5], 16) / 255
        b = int(hex_color[5:7], 16) / 255
    except (ValueError, IndexError):
        return (999.0, 0.0, 0.0)
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    return (round(h * 360, 1), -l, -s)
