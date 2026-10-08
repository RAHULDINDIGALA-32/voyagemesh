import json
import logging
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from api.auth import AuthUser, get_current_user
from api.dependencies import get_travel_service
from api.schemas import FollowUpRequest, TripRequest, TripResponse
from hitl.contracts import HumanResponseRequest
from hitl.errors import HitlError
from services.travel_service import TravelService


logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/trips",
    tags=["Trips"],
)


def _sse(event: str, data: dict) -> str:
    # Database-backed payloads can contain UUIDs/datetimes even though the
    # public SSE contract is JSON. Keep serialization at the transport
    # boundary so a single non-native value cannot terminate the stream.
    return f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"


def _serialize(record: dict) -> dict:
    payload = {}
    for key, value in record.items():
        if isinstance(value, datetime):
            payload[key] = value.isoformat()
        elif isinstance(value, UUID):
            payload[key] = str(value)
        else:
            payload[key] = value
    return payload


@router.get("")
async def list_trips(
    user: AuthUser = Depends(get_current_user),
    service: TravelService = Depends(get_travel_service),
):
    rows = await service._product().list_trips(str(user.id))
    return [_serialize(row) for row in rows]


@router.post("", response_model=TripResponse)
async def create_trip(
    payload: TripRequest,
    user: AuthUser = Depends(get_current_user),
    service: TravelService = Depends(get_travel_service),
):
    try:
        return await service.create_trip(payload.query, str(user.id))
    except Exception as exc:
        logger.exception("Trip workflow failed")
        raise HTTPException(
            status_code=502,
            detail="Travel planning workflow failed",
        ) from exc


@router.post("/stream")
async def stream_trip(
    payload: TripRequest,
    user: AuthUser = Depends(get_current_user),
    service: TravelService = Depends(get_travel_service),
):
    async def event_generator():
        try:
            async for item in service.stream_trip(payload.query, str(user.id)):
                yield _sse(item["event"], item["data"])
        except Exception:
            logger.exception("Trip streaming workflow failed")
            yield 'event: error\ndata: {"detail": "Travel planning workflow failed"}\n\n'

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/{thread_id}/messages")
async def continue_trip(
    thread_id: str,
    payload: FollowUpRequest,
    user: AuthUser = Depends(get_current_user),
    service: TravelService = Depends(get_travel_service),
):
    if not thread_id.startswith("trip_"):
        raise HTTPException(status_code=400, detail="Invalid thread ID")

    async def event_generator():
        try:
            async for item in service.stream_continue(
                thread_id, payload.query, str(user.id)
            ):
                yield _sse(item["event"], item["data"])
        except LookupError:
            yield 'event: error\ndata: {"detail": "Trip not found"}\n\n'
        except RuntimeError as exc:
            yield f"event: error\ndata: {json.dumps({'detail': str(exc)})}\n\n"
        except Exception:
            logger.exception("Trip follow-up failed")
            yield 'event: error\ndata: {"detail": "Unable to continue travel planning"}\n\n'

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/{thread_id}/status")
async def trip_status(
    thread_id: str,
    user: AuthUser = Depends(get_current_user),
    service: TravelService = Depends(get_travel_service),
):
    try:
        return await service.get_trip_status(thread_id, str(user.id))
    except HitlError as exc:
        raise HTTPException(status_code=exc.http_status, detail={"code": exc.code, "detail": exc.detail}) from exc


@router.post("/{thread_id}/retry", response_model=TripResponse)
async def retry_trip(
    thread_id: str,
    user: AuthUser = Depends(get_current_user),
    service: TravelService = Depends(get_travel_service),
):
    try:
        return await service.retry_resume(thread_id, str(user.id))
    except HitlError as exc:
        raise HTTPException(status_code=exc.http_status, detail={"code": exc.code, "detail": exc.detail, "recoverable": exc.recoverable}) from exc


@router.post("/{thread_id}/cancel", response_model=TripResponse)
async def cancel_trip(
    thread_id: str,
    user: AuthUser = Depends(get_current_user),
    service: TravelService = Depends(get_travel_service),
):
    try:
        return await service.cancel_trip(thread_id, str(user.id))
    except HitlError as exc:
        raise HTTPException(status_code=exc.http_status, detail={"code": exc.code, "detail": exc.detail}) from exc


@router.post("/{thread_id}/interventions/reopen", response_model=TripResponse)
async def reopen_intervention(
    thread_id: str,
    user: AuthUser = Depends(get_current_user),
    service: TravelService = Depends(get_travel_service),
):
    try:
        return await service.reopen_intervention(thread_id, str(user.id))
    except HitlError as exc:
        raise HTTPException(status_code=exc.http_status, detail={"code": exc.code, "detail": exc.detail, "recoverable": exc.recoverable}) from exc


@router.get(
    "/{thread_id}",
    response_model=TripResponse,
)
async def get_trip(
    thread_id: str,
    user: AuthUser = Depends(get_current_user),
    service: TravelService = Depends(get_travel_service),
):
    if not thread_id.startswith("trip_"):
        raise HTTPException(
            status_code=400,
            detail="Invalid thread ID",
        )

    try:
        return await service.get_trip(thread_id, str(user.id))

    except HitlError as exc:
        raise HTTPException(status_code=exc.http_status, detail={"code": exc.code, "detail": exc.detail}) from exc


@router.post("/{thread_id}/interventions", response_model=TripResponse)
async def respond_to_intervention(
    thread_id: str,
    payload: HumanResponseRequest,
    user: AuthUser = Depends(get_current_user),
    service: TravelService = Depends(get_travel_service),
):
    if not thread_id.startswith("trip_"):
        raise HTTPException(status_code=400, detail="Invalid thread ID")

    try:
        return await service.respond_to_intervention(
            thread_id, payload, str(user.id)
        )
    except HitlError as exc:
        raise HTTPException(
            status_code=exc.http_status,
            detail={
                "code": exc.code,
                "detail": exc.detail,
                "recoverable": exc.recoverable,
            },
        ) from exc
    except Exception as exc:
        logger.exception("HITL workflow resumption failed")
        raise HTTPException(
            status_code=502,
            detail={"code": "resume_failed", "detail": "Unable to resume travel planning workflow", "recoverable": True},
        ) from exc


@router.get("/{thread_id}/state")
async def get_trip_state(
    thread_id: str,
    user: AuthUser = Depends(get_current_user),
    service: TravelService = Depends(get_travel_service),
):
    if not thread_id.startswith("trip_"):
        raise HTTPException(
            status_code=400,
            detail="Invalid thread ID",
        )

    try:
        return await service.get_trip_state(thread_id, str(user.id))

    except LookupError as exc:
        raise HTTPException(
            status_code=404,
            detail="Trip not found",
        ) from exc

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Unable to retrieve trip state",
        ) from exc
