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
    # Secret próprio (não é a EVOLUTION_API_KEY) — a Evolution manda esse valor
    # de volta no header x-webhook-secret, é como o webhook confirma que quem
    # chamou foi mesmo a Evolution, já que essa rota não tem JWT.
    EVOLUTION_WEBHOOK_SECRET: str = ""
    # URL pública do backend (ex.: https://simbora-backend.up.railway.app) —
    # sem isso a Evolution não tem pra onde mandar o webhook.
    PUBLIC_API_URL: str = ""

    model_config = SettingsConfigDict(env_file=".env")

settings = Settings()
