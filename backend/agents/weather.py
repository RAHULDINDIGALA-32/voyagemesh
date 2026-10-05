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
                "You are VoyageMesh's weather agent. Determine the destination from the "
                "request and use Weather MCP tools for current conditions and/or forecast. "
                + WEATHER_JSON
            ),
            request=state["user_query"],
        )
        return {"weather_results": dump_card(weather_card_from(results))}
    except Exception as exc:
        return {
            "weather_results": dump_card(weather_card_from("Weather research is currently unavailable.")),
            "errors": [f"weather_mcp: {type(exc).__name__}"],
        }
