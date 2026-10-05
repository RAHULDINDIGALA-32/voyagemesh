# from tools.tavily import tavily_search
# from tools.flight import search_flights
# from backend.system_iter_01.agentic_system import run_travel_agent
# from agents.flight import flight_agent
# from agents.hotel import hotel_agent
# from agents.budget import budget_agent
from agents.final import final_agent
import asyncio
import logging

logging.basicConfig(level=logging.INFO)

# tavily_tool_test_response = tavily_search("What are the best hotels in South Munbai, India")
# print(tavily_tool_test_response)

# flight_tool_test_response = search_flights("Plan a 7 days trip to Japan from Hyderabad, India")
# print(flight_tool_test_response)

# agent_pipeline_test_response = run_travel_agent(
#   "Plan a 7 days trip to Japan from Hyderabad, India"
# )
# print(agent_pipeline_test_response)

state = {
    "user_query": "Plan a 7 days trip to Japan from Hyderabad, India",
    "flight_results": '{"headline":"HYD to TYO","summary":"Indicative INR 55,000-80,000 return"}',
    "hotel_results": '{"headline":"Stay in Tokyo","options":[{"name":"Business hotel"}]}',
    "budget_analysis": '{"headline":"Trip ledger","estimated_total":"INR 150000-200000"}',
    "itinerary": "Day 1: Arrive Tokyo...\nDay 7: Return to Hyderabad",
    "weather_results": "Weather research is currently unavailable.",
    "trip_constraints": {
        "destination": "Japan",
        "origin": "Hyderabad, India",
        "travel_dates": "from 10 october to 17 october",
        "traveler_count": 1,
        "budget": "3Lakhss rupees",
    },
}

result = asyncio.run(final_agent(state))
print(result)
