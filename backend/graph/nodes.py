
from agents.flight import flight_agent as run_flight_agent
from agents.hotel import hotel_agent as run_hotel_agent
from agents.itinerary import itinerary_agent as run_itinerary
from agents.final import final_agent as run_final
from agents.weather import weather_agent as run_weather


async def flight_agent(state: dict) -> dict:
    return await run_flight_agent(state)


async def hotel_agent(state: dict) -> dict:
    return await run_hotel_agent(state)


async def weather_agent(state: dict) -> dict:
    return await run_weather(state)


async def itinerary_agent(state: dict) -> dict:
    return await run_itinerary(state)


async def final_agent(state: dict) -> dict:
    return await run_final(state)
