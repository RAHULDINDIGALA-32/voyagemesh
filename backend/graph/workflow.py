
from typing import Literal

from langgraph.graph import END, START, StateGraph

from graph.state import TravelState
from graph.nodes import (
    flight_agent,
    hotel_agent,
    weather_agent,
    budget_agent,
    itinerary_agent,
    final_agent,
    supervisor_agent,
)


NextNode = Literal[
    "flight_agent",
    "hotel_agent",
    "weather_agent",
    "budget_agent",
    "itinerary_agent",
    "final_agent",
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
    completed = set(state.get("completed_agents", []))
    selected = set(state.get("selected_agents", []))
    for agent_name in SPECIALIST_ORDER:
        if agent_name in selected and agent_name not in completed:
            return agent_name
    return "final_agent"


def build_graph(checkpointer):
    builder = StateGraph(TravelState)

    builder.add_node("supervisor_agent", supervisor_agent)
    builder.add_node("flight_agent", flight_agent)
    builder.add_node("hotel_agent", hotel_agent)
    builder.add_node("weather_agent", weather_agent)
    builder.add_node("budget_agent", budget_agent)
    builder.add_node("itinerary_agent", itinerary_agent)
    builder.add_node("final_agent", final_agent)

    builder.add_edge(START, "supervisor_agent")
    builder.add_conditional_edges("supervisor_agent", select_next_agent)
    for specialist in SPECIALIST_ORDER:
        builder.add_conditional_edges(specialist, select_next_agent)
    builder.add_edge("final_agent", END)

    return builder.compile(
        checkpointer=checkpointer
    )
