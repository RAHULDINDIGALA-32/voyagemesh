import os

from tavily import TavilyClient
from dotenv import load_dotenv

load_dotenv()

tavily_api_key = os.getenv("TAVILY_API_KEY")

if not tavily_api_key:
    raise ValueError("Tavily API key is not set in env.")

tavily_client = TavilyClient(
    api_key=tavily_api_key
)

def tavily_search(query):
    response = tavily_client.search(
        query=query,
        max_results=5
    )

    results = []

    for index, res in enumerate(response["results"], 1):
        title = res.get("title", "Unknown")
        url = res.get("url", "")
        snippet = res.get("content", "").strip()
        # keep only first 300 chars to avoid wall-of-text
        if(len(snippet) > 300):
            snippet = snippet[:300].rsplit(" ", 1)[0] + "..."
        results.append(f"{index}. **{title}**\n  {url}\n  {snippet}")

    return "\n\n".join(results)