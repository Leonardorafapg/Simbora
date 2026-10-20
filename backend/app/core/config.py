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
    # Quantos dias o link de aprovação enviado ao cliente (sem login) fica válido.
    CALENDAR_APPROVAL_TOKEN_EXPIRE_DAYS: int = 7

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

    # Cloudflare R2 — armazenamento externo de imagens. O browser envia direto
    # pro bucket por URL pré-assinada; o banco guarda só a URL pública.
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET: str = ""
    # Base pública do bucket (domínio customizado ou r2.dev), sem barra final.
    R2_PUBLIC_BASE_URL: str = ""
    R2_KEY_PREFIX: str = "simbora-crm"
    R2_PRESIGN_EXPIRES_SECONDS: int = 300
    # Teto de segurança contra abuso (a URL pré-assinada fixa o tamanho exato).
    UPLOAD_MAX_BYTES: int = 50 * 1024 * 1024

    # Login OAuth do MCP (ver docs/plano-mcp-oauth.md). O issuer é o PUBLIC_API_URL.
    # URL do endpoint MCP (com /mcp): vira o `aud` dos tokens e o `resource` aceito.
    MCP_RESOURCE_URL: str = ""
    # Segredo só entre o serviço MCP e o backend, usado em /oauth/introspect.
    MCP_INTROSPECTION_SECRET: str = ""
    OAUTH_ACCESS_TOKEN_MINUTES: int = 60
    OAUTH_REFRESH_TOKEN_DAYS: int = 30
    # Hosts HTTPS extras aceitos como redirect do OAuth (separados por vírgula).
    OAUTH_EXTRA_REDIRECT_HOSTS: str = ""

    model_config = SettingsConfigDict(env_file=".env")

settings = Settings()
