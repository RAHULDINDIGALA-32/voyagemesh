from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class TripRequest(BaseModel):
    query: str = Field(
        min_length=5,
        max_length=2000,
        description="Natural language travel request",
    )


class TripAccepted(BaseModel):
    request_id: str
    thread_id: str
    status: Literal["completed", "failed"]
    answer: str | None = None

class TripResponse(BaseModel):
    request_id: str
    thread_id: str
    status: str
    answer: str | None = None
    flight_results: str | None = None
    hotel_results: str | None = None
    itinerary: str | None = None
    errors: list[str] = Field(default_factory=list)

class HealthResponse(BaseModel):
    status: str
    timestamp: datetime