# backend/app/schemas/upload.py
from pydantic import BaseModel


class UploadOut(BaseModel):
    url: str
