from tools.tavily import tavily_search
from tools.flight import search_flights
from agent import run_travel_agent

#tavily_tool_test_response = tavily_search("What are the best hotels in South Munbai, India")
#print(tavily_tool_test_response)

#flight_tool_test_response = search_flights("Plan a 7 days trip to Japan from Hyderabad, India")
#print(flight_tool_test_response)

agent_pipeline_test_response = run_travel_agent("Plan a 7 days trip to Japan from Hyderabad, India")
print(agent_pipeline_test_response)