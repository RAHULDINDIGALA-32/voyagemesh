from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.router import api_router
from config import get_settings
from services.travel_service import TravelService
from observability.logging import configure_logging
from observability.context import new_request_id, valid_request_id, set_context, reset_context
from observability.langsmith import configure_langsmith
from fastapi import Request
from fastapi.responses import JSONResponse
import asyncio


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    configure_langsmith(settings.environment, settings.langsmith_project)
    service = TravelService()
    await service.startup()

    app.state.travel_service = service

    try:
        yield
    finally:
        await service.shutdown()


settings = get_settings()
configure_logging()

app = FastAPI(
    title="VoyageMesh API",
    description=(
        "An intelligent multi-agent travel planning system powered by LangGraph, MCP, Guardrails, and HITL workflows"
    ),
    version="0.3.0",
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
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)

@app.middleware("http")
async def request_context_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") if valid_request_id(request.headers.get("X-Request-ID")) else new_request_id()
    token = set_context(request_id=request_id)
    try:
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response
    finally:
        reset_context(token)

app.include_router(
    api_router,
    prefix="/api/v1",
)


@app.get("/")
def root():
    return {
        "name": "VoyageMesh API",
        "version": "0.3.0",
        "docs": None if settings.is_production else "/docs",
        "health": "/api/v1/health",
    }
