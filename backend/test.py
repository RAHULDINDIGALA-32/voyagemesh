from tools.tavily import tavily_search
from tools.flight import search_flights

tavily_tool_test_response = tavily_search("What are the best hotels in South Munbai, India")
print(tavily_tool_test_response)

flight_tool_test_response = search_flights("Plan a 7 days trip to Japan from Hyderabad, India")
print(flight_tool_test_response)