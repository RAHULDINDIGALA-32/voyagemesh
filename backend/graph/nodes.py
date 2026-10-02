
from agents.flight import flight_agent as run_flight_agent
from agents.hotel import hotel_agent as run_hotel_agent
from agents.itinerary import itinerary_agent as run_itinerary
from agents.final import final_agent as run_final
from agents.weather import weather_agent as run_weather
from agents.budget import budget_agent as run_budget
from agents.supervisor import supervisor_agent as run_supervisor
from guardrails.input import validate_input
from guardrails.output import validate_output


async def input_guardrail(state: dict) -> dict:
    decision = await validate_input(state["user_query"])
    update = {
        "input_guardrail": decision.as_state(),
        "request_blocked": not decision.allowed,
    }
    if not decision.allowed:
        update.update(
            {
                "blocked_reason": decision.reason,
                "execution_status": "blocked",
                "errors": [f"input_guardrail: {decision.category}"],
            }
        )
    return update


async def blocked_response(state: dict) -> dict:
    """Return a safe response without invoking tools or downstream agents."""
    return {
        "final_answer": (
            "I can't process that request. "
            f"{state.get('blocked_reason', 'Please provide a safe travel-related request.')}"
        ),
        "execution_status": "blocked",
    }


def _complete(node_name: str, update: dict) -> dict:
    """Record finished specialists for supervisor-driven dynamic routing."""
    return {**update, "completed_agents": [node_name]}


async def supervisor_agent(state: dict) -> dict:
    return await run_supervisor(state)


async def flight_agent(state: dict) -> dict:
    return _complete("flight_agent", await run_flight_agent(state))


async def hotel_agent(state: dict) -> dict:
    return _complete("hotel_agent", await run_hotel_agent(state))


async def weather_agent(state: dict) -> dict:
    return _complete("weather_agent", await run_weather(state))


async def budget_agent(state: dict) -> dict:
    return _complete("budget_agent", await run_budget(state))


async def itinerary_agent(state: dict) -> dict:
    return _complete("itinerary_agent", await run_itinerary(state))


async def final_agent(state: dict) -> dict:
    return await run_final(state)


async def output_guardrail(state: dict) -> dict:
    decision = await validate_output(
        query=state["user_query"],
        answer=state.get("final_answer", ""),
    )
    update = {"output_validation": decision.as_state()}
    if not decision.allowed:
        update.update(
            {
                "final_answer": (
                    "I can't provide the generated travel response because it did not "
                    "pass our response safety checks. Please try again with a more "
                    "specific travel request."
                ),
                "execution_status": "blocked",
                "errors": [f"output_guardrail: {decision.category}"],
            }
        )
    return update
