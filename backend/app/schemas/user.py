# backend/app/schemas/user.py
import re
from datetime import date

from pydantic import BaseModel, EmailStr, field_validator

from app.core.permissions import PERMISSIONS


def _clean_cpf(value: str) -> str:
    digits = re.sub(r"\D", "", value)
    if len(digits) != 11:
        raise ValueError("CPF deve ter 11 dígitos")
    return digits


def _check_password(value: str) -> str:
    # O teto de 72 bytes é do bcrypt — acima disso ele estoura (500) em vez de
    # truncar. O piso é baixo de propósito: senha provisória, trocada depois.
    if len(value) < 4:
        raise ValueError("A senha precisa ter ao menos 4 caracteres")
    if len(value.encode("utf-8")) > 72:
        raise ValueError("A senha pode ter no máximo 72 caracteres")
    return value


class PasswordChange(BaseModel):
    password: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return _check_password(value)


def _clean_permissions(value: list[str]) -> list[str]:
    unknown = set(value) - PERMISSIONS.keys()
    if unknown:
        raise ValueError(f"Permissões inválidas: {', '.join(sorted(unknown))}")
    return sorted(set(value))


class UserCreate(BaseModel):
    full_name: str
    cpf: str
    birth_date: date
    email: EmailStr
    password: str
    cargo: str
    is_admin: bool = False
    photo_url: str | None = None
    permissions: list[str] = []

    @field_validator("cpf")
    @classmethod
    def validate_cpf(cls, value: str) -> str:
        return _clean_cpf(value)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return _check_password(value)

    @field_validator("cargo")
    @classmethod
    def validate_cargo(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Cargo é obrigatório")
        return value

    @field_validator("permissions")
    @classmethod
    def validate_permissions(cls, value: list[str]) -> list[str]:
        return _clean_permissions(value)


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
    permissions: list[str] | None = None

    @field_validator("cpf")
    @classmethod
    def validate_cpf(cls, value: str | None) -> str | None:
        return _clean_cpf(value) if value is not None else None

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str | None) -> str | None:
        # Vazio = "não alterar senha" (o router ignora); só valida quando veio algo.
        return _check_password(value) if value else value

    @field_validator("cargo")
    @classmethod
    def validate_cargo(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Cargo é obrigatório")
        return value

    @field_validator("permissions")
    @classmethod
    def validate_permissions(cls, value: list[str] | None) -> list[str] | None:
        return _clean_permissions(value) if value is not None else None


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
    permissions: list[str]

    model_config = {"from_attributes": True}


class PermissionCatalogEntry(BaseModel):
    key: str
    label: str


class UserDirectoryEntry(BaseModel):
    """Só o necessário pra atribuir/identificar — sem CPF, email ou permissões."""

    id: int
    full_name: str
    cargo: str
    is_active: bool

    model_config = {"from_attributes": True}


def _clean_name(value: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError("Nome é obrigatório")
    return value


def _clean_cargo(value: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError("Cargo é obrigatório")
    return value


class TeamMemberCreate(BaseModel):
    """Cadastro de membro SEM senha (ver routers/team.py)."""

    model_config = {"extra": "forbid"}

    full_name: str
    cpf: str
    birth_date: date
    email: EmailStr
    cargo: str
    photo_url: str | None = None
    permissions: list[str] = []

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value: str) -> str:
        return _clean_name(value)

    @field_validator("cpf")
    @classmethod
    def validate_cpf(cls, value: str) -> str:
        return _clean_cpf(value)

    @field_validator("cargo")
    @classmethod
    def validate_cargo(cls, value: str) -> str:
        return _clean_cargo(value)

    @field_validator("permissions")
    @classmethod
    def validate_permissions(cls, value: list[str]) -> list[str]:
        return _clean_permissions(value)


class TeamMemberUpdate(BaseModel):
    """
    Edição de membro. `extra=forbid` de propósito: tentar mandar `is_admin`
    ou `password` aqui dá 422 em vez de ser ignorado em silêncio.
    """

    model_config = {"extra": "forbid"}

    full_name: str | None = None
    cpf: str | None = None
    birth_date: date | None = None
    email: EmailStr | None = None
    cargo: str | None = None
    photo_url: str | None = None
    is_active: bool | None = None
    permissions: list[str] | None = None

    @field_validator("full_name")
    @classmethod
    def validate_full_name(cls, value: str | None) -> str | None:
        return _clean_name(value) if value is not None else None

    @field_validator("cpf")
    @classmethod
    def validate_cpf(cls, value: str | None) -> str | None:
        return _clean_cpf(value) if value is not None else None

    @field_validator("cargo")
    @classmethod
    def validate_cargo(cls, value: str | None) -> str | None:
        return _clean_cargo(value) if value is not None else None

    @field_validator("permissions")
    @classmethod
    def validate_permissions(cls, value: list[str] | None) -> list[str] | None:
        return _clean_permissions(value) if value is not None else None
