from pydantic import BaseModel, field_validator


class UploadOut(BaseModel):
    url: str


class UploadFromUrl(BaseModel):
    url: str

    @field_validator("url")
    @classmethod
    def validate_url(cls, value: str) -> str:
        value = value.strip()
        if not value.lower().startswith(("https://", "http://")):
            raise ValueError("Informe uma URL http(s)")
        return value
