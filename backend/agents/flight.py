from mcp_integrations.agent_runner import run_mcp_agent


async def flight_agent(state: dict) -> dict:
    try:
        flight_results = await run_mcp_agent(
            server_name="aviationstack",
            system_prompt=(
                "You are VoyageMesh's flight research agent. Use AviationStack MCP "
                "tools to research routes, schedules, and live flight status relevant "
                "to the request. Never claim ticket prices or booking availability: "
                "AviationStack does not provide fares. State when route/date details are missing."
            ),
            request=state["user_query"],
        )
        return {"flight_results": flight_results}
    except Exception as exc:
        return {"flight_results": "Flight research is currently unavailable.", "errors": [f"flight_mcp: {type(exc).__name__}"]}
