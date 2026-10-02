from __future__ import annotations

import os
from typing import Any

import requests
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("VoyageMesh Weather")
TIMEOUT_SECONDS = 20


def _api_key() -> str:
    key = os.environ.get("OPENWEATHER_API_KEY", "").strip()
    if not key:
        raise RuntimeError("OPENWEATHER_API_KEY is not configured")
    return key


def _get(url: str, city: str) -> dict[str, Any]:
    response = requests.get(
        url,
        params={"q": city.strip(), "appid": _api_key(), "units": "metric"},
        timeout=TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    data = response.json()
    if not isinstance(data, dict):
        raise RuntimeError("OpenWeather returned an invalid response")
    return data


@mcp.tool()
def get_current_weather(city: str) -> dict[str, Any]:
    """Get current metric weather conditions for a city."""
    if not city.strip():
        raise ValueError("city cannot be empty")
    data = _get("https://api.openweathermap.org/data/2.5/weather", city)
    return {
        "city": data["name"],
        "temperature_c": data["main"]["temp"],
        "feels_like_c": data["main"]["feels_like"],
        "humidity_percent": data["main"]["humidity"],
        "condition": data["weather"][0]["description"],
        "wind_speed_mps": data["wind"]["speed"],
    }


@mcp.tool()
def get_forecast(city: str) -> dict[str, Any]:
    """Get the next five three-hour metric forecast observations for a city."""
    if not city.strip():
        raise ValueError("city cannot be empty")
    data = _get("https://api.openweathermap.org/data/2.5/forecast", city)
    return {
        "city": data.get("city", {}).get("name", city),
        "forecast": [
            {
                "datetime": item["dt_txt"],
                "temperature_c": item["main"]["temp"],
                "condition": item["weather"][0]["description"],
            }
            for item in data.get("list", [])[:5]
        ],
    }


if __name__ == "__main__":
    mcp.run(transport="stdio")
