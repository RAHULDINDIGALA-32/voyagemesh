from fastapi import Request

from backend.services.travel_service import TravelService


def get_travel_service(
    request: Request,
) -> TravelService:
    return request.backend.state.travel_service