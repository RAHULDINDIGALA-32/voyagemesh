from datetime import datetime, timezone
from fastapi import APIRouter

from api.schemas import HealthResponse

router = APIRouter(tags=["Health"])

@router.get(
    "/health",
    response_model=HealthResponse,
)
def health():
    return HealthResponse(
        status="OK",
        timestamp=datetime.now(timezone.utc)
    )