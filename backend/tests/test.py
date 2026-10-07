# from tools.tavily import tavily_search
# from tools.flight import search_flights
# from backend.system_iter_01.agentic_system import run_travel_agent
# from agents.flight import flight_agent
from agents.hotel import hotel_agent
from agents.weather import weather_agent
from agents.itinerary import itinerary_agent

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
    "user_query": "plan a complete trip from Hyderabad to Bali, Indonesia from 12 November to 20 November 2026",
    "flight_results": '{"headline":"HYD to BALI","summary":"Indicative INR 55,000-80,000 return"}',
    "hotel_results": '{"headline":"Stay in Bali","summary":"A mix of beachfront luxury and boutique charm across Seminyak, Uluwatu, and Nusa Dua fits a solo traveler with a 3\u202fLakh INR budget for an 8‑night stay.","metric":"8 nights","metric_label":"recommended stay","options":[{"name":"The Legian Bali","area":"Seminyak","nights":"3","style":"Luxury beachfront resort","estimate_per_night":"₹30,000","why":"Prime beach location, excellent dining, and a serene pool area ideal for a solo traveler seeking comfort and easy access to Seminyak’s cafés and shops.","source":""},{"name":"Alila Villas Uluwatu","area":"Uluwatu","nights":"3","style":"Cliff‑side boutique resort","estimate_per_night":"₹35,000","why":"Spectacular ocean views, private plunge pools, and a tranquil atmosphere perfect for relaxation and sunset experiences.","source":""},{"name":"Mulia Resort","area":"Nusa Dua","nights":"2","style":"Family‑friendly upscale resort","estimate_per_night":"₹25,000","why":"Located on a calm beach with extensive amenities, good value for the remaining budget, and easy access to cultural sites like Uluwatu Temple.","source":""}],"notes":["Availability and exact pricing are not confirmed; check each property directly for up‑to‑date rates.","No source URLs could be retrieved due to tool limitations."]}',
    "budget_analysis": '{"headline":"Trip ledger","estimated_total":"INR 150000-200000"}',
    "itinerary": '{"headline":"Itinerary","summary":"{ \\"headline\\": \\"Hyderabad to Bali: 9‑day adventure\\", \\"summary\\": \\"A solo traveler journeys from Hyderabad to Bali for nine days, staying in a mix of beachfront luxury and boutique resorts across Seminyak, Uluwatu, and Nusa Dua. The itinerary balances cultural sights, beach time, and relaxation while staying within the INR 150‑200k budget range.\\", \\"metric\\": \\"9 days\\", \\"metriclabel\\": \\"on the ground\\", \\"highlights\\": [ \\"Seminyak Beach\\", \\"Uluwatu Temple\\", \\"Nusa Dua\\" ], \\"assumptions\\": [ \\"Exact flight numbers, departure time…","metric":"","metric_label":"days","days":[],"highlights":[]}',
    "weather_results": '{"headline":"November in Bali, Indonesia","summary":"Warm and humid with overcast skies; temperatures around 23\u202f°C.","metric":"23\u202f°C","metric_label":"average temperature","packing_hints":["light clothing","umbrella or raincoat"]}',
    "trip_constraints": {
        "destination": "Bali, Indonesia",
        "origin": "Hyderabad, India",
        "travel_dates": "from 12 November to 20 November 2026",
        "traveler_count": 1,
        "budget": "3Lakhss rupees",
    },
}

result = asyncio.run(weather_agent(state))
print(result)
