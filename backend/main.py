from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.router import api_router
from config import get_settings
from services.travel_service import TravelService


@asynccontextmanager
async def lifespan(app: FastAPI):
    service = TravelService()
    service.startup()

    app.state.travel_service = service

    try:
        yield
    finally:
        service.shutdown()


settings = get_settings()

app = FastAPI(
    title="VoyageMesh API",
    description=(
        "An intelligent multi-agent travel planning system powered by LangGraph, MCP, Guardrails, and HITL workflows"
    ),
    version="0.1.0",
    lifespan=lifespan,
    docs_url=None if settings.is_production else "/docs",
    redoc_url=None if settings.is_production else "/redoc",
    openapi_url=None if settings.is_production else "/openapi.json",
)

cors_origins = {
    "http://localhost:3000",
    settings.frontend_url.rstrip("/"),
}

app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(origin for origin in cors_origins if origin),
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Authorization"],
)

app.include_router(
    api_router,
    prefix="/api/v1",
)


@app.get("/")
def root():
    return {
        "name": "VoyageMesh API",
        "version": "0.1.0",
        "docs": None if settings.is_production else "/docs",
        "health": "/api/v1/health",
    }