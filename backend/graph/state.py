from typing import TypedDict

class TravelState(TypedDict, total=False):
    # Request
    user_query: str
    request_id: str

    # Tool Ouputs
    flight_results: str
    hotel_results: str

    # LLM Outputs
    itinerary: str
    final_answer: str

    # Operational Status
    errors: list[str]