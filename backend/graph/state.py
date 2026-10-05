from operator import add
from typing import Annotated, TypedDict

class TravelState(TypedDict, total=False):
    # Request
    user_query: str
    request_id: str
    workflow_token_hash: str
    trip_constraints: dict[str, str]
    selected_agents: list[str]
    supervisor_reasoning: str
    completed_agents: Annotated[list[str], add]
    request_blocked: bool
    blocked_reason: str
    execution_status: str
    input_guardrail: dict[str, str | bool]
    output_validation: dict[str, str | bool]
    human_intervention: dict
    human_response: dict[str, str | dict[str, str]]
    hitl_version: int
    itinerary_version: int
    user_preferences: dict[str, str]
    rerun_agents: list[str]

    # Tool Ouputs
    flight_results: str
    hotel_results: str
    weather_results: str
    budget_analysis: str

    # LLM Outputs
    itinerary: str
    final_answer: str
    trip_document: dict

    # Operational Status
    errors: Annotated[list[str], add]
