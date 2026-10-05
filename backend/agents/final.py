from langchain_core.messages import HumanMessage, SystemMessage

from agents.structured import (
    FinalChart,
    assemble_trip_document,
    fallback_final,
    parse_model,
)
from llm.client import get_llm


def _result(chart: FinalChart, state: dict) -> dict:
    """Return the chat acknowledgement and canonical field-wise trip payload."""
    document = assemble_trip_document(state, chart)
    return {
        "final_answer": chart.chat_message,
        "trip_document": document,
        "trip_summary": document["trip_summary"],
        "flight_details": document["flights"],
        "hotel_details": document["hotels"],
        "weather_details": document["weather"],
        "budget_details": document["budget"],
        "itinerary_details": document["itinerary"],
        "packing_list": document["packing"],
        "timeline": document["timeline"],
    }


async def final_agent(state: dict) -> dict:
    try:
        response = await get_llm().ainvoke(
            [
                SystemMessage(
                    content=(
                        "You are VoyageMesh's final chart clerk. The trip document already "
                        "holds structured flights, hotels, budget, and itinerary. Your job is "
                        "the traveler-facing wrap: a SHORT chat message (2–3 sentences, no "
                        "markdown, no bullet lists, no dump of the itinerary), a longer trip "
                        "summary, a packing list, and a start-to-end timeline. "
                        "Do not fabricate prices, live availability, or bookings. "
                        "If this is a revision, say what changed. Return ONLY JSON: "
                        '{"chat_message":"short unique note that the voyage is on the trip page",'
                        '"trip_summary":"one dense paragraph",'
                        '"origin":"","destination":"","dates":"","travelers":"",'
                        '"packing":{"summary":"","items":[{"item":"","reason":"","category":"clothing|documents|electronics|health|general"}]},'
                        '"timeline":{"summary":"","events":[{"when":"","title":"","detail":"","kind":"origin|flight|hotel|activity|budget|return|destination"}]},'
                        '"assumptions":[]}.'
                    )
                ),
                HumanMessage(
                    content=f"""
User request:
{state['user_query']}

Constraints:
{state.get('trip_constraints', {})}

Flights:
{state.get('flight_results', '')}

Hotels:
{state.get('hotel_results', '')}

Weather:
{state.get('weather_results', '')}

Budget:
{state.get('budget_analysis', '')}

Itinerary:
{state.get('itinerary', '')}
"""
                ),
            ]
        )
        parsed = parse_model(FinalChart, response.content)
        chart = parsed if isinstance(parsed, FinalChart) else fallback_final(state)
        if not chart.chat_message.strip():
            chart = fallback_final(state)
        return _result(chart, state)
    except Exception as exc:
        chart = fallback_final(state)
        return {**_result(chart, state), "errors": [f"final_agent: {type(exc).__name__}"]}
