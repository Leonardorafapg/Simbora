from pydantic import BaseModel, Field, field_validator


class UploadOut(BaseModel):
    url: str


class PresignRequest(BaseModel):
    content_type: str
    size: int = Field(gt=0)


class PresignOut(BaseModel):
    # PUT neste endereço com o corpo do arquivo e exatamente estes headers.
    upload_url: str
    headers: dict[str, str]
    # URL definitiva — é a que vai pro banco depois do PUT.
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
