from agents.structured import FlightCard, dump_card, flight_card_from
from mcp_integrations.agent_runner import run_mcp_agent

import logging

log = logging.getLogger(__name__)

FLIGHT_JSON = (
    "Return the answer by calling the `json` tool with this shape: "
    '{"headline":"<ORIGIN> → <DEST>","summary":"one or two sentences",'
    '"metric":"Direct | 1 stop via XXX","metric_label":"routing",'
    '"options":[{"airline":"","flight_number":"","origin":"","destination":"",'
    '"departs":"","arrives":"","duration":"","cabin":"","estimate":"",'
    '"notes":""}],"notes":[]}. '
    'At most 3 options. Use "" for anything the tools did not return.'
)


async def flight_agent(state: dict) -> dict:
    try:
        flight_results = await run_mcp_agent(
            server_name="aviationstack",
            system_prompt=(
                "You are VoyageMesh's flight research agent.\n"
                "Tool: search_route_flights(origin_iata, destination_iata). It returns "
                "flights currently operating that route (real-time data only: no "
                "future dates, no fares).\n"
                "1. Work out 3-letter IATA codes from your own knowledge "
                "(e.g. Hyderabad=HYD, Bali=DPS). Never ask the user.\n"
                "2. Call the tool ONCE for origin -> destination.\n"
                "3. If it finds no direct flights, in ONE round make two calls: "
                "origin -> hub and hub -> destination, with a single hub "
                "(SIN or KUL for Southeast Asia; DXB or DOH for Europe and the "
                "Middle East). Do not try other variations.\n"
                "4. Report only what the tools returned: airlines, flight numbers, "
                "typical departure/arrival times. Say these are current schedules, "
                "not for the travel dates (say these are typical current schedules observed on <observed_on>, not confirmed for the travel dates), and that fares are unavailable. Leave "
                "`estimate` and `duration` empty.\n"
                "5. If tools fail, still call `json` with an honest summary.\n"
                + FLIGHT_JSON
            ),
            request=(
                f"User query: {state['user_query']}\n"
                f"Trip constraints: {state['trip_constraints']}"
            ),
            tool_names=("search_route_flights",),
            max_rounds=3,
            answer_schema=FlightCard,
        )
        return {"flight_results": dump_card(flight_card_from(flight_results))}
    except Exception as exc:
        log.exception("flight agent failed")
        return {
            "flight_results": dump_card(
                flight_card_from("Flight research is currently unavailable.")
            ),
            "errors": [f"flight_mcp: {type(exc).__name__}: {str(exc)[:200]}"],
        }
