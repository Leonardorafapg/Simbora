# backend/app/schemas/tag.py
from pydantic import BaseModel, field_validator

from app.core.tag_colors import TAG_COLOR_KEYS as TAG_COLORS
from app.core.tag_colors import is_valid_color, normalize_color


def _clean_name(value: str) -> str:
    value = " ".join(value.split())
    if not value:
        raise ValueError("Nome da etiqueta é obrigatório")
    if len(value) > 40:
        raise ValueError("Nome da etiqueta pode ter no máximo 40 caracteres")
    return value


def _check_color(value: str) -> str:
    if not is_valid_color(value):
        raise ValueError(
            f"Cor inválida. Use uma da paleta ({', '.join(TAG_COLORS)}) ou um hex no formato #rrggbb"
        )
    return normalize_color(value)


class TagOut(BaseModel):
    id: int
    name: str
    color: str

    model_config = {"from_attributes": True}


class TagCreate(BaseModel):
    name: str
    color: str = "gray"

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return _clean_name(value)

    @field_validator("color")
    @classmethod
    def validate_color(cls, value: str) -> str:
        return _check_color(value)


class TagUpdate(BaseModel):
    name: str | None = None
    color: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        return _clean_name(value) if value is not None else None

    @field_validator("color")
    @classmethod
    def validate_color(cls, value: str | None) -> str | None:
        return _check_color(value) if value is not None else None
