# backend/app/main.py
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import run_light_migrations
from app.routers import leads, auth, users, team, clients, calendar, calendar_periods, whatsapp, whatsapp_webhook, search, uploads, tags, instagram, oauth
from app.services.instagram_posts import worker as instagram_worker

logging.basicConfig(level=logging.INFO)
# O httpx loga a URL completa em INFO, e a API do Instagram leva o access_token
# na query — vazaria o token nos logs.
logging.getLogger("httpx").setLevel(logging.WARNING)

run_light_migrations()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Laço que publica os posts agendados e renova os tokens do Instagram.
    if settings.INSTAGRAM_WORKER_ENABLED:
        instagram_worker.start()
    yield
    instagram_worker.stop()


app = FastAPI(title=settings.APP_NAME, debug=settings.DEBUG, lifespan=lifespan)

# CORS — Permite chamadas do frontend Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_ORIGIN,
        "https://simboramaranhao.com.br",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(leads.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(team.router, prefix="/api/v1")
app.include_router(clients.router, prefix="/api/v1")
app.include_router(calendar.router, prefix="/api/v1")
app.include_router(calendar_periods.router, prefix="/api/v1")
app.include_router(tags.router, prefix="/api/v1")
app.include_router(whatsapp.router, prefix="/api/v1")
app.include_router(whatsapp_webhook.router, prefix="/api/v1")
app.include_router(search.router, prefix="/api/v1")
app.include_router(uploads.router, prefix="/api/v1")
app.include_router(instagram.router, prefix="/api/v1")
app.include_router(oauth.router)  # metadata e /oauth/* na raiz, exigido pelo OAuth
app.include_router(oauth.api_router, prefix="/api/v1")

@app.get("/api/v1/health")
async def health_check():
    return {"status": "ok", "app": settings.APP_NAME}
