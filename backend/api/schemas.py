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
    weather_results: str | None = None
    budget_analysis: str | None = None
    itinerary: str | None = None
    selected_agents: list[str] = Field(default_factory=list)
    trip_constraints: dict[str, str] = Field(default_factory=dict)
    input_guardrail: dict[str, str | bool] = Field(default_factory=dict)
    output_validation: dict[str, str | bool] = Field(default_factory=dict)
    human_intervention: dict = Field(default_factory=dict)
    workflow_token: str | None = Field(
        default=None,
        description="Store client-side only; required to resume a paused workflow.",
    )
    errors: list[str] = Field(default_factory=list)


class HumanResponseRequest(BaseModel):
    intervention_id: str = Field(pattern=r"^hitl_[a-f0-9]{32}$")
    expected_version: int = Field(ge=1)
    action: str = Field(min_length=1, max_length=40)
    data: dict[str, str] = Field(default_factory=dict)
    workflow_token: str = Field(min_length=32, max_length=256)

class HealthResponse(BaseModel):
    status: str
    timestamp: datetime
