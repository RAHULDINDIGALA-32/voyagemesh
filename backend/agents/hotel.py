
from tools.tavily import TavilySearchClient


def hotel_agent(state: dict) -> dict:
    query = (
        f"Hotels and accommodation options for "
        f"{state['user_query']}"
    )

    client = TavilySearchClient()
    results = client.search(query)

    return {
        "hotel_results": results,
    }