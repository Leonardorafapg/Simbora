# backend/app/schemas/client.py
from pydantic import BaseModel, EmailStr, field_validator


class ClientCreate(BaseModel):
    name: str
    photo_url: str | None = None
    contact_name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    whatsapp_group_id: str | None = None
    instagram: str | None = None
    notes: str | None = None
    default_social_id: int | None = None
    default_designer_id: int | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Nome do cliente é obrigatório")
        return value


class ClientUpdate(BaseModel):
    name: str | None = None
    photo_url: str | None = None
    contact_name: str | None = None
    email: EmailStr | None = None
    phone: str | None = None
    whatsapp_group_id: str | None = None
    instagram: str | None = None
    notes: str | None = None
    default_social_id: int | None = None
    default_designer_id: int | None = None
    is_active: bool | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        if not value:
            raise ValueError("Nome do cliente é obrigatório")
        return value


class ClientOut(BaseModel):
    id: int
    name: str
    photo_url: str | None
    contact_name: str | None
    email: str | None
    phone: str | None
    whatsapp_group_id: str | None
    instagram: str | None
    notes: str | None
    default_social_id: int | None
    default_designer_id: int | None
    is_active: bool

    model_config = {"from_attributes": True}
