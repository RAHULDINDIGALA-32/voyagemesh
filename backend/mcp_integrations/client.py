from __future__ import annotations

import os
import sys
from functools import lru_cache
from pathlib import Path
from urllib.parse import urlencode

from langchain_mcp_adapters.client import MultiServerMCPClient

from config import get_settings

WEATHER_SERVER_PATH = Path(__file__).with_name("weather_server.py")


def _subprocess_environment(**updates: str) -> dict[str, str]:
    """Pass only required secrets to local MCP child processes."""
    environment = os.environ.copy()
    environment.update({key: value for key, value in updates.items() if value})
    return environment


@lru_cache
def get_mcp_client() -> MultiServerMCPClient:
    settings = get_settings()
    tavily_url = settings.tavily_mcp_url.rstrip("/") + "/"
    tavily_url += "?" + urlencode({"tavilyApiKey": settings.tavily_key})

    return MultiServerMCPClient(
        {
            "aviationstack": {
                "transport": "stdio",
                "command": settings.aviationstack_mcp_command,
                "args": [settings.aviationstack_mcp_package],
                "env": _subprocess_environment(
                    AVIATION_STACK_API_KEY=settings.aviationstack_key,
                ),
            },
            "tavily": {
                "transport": "streamable_http",
                "url": tavily_url,
            },
            "weather": {
                "transport": "stdio",
                "command": sys.executable,
                "args": [str(WEATHER_SERVER_PATH)],
                "env": _subprocess_environment(
                    OPENWEATHER_API_KEY=settings.openweather_key,
                ),
            },
        }
    )


async def get_server_tools(server_name: str):
    """Load tools for just one server, isolating unrelated provider failures."""
    settings = get_settings()
    required_secrets = {
        "aviationstack": ("AVIATIONSTACK_API_KEY", settings.aviationstack_key),
        "tavily": ("TAVILY_API_KEY", settings.tavily_key),
        "weather": ("OPENWEATHER_API_KEY", settings.openweather_key),
    }
    secret_name, secret = required_secrets[server_name]
    if not secret:
        raise RuntimeError(
            f"{secret_name} must be configured for the {server_name} MCP server"
        )

    return await get_mcp_client().get_tools(server_name=server_name)
