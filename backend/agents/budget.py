from langchain_core.messages import HumanMessage, SystemMessage

from llm.client import get_llm


async def budget_agent(state: dict) -> dict:
    """Estimate a transparent budget from available evidence and constraints."""
    try:
        response = await get_llm().ainvoke(
            [
                SystemMessage(
                    content=(
                        "You are VoyageMesh's budget analyst. Produce a practical cost "
                        "analysis using only supplied research and explicit trip constraints. "
                        "Never present estimates as live prices or booking quotes. Clearly "
                        "separate sourced facts, estimates, exclusions, and missing inputs."
                    )
                ),
                HumanMessage(content=f"""
Travel request:
{state['user_query']}

Trip constraints:
{state.get('trip_constraints', {})}

Flight research:
{state.get('flight_results', '')}

Hotel research:
{state.get('hotel_results', '')}

Provide a budget range, major cost categories, savings suggestions, and assumptions.
"""),
            ]
        )
        return {"budget_analysis": str(response.content)}
    except Exception as exc:
        return {
            "budget_analysis": "Budget analysis is currently unavailable.",
            "errors": [f"budget_agent: {type(exc).__name__}"],
        }
