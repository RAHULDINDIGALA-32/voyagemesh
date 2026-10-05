from agents.structured import dump_card, hotel_card_from
from mcp_integrations.agent_runner import run_mcp_agent

HOTEL_JSON = (
    "After using tools, return ONLY JSON with this shape: "
    '{"headline":"Stay in Gion","summary":"one or two sentences",'
    '"metric":"4 nights","metric_label":"recommended stay",'
    '"options":[{"name":"","area":"","nights":"","style":"","estimate_per_night":"",'
    '"why":"why this fits","source":"url if present"}],'
    '"notes":["availability is not confirmed"]}. '
    "Include at most 3 options. Search results are research only; never assert current "
    "availability, live prices, or bookings."
)


async def hotel_agent(state: dict) -> dict:
    try:
        results = await run_mcp_agent(
            server_name="tavily",
            system_prompt=(
                "You are VoyageMesh's hotel research agent. Use the Tavily search tool to find "
                "accommodation options and cite returned source URLs. Make ONE search call with "
                "max_results=3 and no raw page content, then answer. " + HOTEL_JSON
            ),
            request=f"""Find accommodation research for:
User Query:
{state["user_query"]}

Trip Constraints:
{state.get("trip_constraints") or "None provided"}
""",
            tool_names=("search",),
            max_rounds=2,
        )
        return {"hotel_results": dump_card(hotel_card_from(results))}
    except Exception as exc:
        print("error: ", exc)
        return {
            "hotel_results": dump_card(
                hotel_card_from("Hotel research is currently unavailable.")
            ),
            "errors": [f"hotel_mcp: {type(exc).__name__}"],
        }
