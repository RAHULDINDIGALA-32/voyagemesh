from typing import Annotated, TypedDict

RESET = "__reset__"


def append_or_reset(old: list | None, new: list | None) -> list:
    values = new or []
    if values and values[0] == RESET:
        return values[1:]
    return (old or []) + values


class TravelState(TypedDict, total=False):
    # Request
    user_query: str
    # Raw user turn used for input safety validation. Follow-up planning may
    # enrich user_query with internal voyage context, which must not count
    # toward the user-input length guardrail.
    guardrail_query: str
    request_id: str
    trip_constraints: dict[str, str]
    selected_agents: list[str]
    supervisor_reasoning: str
    completed_agents: Annotated[list[str], append_or_reset]
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
    trip_summary: str
    flight_details: dict
    hotel_details: dict
    weather_details: dict
    budget_details: dict
    itinerary_details: dict
    packing_list: dict
    timeline: dict

    # Operational Status
    errors: Annotated[list[str], append_or_reset]
    itinerary_attempts: int
    failure_reason: str
