from agents.structured import dump_card, flight_card_from
from mcp_integrations.agent_runner import run_mcp_agent

FLIGHT_JSON = (
    "After using tools, return ONLY JSON with this shape: "
    '{"headline":"HYD → KIX","summary":"one or two sentences a traveler needs",'
    '"metric":"8h 40m","metric_label":"typical block time",'
    '"options":[{"airline":"","flight_number":"","origin":"","destination":"",'
    '"departs":"","arrives":"","duration":"","cabin":"","estimate":"",'
    '"notes":"not a live fare"}],"notes":["missing dates or airports if any"]}. '
    "Include at most 3 practical options. Never invent live fares or bookings. "
    "If tools fail, still return JSON with an honest summary."
)


async def flight_agent(state: dict) -> dict:
    try:
        flight_results = await run_mcp_agent(
            server_name="aviationstack",
            system_prompt=(
                "You are VoyageMesh's flight research agent. Use AviationStack MCP "
                "tools to research routes, schedules, and live flight status relevant "
                "to the request. Never claim ticket prices or booking availability: "
                "AviationStack does not provide fares. State when route/date details are missing. "
                + FLIGHT_JSON
            ),
            request=state["user_query"],
        )
        return {"flight_results": dump_card(flight_card_from(flight_results))}
    except Exception as exc:
        return {
            "flight_results": dump_card(flight_card_from("Flight research is currently unavailable.")),
            "errors": [f"flight_mcp: {type(exc).__name__}"],
        }
