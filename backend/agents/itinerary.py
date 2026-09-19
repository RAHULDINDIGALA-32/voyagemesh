
from langchain_core.messages import (
    SystemMessage,
    HumanMessage,
)

from backend.llm.client import get_llm


def itinerary_agent(state: dict) -> dict:
    llm = get_llm()

    response = llm.invoke([
        SystemMessage(
            content=(
                "You are a practical travel itinerary planner. "
                "Use only supported information from the "
                "provided travel data. Clearly label assumptions "
                "and unknown information. Do not invent flight "
                "availability, hotel prices, or bookings."
            )
        ),
        HumanMessage(
            content=f"""
Create a practical travel itinerary.

User request:
{state['user_query']}

Flight information:
{state.get('flight_results', '')}

Hotel research:
{state.get('hotel_results', '')}

Include:
- A day-by-day plan
- Practical travel logistics
- Budget considerations
- Missing information and assumptions
"""
        ),
    ])

    return {
        "itinerary": response.content,
    }