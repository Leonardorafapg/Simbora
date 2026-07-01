# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.routers import leads

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

@app.get("/api/v1/health")
async def health_check():
    return {"status": "ok", "app": settings.APP_NAME}
