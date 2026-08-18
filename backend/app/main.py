# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import run_light_migrations
from app.routers import leads, auth, users, clients, calendar, calendar_periods, demands, whatsapp, whatsapp_webhook, search

run_light_migrations()

app = FastAPI(title=settings.APP_NAME, debug=settings.DEBUG)

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
app.include_router(clients.router, prefix="/api/v1")
app.include_router(calendar.router, prefix="/api/v1")
app.include_router(calendar_periods.router, prefix="/api/v1")
app.include_router(demands.router, prefix="/api/v1")
app.include_router(whatsapp.router, prefix="/api/v1")
app.include_router(whatsapp_webhook.router, prefix="/api/v1")
app.include_router(search.router, prefix="/api/v1")

@app.get("/api/v1/health")
async def health_check():
    return {"status": "ok", "app": settings.APP_NAME}
