from datetime import datetime, timezone
from fastapi import APIRouter
from fastapi import Request
from fastapi.responses import JSONResponse
from config import get_settings

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


@router.get("/ready")
async def ready(request: Request):
    service = getattr(request.app.state, "travel_service", None)
    checks = {
        "config": {"status": "ok"},
        "database": {"status": "failed"},
        "checkpointer": {"status": "failed"},
    }
    settings = get_settings()
    required = [settings.tavily_api_key, settings.aviationstack_api_key, settings.database_url]
    if not all(required):
        checks["config"] = {"status": "failed"}
    if service and service.database.pool:
        try:
            async with service.database.pool.connection() as connection:
                result = await connection.execute("SELECT 1")
                await result.fetchone()
            checks["database"] = {"status": "ok"}
        except Exception:
            checks["database"] = {"status": "failed"}
    if service and service.graph is not None and service.database.checkpointer is not None:
        checks["checkpointer"] = {"status": "ok"}
    ok = all(item["status"] == "ok" for item in checks.values())
    return JSONResponse(status_code=200 if ok else 503, content={"status": "ready" if ok else "not_ready", "checks": checks})
