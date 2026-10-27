# backend/app/schemas/notification.py
from datetime import datetime

from pydantic import BaseModel, field_serializer

from app.core.timeutil import as_utc


class NotificationOut(BaseModel):
    id: int
    type: str
    title: str
    body: str | None
    link: str | None
    created_at: datetime
    read_at: datetime | None

    model_config = {"from_attributes": True}

    @field_serializer("created_at", "read_at")
    def serialize_dt(self, value: datetime | None) -> datetime | None:
        return as_utc(value)


class UnreadCountOut(BaseModel):
    unread: int
