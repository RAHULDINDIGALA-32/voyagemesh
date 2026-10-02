from mcp_integrations.agent_runner import run_mcp_agent


async def weather_agent(state: dict) -> dict:
    """Collect destination weather through the custom local MCP server."""
    try:
        results = await run_mcp_agent(
            server_name="weather",
            system_prompt=(
                "You are VoyageMesh's weather agent. Determine the destination from the "
                "request and use Weather MCP tools for current conditions and/or forecast. "
                "Give practical guidance only when supported by tool output."
            ),
            request=state["user_query"],
        )
        return {"weather_results": results}
    except Exception as exc:
        return {
            "weather_results": "Weather research is currently unavailable.",
            "errors": [f"weather_mcp: {type(exc).__name__}"],
        }
