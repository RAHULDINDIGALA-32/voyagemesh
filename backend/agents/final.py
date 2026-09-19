
from langchain_core.messages import (
    SystemMessage,
    HumanMessage,
)

from backend.llm.client import get_llm


def final_agent(state: dict) -> dict:
    llm = get_llm()

    response = llm.invoke([
        SystemMessage(
            content=(
                "You are a professional AI travel planning "
                "assistant. Produce a clear, useful response. "
                "Do not fabricate prices, live availability, "
                "bookings, or missing travel details."
            )
        ),
        HumanMessage(
            content=f"""
Prepare the final response.

User request:
{state['user_query']}

Flights:
{state.get('flight_results', '')}

Hotels:
{state.get('hotel_results', '')}

Itinerary:
{state.get('itinerary', '')}

Use these sections:
1. Trip Summary
2. Flight Information
3. Hotel Suggestions
4. Day-by-Day Itinerary
5. Estimated Budget
6. Important Assumptions and Recommendations

Clearly distinguish sourced information from estimates.
"""
        ),
    ])

    return {
        "final_answer": response.content,
    }