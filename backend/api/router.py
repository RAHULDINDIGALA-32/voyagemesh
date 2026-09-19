from fastapi import APIRouter

from api.routes import health, trips


api_router = APIRouter()

api_router.include_router(health.router)
api_router.include_router(trips.router)