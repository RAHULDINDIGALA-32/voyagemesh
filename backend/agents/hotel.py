
from mcp_integrations.agent_runner import run_mcp_agent


async def hotel_agent(state: dict) -> dict:
    try:
        results = await run_mcp_agent(
            server_name="tavily",
            system_prompt=(
                "You are VoyageMesh's hotel research agent. Use Tavily MCP search to find "
                "accommodation options and cite returned source URLs. Search results are "
                "research only; never assert current availability, prices, or bookings."
            ),
            request=f"Find accommodation research for: {state['user_query']}",
        )
        return {"hotel_results": results}
    except Exception as exc:
        return {"hotel_results": "Hotel research is currently unavailable.", "errors": [f"hotel_mcp: {type(exc).__name__}"]}
