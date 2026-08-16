# backend/app/schemas/user.py
import re
from datetime import date

from pydantic import BaseModel, EmailStr, field_validator


def _clean_cpf(value: str) -> str:
    digits = re.sub(r"\D", "", value)
    if len(digits) != 11:
        raise ValueError("CPF deve ter 11 dígitos")
    return digits


class UserCreate(BaseModel):
    full_name: str
    cpf: str
    birth_date: date
    email: EmailStr
    password: str
    cargo: str
    is_admin: bool = False
    photo_url: str | None = None

    @field_validator("cpf")
    @classmethod
    def validate_cpf(cls, value: str) -> str:
        return _clean_cpf(value)

    @field_validator("cargo")
    @classmethod
    def validate_cargo(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Cargo é obrigatório")
        return value


class UserUpdate(BaseModel):
    full_name: str | None = None
    cpf: str | None = None
    birth_date: date | None = None
    email: EmailStr | None = None
    password: str | None = None
    cargo: str | None = None
    is_admin: bool | None = None
    photo_url: str | None = None
    is_active: bool | None = None

    @field_validator("cpf")
    @classmethod
    def validate_cpf(cls, value: str | None) -> str | None:
        return _clean_cpf(value) if value is not None else None

    @field_validator("cargo")
    @classmethod
    def validate_cargo(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Cargo é obrigatório")
        return value


class UserOut(BaseModel):
    id: int
    full_name: str
    cpf: str
    birth_date: date
    email: EmailStr
    photo_url: str | None
    cargo: str
    is_admin: bool
    is_active: bool

    model_config = {"from_attributes": True}
