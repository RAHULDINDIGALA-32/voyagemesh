import json
import logging

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)
from fastapi.responses import StreamingResponse

from api.dependencies import get_travel_service
from api.schemas import HumanResponseRequest, TripRequest, TripResponse
from hitl.contracts import HumanResponseRequest as ValidatedHumanResponseRequest
from services.travel_service import TravelService


logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/trips",
    tags=["Trips"],
)


@router.post("", response_model=TripResponse)
async def create_trip(
    payload: TripRequest,
    service: TravelService = Depends(get_travel_service),
):

    try:
        result = await service.create_trip(payload.query)

        return result

    except Exception as exc:
        logger.exception("Trip workflow failed")
        raise HTTPException(
            status_code=502,
            detail="Travel planning workflow failed",
        ) from exc


@router.post("/stream")
async def stream_trip(
    payload: TripRequest,
    service: TravelService = Depends(get_travel_service),
):
    async def event_generator():
        try:
            async for item in service.stream_trip(payload.query):
                yield (
                    f"event: {item['event']}\n"
                    f"data: {json.dumps(item['data'])}\n\n"
                )
        except Exception:
            logger.exception("Trip streaming workflow failed")
            yield "event: error\ndata: {\"detail\": \"Travel planning workflow failed\"}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get(
    "/{thread_id}",
    response_model=TripResponse,
)
async def get_trip(
    thread_id: str,
    service: TravelService = Depends(get_travel_service),
):
    if not thread_id.startswith("trip_"):
        raise HTTPException(
            status_code=400,
            detail="Invalid thread ID",
        )

    try:
        return await service.get_trip(thread_id)

    except LookupError as exc:
        raise HTTPException(
            status_code=404,
            detail="Trip not found",
        ) from exc


@router.post("/{thread_id}/interventions", response_model=TripResponse)
async def respond_to_intervention(
    thread_id: str,
    payload: HumanResponseRequest,
    service: TravelService = Depends(get_travel_service),
):
    if not thread_id.startswith("trip_"):
        raise HTTPException(status_code=400, detail="Invalid thread ID")

    try:
        validated_payload = ValidatedHumanResponseRequest.model_validate(
            payload.model_dump()
        )
        return await service.respond_to_intervention(thread_id, validated_payload)
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail="Invalid workflow token") from exc
    except TimeoutError as exc:
        raise HTTPException(status_code=410, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=404, detail="Intervention not found") from exc
    except RuntimeError as exc:
        logger.exception("Unable to resume HITL workflow")
        raise HTTPException(status_code=409, detail="Intervention is currently being processed") from exc
    except Exception as exc:
        logger.exception("HITL workflow resumption failed")
        raise HTTPException(status_code=502, detail="Unable to resume travel planning workflow") from exc


@router.get("/{thread_id}/state")
async def get_trip_state(
    thread_id: str,
    service: TravelService = Depends(get_travel_service),
):
    if not thread_id.startswith("trip_"):
        raise HTTPException(
            status_code=400,
            detail="Invalid thread ID",
        )

    try:
        return await service.get_trip_state(thread_id)

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
