
from langgraph.graph import StateGraph, START, END

from backend.graph.state import TravelState
from backend.graph.nodes import (
    flight_agent,
    hotel_agent,
    itinerary_agent,
    final_agent,
)


def build_graph(checkpointer):
    builder = StateGraph(TravelState)

    builder.add_node("flight_agent", flight_agent)
    builder.add_node("hotel_agent", hotel_agent)
    builder.add_node("itinerary_agent", itinerary_agent)
    builder.add_node("final_agent", final_agent)

    builder.add_edge(START, "flight_agent")
    builder.add_edge("flight_agent", "hotel_agent")
    builder.add_edge("hotel_agent", "itinerary_agent")
    builder.add_edge("itinerary_agent", "final_agent")
    builder.add_edge("final_agent", END)

    return builder.compile(
        checkpointer=checkpointer
    )