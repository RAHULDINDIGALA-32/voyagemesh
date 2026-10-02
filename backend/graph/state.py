from operator import add
from typing import Annotated, TypedDict

class TravelState(TypedDict, total=False):
    # Request
    user_query: str
    request_id: str

    # Tool Ouputs
    flight_results: str
    hotel_results: str
    weather_results: str

    # LLM Outputs
    itinerary: str
    final_answer: str

    # Operational Status
    errors: Annotated[list[str], add]
