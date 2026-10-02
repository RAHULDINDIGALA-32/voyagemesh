from operator import add
from typing import Annotated, TypedDict

class TravelState(TypedDict, total=False):
    # Request
    user_query: str
    request_id: str
    trip_constraints: dict[str, str]
    selected_agents: list[str]
    supervisor_reasoning: str
    completed_agents: Annotated[list[str], add]

    # Tool Ouputs
    flight_results: str
    hotel_results: str
    weather_results: str
    budget_analysis: str

    # LLM Outputs
    itinerary: str
    final_answer: str

    # Operational Status
    errors: Annotated[list[str], add]
