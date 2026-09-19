from fastapi import APIRouter

from backend.api.routes import health, trips


api_router = APIRouter(
    prefix="/api"
)

api_router.include_router(health.router)
api_router.include_router(trips.router)