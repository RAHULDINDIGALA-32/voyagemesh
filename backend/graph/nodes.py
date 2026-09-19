
from backend.agents.flight import flight_agent as run_flight_agent
from backend.agents.hotel import hotel_agent as run_hotel_agent
from backend.agents.itinerary import itinerary_agent as run_itinerary
from backend.agents.final import final_agent as run_final


def flight_agent(state: dict) -> dict:
    return run_flight_agent(state)


def hotel_agent(state: dict) -> dict:
    return run_hotel_agent(state)


def itinerary_agent(state: dict) -> dict:
    return run_itinerary(state)


def final_agent(state: dict) -> dict:
    return run_final(state)