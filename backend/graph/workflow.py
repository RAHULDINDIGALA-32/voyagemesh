
from typing import Literal

from langgraph.graph import END, START, StateGraph

from graph.state import TravelState
from graph.nodes import (
    input_guardrail,
    blocked_response,
    constraint_gate,
    human_interaction,
    apply_human_response,
    budget_decision_gate,
    final_review_gate,
    flight_agent,
    hotel_agent,
    weather_agent,
    budget_agent,
    itinerary_agent,
    final_agent,
    supervisor_agent,
    output_guardrail,
)


NextNode = Literal[
    "supervisor_agent",
    "blocked_response",
    "flight_agent",
    "hotel_agent",
    "weather_agent",
    "budget_agent",
    "itinerary_agent",
    "final_agent",
    "output_guardrail",
    "constraint_gate",
    "human_interaction",
    "apply_human_response",
    "budget_decision_gate",
    "final_review_gate",
]

SPECIALIST_ORDER: tuple[NextNode, ...] = (
    "flight_agent",
    "hotel_agent",
    "weather_agent",
    "budget_agent",
    "itinerary_agent",
)


def select_next_agent(state: TravelState) -> NextNode:
    """Dispatch the next pending supervisor-selected specialist.

    The server owns permitted node names and their dependency-safe order; the
    model can select work, but it cannot direct execution to an arbitrary node.
    """
    rerun_agents = state.get("rerun_agents", [])
    if rerun_agents:
        return rerun_agents[0]  # type: ignore[return-value]
    completed = set(state.get("completed_agents", []))
    selected = set(state.get("selected_agents", []))
    for agent_name in SPECIALIST_ORDER:
        if agent_name in selected and agent_name not in completed:
            return agent_name
    return "final_agent"


def route_after_input_guardrail(state: TravelState) -> Literal[
    "supervisor_agent", "blocked_response"
]:
    return "blocked_response" if state.get("request_blocked") else "supervisor_agent"


def route_after_constraints(state: TravelState) -> Literal["human_interaction", "flight_agent", "hotel_agent", "weather_agent", "budget_agent", "itinerary_agent", "final_agent"]:
    if state.get("human_intervention", {}).get("status") == "pending":
        return "human_interaction"
    return select_next_agent(state)  # type: ignore[return-value]


def route_after_budget(state: TravelState) -> Literal["human_interaction", "flight_agent", "hotel_agent", "weather_agent", "budget_agent", "itinerary_agent", "final_agent"]:
    if state.get("human_intervention", {}).get("status") == "pending":
        return "human_interaction"
    return select_next_agent(state)  # type: ignore[return-value]


def route_after_itinerary(state: TravelState) -> Literal["human_interaction", "final_agent", "itinerary_agent"]:
    if state.get("human_intervention", {}).get("status") == "pending":
        return "human_interaction"
    if state.get("rerun_agents"):
        return select_next_agent(state)  # type: ignore[return-value]
    return "final_agent"


def route_after_human_response(state: TravelState) -> Literal["flight_agent", "hotel_agent", "weather_agent", "budget_agent", "itinerary_agent", "final_agent"]:
    intervention = state.get("human_intervention", {})
    if intervention.get("type") == "itinerary_review" and state.get("human_response", {}).get("action") == "accept":
        return "final_agent"
    return select_next_agent(state)  # type: ignore[return-value]


def build_graph(checkpointer):
    builder = StateGraph(TravelState)

    builder.add_node("input_guardrail", input_guardrail)
    builder.add_node("blocked_response", blocked_response)
    builder.add_node("constraint_gate", constraint_gate)
    builder.add_node("human_interaction", human_interaction)
    builder.add_node("apply_human_response", apply_human_response)
    builder.add_node("budget_decision_gate", budget_decision_gate)
    builder.add_node("final_review_gate", final_review_gate)
    builder.add_node("supervisor_agent", supervisor_agent)
    builder.add_node("flight_agent", flight_agent)
    builder.add_node("hotel_agent", hotel_agent)
    builder.add_node("weather_agent", weather_agent)
    builder.add_node("budget_agent", budget_agent)
    builder.add_node("itinerary_agent", itinerary_agent)
    builder.add_node("final_agent", final_agent)
    builder.add_node("output_guardrail", output_guardrail)

    builder.add_edge(START, "input_guardrail")
    builder.add_conditional_edges("input_guardrail", route_after_input_guardrail)
    builder.add_edge("blocked_response", END)
    builder.add_edge("supervisor_agent", "constraint_gate")
    builder.add_conditional_edges("constraint_gate", route_after_constraints)
    builder.add_conditional_edges("flight_agent", select_next_agent)
    builder.add_conditional_edges("hotel_agent", select_next_agent)
    builder.add_conditional_edges("weather_agent", select_next_agent)
    builder.add_edge("budget_agent", "budget_decision_gate")
    builder.add_conditional_edges("budget_decision_gate", route_after_budget)
    builder.add_edge("itinerary_agent", "final_review_gate")
    builder.add_conditional_edges("final_review_gate", route_after_itinerary)
    builder.add_edge("human_interaction", "apply_human_response")
    builder.add_conditional_edges("apply_human_response", route_after_human_response)
    builder.add_edge("final_agent", "output_guardrail")
    builder.add_edge("output_guardrail", END)

    return builder.compile(
        checkpointer=checkpointer
    )
