from backend.tools.flight import search_flights


def flight_agent(state: dict) -> dict:

    query = state["user_query"]
    flight_results = search_flights(query)

    return {
        "flight_results": flight_results
    }
