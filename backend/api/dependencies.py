from fastapi import Request

from services.travel_service import TravelService


def get_travel_service(
    request: Request,
) -> TravelService:
    return request.app.state.travel_service