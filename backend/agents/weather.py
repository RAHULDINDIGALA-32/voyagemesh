from agents.structured import dump_card, weather_card_from
from mcp_integrations.agent_runner import run_mcp_agent

WEATHER_JSON = (
    "After using tools, return ONLY JSON with this shape: "
    '{"headline":"April in Kyoto","summary":"practical weather in one or two sentences",'
    '"metric":"12–20°C","metric_label":"typical range",'
    '"packing_hints":["light layers","compact umbrella"]}. '
    "Give practical guidance only when supported by tool output."
)


async def weather_agent(state: dict) -> dict:
    """Collect destination weather through the custom local MCP server."""
    try:
        results = await run_mcp_agent(
            server_name="weather",
            system_prompt=(
                "You are VoyageMesh's weather agent. "
                "Your job is to resolve the user's destination and weather intent, "
                "call the appropriate Weather MCP tools, and get the weather results. "
                "Handle current weather and forecasts based on the requested time range. "
                "Do not guess weather data or locations. Keep responses concise and useful. "
                + WEATHER_JSON
            ),
            request=f"""
           User Query:
           {state["user_query"]}
           
           Trip Constraints:
           {state["trip_constraints"]}
           """,
        )
        return {"weather_results": dump_card(weather_card_from(results))}
    except Exception as exc:
        return {
            "weather_results": dump_card(
                weather_card_from("Weather research is currently unavailable.")
            ),
            "errors": [f"weather_mcp: {type(exc).__name__}"],
        }
