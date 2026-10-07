
from agents.flight import flight_agent as run_flight_agent
from datetime import UTC, datetime
from agents.hotel import hotel_agent as run_hotel_agent
from agents.itinerary import itinerary_agent as run_itinerary
from agents.final import final_agent as run_final
from agents.weather import weather_agent as run_weather
from agents.budget import budget_agent as run_budget
from agents.supervisor import supervisor_agent as run_supervisor
from guardrails.input import validate_input
from guardrails.output import validate_output
from agents.structured import (
    itinerary_card_from,
    itinerary_preview,
    itinerary_is_valid,
    weather_card_from,
)
from hitl.contracts import (
    budget_conflict,
    create_intervention,
    missing_constraints,
    normalize_constraints,
)
from langgraph.types import interrupt


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


async def constraint_gate(state: dict) -> dict:
    """Pause only if selected work lacks deterministic required constraints."""
    constraints = normalize_constraints(state.get("trip_constraints", {}))
    required_fields = missing_constraints({**state, "trip_constraints": constraints})
    if not required_fields:
        return {"trip_constraints": constraints}
    version = state.get("hitl_version", 0) + 1
    return {
        "trip_constraints": constraints,
        "hitl_version": version,
        "human_intervention": create_intervention(
            "constraint_clarification",
            version=version,
            required_fields=required_fields,
            allowed_actions=["submit"],
            context={"next_step": "travel research"},
        ),
        "execution_status": "awaiting_human",
    }


async def human_interaction(state: dict) -> dict:
    """Durably interrupt the graph; the API validates the resume payload."""
    response = interrupt({"intervention": state["human_intervention"]})
    return {"human_response": response}


async def apply_human_response(state: dict) -> dict:
    """Apply an already validated, sanitized human response deterministically."""
    intervention = state["human_intervention"]
    response = state["human_response"]
    action = response["action"]
    data = response.get("data", {})
    resolved = {
        **intervention,
        "status": "resolved",
        "resolved_at": datetime.now(UTC).isoformat(),
    }
    update: dict = {
        "human_intervention": resolved,
        "execution_status": "running",
    }

    if intervention["type"] == "constraint_clarification":
        update["trip_constraints"] = {
            **normalize_constraints(state.get("trip_constraints", {})),
            **normalize_constraints(data),
        }
    elif intervention["type"] == "budget_decision":
        if action == "increase_budget":
            update["trip_constraints"] = {
                **state.get("trip_constraints", {}), "budget": data["budget"]
            }
        elif action == "reduce_cost":
            selected = set(state.get("selected_agents", []))
            rerun = [agent for agent in ("flight_agent", "hotel_agent") if agent in selected]
            update["rerun_agents"] = [*rerun, "budget_agent"]
    elif intervention["type"] == "itinerary_review" and action in {"modify", "regenerate"}:
        if action == "modify":
            update["user_preferences"] = {
                **state.get("user_preferences", {}), **data
            }
        update["rerun_agents"] = ["itinerary_agent"]
    return update


async def budget_decision_gate(state: dict) -> dict:
    conflict = budget_conflict(state)
    if conflict is None:
        return {}
    version = state.get("hitl_version", 0) + 1
    return {
        "hitl_version": version,
        "human_intervention": create_intervention(
            "budget_decision",
            version=version,
            allowed_actions=["reduce_cost", "increase_budget", "continue"],
            context=conflict,
        ),
        "execution_status": "awaiting_human",
    }


async def final_review_gate(state: dict) -> dict:
    """Request user review for a usable itinerary before final synthesis."""
    itinerary = state.get("itinerary", "").strip()
    card = itinerary_card_from(itinerary)
    if not itinerary_is_valid(card, state.get("trip_constraints", {})):
        attempts = state.get("itinerary_attempts", 0)
        if attempts < 2:
            return {
                "rerun_agents": ["itinerary_agent"],
                "itinerary_attempts": attempts + 1,
                "errors": ["itinerary: invalid_output"],
                "execution_status": "running",
            }
        return {
            "execution_status": "failed",
            "failure_reason": "itinerary_invalid",
            "errors": ["itinerary: exhausted_retries"],
        }
    version = state.get("hitl_version", 0) + 1
    itinerary_version = state.get("itinerary_version", 0) + 1
    weather = weather_card_from(state.get("weather_results", ""))
    context = {
        "destination": state.get("trip_constraints", {}).get("destination", ""),
        "travel_dates": state.get("trip_constraints", {}).get("travel_dates", ""),
        "budget_analysis": state.get("budget_analysis", "")[:1_500],
        "weather_preview": " · ".join(
            part for part in (weather.headline, weather.metric, weather.summary) if part
        )[:500],
        "itinerary_preview": itinerary_preview(itinerary),
        "itinerary_summary": card.summary[:400],
        "itinerary_days": [
            {
                "day": day.day,
                "title": day.title,
                "summary": day.summary[:240],
                "stops": [stop.title for stop in day.stops[:5]],
            }
            for day in card.days[:14]
        ],
    }
    return {
        "hitl_version": version,
        "itinerary_version": itinerary_version,
        "human_intervention": create_intervention(
            "itinerary_review",
            version=version,
            allowed_actions=["accept", "modify", "regenerate"],
            context=context,
            itinerary_version=itinerary_version,
        ),
        "execution_status": "awaiting_human",
    }


def _complete(node_name: str, update: dict, state: dict) -> dict:
    """Record finished specialists for supervisor-driven dynamic routing."""
    result = {**update, "completed_agents": [node_name]}
    rerun_agents = state.get("rerun_agents", [])
    if node_name in rerun_agents:
        result["rerun_agents"] = [agent for agent in rerun_agents if agent != node_name]
    return result


async def supervisor_agent(state: dict) -> dict:
    return await run_supervisor(state)


async def flight_agent(state: dict) -> dict:
    return _complete("flight_agent", await run_flight_agent(state), state)


async def hotel_agent(state: dict) -> dict:
    return _complete("hotel_agent", await run_hotel_agent(state), state)


async def weather_agent(state: dict) -> dict:
    return _complete("weather_agent", await run_weather(state), state)


async def budget_agent(state: dict) -> dict:
    return _complete("budget_agent", await run_budget(state), state)


async def itinerary_agent(state: dict) -> dict:
    return _complete("itinerary_agent", await run_itinerary(state), state)


async def final_agent(state: dict) -> dict:
    return await run_final(state)


async def output_guardrail(state: dict) -> dict:
    decision = await validate_output(
        query=state["user_query"],
        answer=state.get("final_answer", ""),
    )
    update = {"output_validation": decision.as_state(), "execution_status": "completed"}
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
