
from tavily import TavilyClient

from config import get_settings


class TavilySearchClient:
    def __init__(self):
        settings = get_settings()

        self.client = TavilyClient(
            api_key=settings.tavily_key
        )

    def search(self, query: str) -> str:
        response = self.client.search(
            query=query,
            max_results=5,
        )

        results = []

        for item in response.get("results", []):
            title = item.get("title", "Unknown")
            url = item.get("url", "")
            content = item.get("content", "").strip()

            if len(content) > 300:
                content = content[:300].rsplit(" ", 1)[0] + "..."

            results.append(
                f"Title: {title}\n"
                f"URL: {url}\n"
                f"Information: {content}"
            )

        if not results:
            return "No search results were found."

        return "\n\n".join(results)