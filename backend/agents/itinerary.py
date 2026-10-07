from langchain_core.messages import HumanMessage, SystemMessage

import logging

from agents.structured import (
    ItineraryCard,
    dump_card,
    itinerary_card_from,
    parse_model,
)
from llm.client import get_itinerary_llm
from llm.utils import compact, invoke, text

log = logging.getLogger(__name__)

MAX_SECTION_CHARS = 3000
MAX_OUTPUT_TOKENS = 5000


def _messages(state: dict) -> list:
    bounded = {
        key: compact(state.get(key), MAX_SECTION_CHARS)
        for key in ("flight_results", "hotel_results", "weather_results", "budget_analysis")
    }
    return [
        SystemMessage(
            content=(
                "Create a practical day-by-day itinerary. Return ONLY valid JSON "
                "matching ItineraryCard: headline, summary, metric, metric_label, "
                "highlights, and days. Every day must have day, title, summary, "
                "and stops; every stop must have time, title, detail, place. "
                "Use only the supplied evidence and do not invent bookings."
            )
        ),
        HumanMessage(
            content=(
                f"Request: {state.get('user_query', '')}\n"
                f"Constraints: {state.get('trip_constraints', {})}\n"
                f"Flight research: {bounded['flight_results']}\n"
                f"Hotel research: {bounded['hotel_results']}\n"
                f"Weather research: {bounded['weather_results']}\n"
                f"Budget: {bounded['budget_analysis']}\n"
                f"Preferences: {state.get('user_preferences', {})}"
            )
        ),
    ]


async def itinerary_agent(state: dict) -> dict:
    _ = state["user_query"]
    try:
        for attempt, max_tokens in enumerate((MAX_OUTPUT_TOKENS, MAX_OUTPUT_TOKENS * 2), 1):
            response = await invoke(
                get_itinerary_llm().bind(max_tokens=max_tokens, temperature=0),
                _messages(state), name="itinerary_agent", timeout=60,
            )
            raw = text(response.content)
            metadata = getattr(response, "response_metadata", None) or {}
            log.info("itinerary_agent finish_reason=%s attempt=%d chars=%d usage=%s",
                     metadata.get("finish_reason"), attempt, len(raw),
                     getattr(response, "usage_metadata", None))
            card = parse_model(ItineraryCard, raw)
            if card is not None and metadata.get("finish_reason") != "length":
                return {"itinerary": dump_card(card)}
        raise ValueError("itinerary output was invalid or truncated")
    except (KeyError, TypeError):
        raise
    except Exception as exc:
        log.exception("itinerary_agent failed")
        return {"itinerary": dump_card(itinerary_card_from("")),
                "errors": [f"itinerary_agent: {type(exc).__name__}"]}
