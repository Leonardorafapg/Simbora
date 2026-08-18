# backend/app/core/config.py
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    APP_NAME: str = "Simbora API"
    DEBUG: bool = False
    FRONTEND_ORIGIN: str = "http://localhost:3000"
    WHATSAPP_NUMBER: str = "5598999999999"
    DATABASE_URL: str = "sqlite:///./simbora.db"

    SECRET_KEY: str = "change-me-in-env"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    # Evolution API — gateway self-hosted de WhatsApp (conexão única, global)
    EVOLUTION_API_URL: str = ""
    EVOLUTION_API_KEY: str = ""
    EVOLUTION_INSTANCE_NAME: str = "simbora"

    model_config = SettingsConfigDict(env_file=".env")

settings = Settings()
