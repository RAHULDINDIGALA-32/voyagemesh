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


GEO_URL = "https://api.openweathermap.org/geo/1.0/direct"
WEATHER_URL = "https://api.openweathermap.org/data/2.5/weather"
FORECAST_URL = "https://api.openweathermap.org/data/2.5/forecast"
API = "https://api.openweathermap.org/data/2.5"


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
    data = _get(WEATHER_URL, city)
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
    data = _get(FORECAST_URL, city)
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


def _geocode(place: str) -> tuple[float, float, str, str]:
    r = requests.get(
        GEO_URL,
        params={"q": place.strip(), "limit": 1, "appid": _api_key()},
        timeout=TIMEOUT_SECONDS,
    )
    r.raise_for_status()
    hits = r.json()
    if not hits:
        raise ValueError(
            f"Location {place!r} not found. Retry ONCE with 'City,CC' using the "
            "main city, e.g. 'Denpasar,ID' for Bali."
        )
    h = hits[0]
    return h["lat"], h["lon"], h["name"], h.get("country", "")


def _owm(path: str, lat: float, lon: float) -> dict[str, Any]:
    r = requests.get(
        f"{API}/{path}",
        params={"lat": lat, "lon": lon, "appid": _api_key(), "units": "metric"},
        timeout=TIMEOUT_SECONDS,
    )
    r.raise_for_status()
    return r.json()


@mcp.tool()
def get_weather_overview(city: str) -> dict[str, Any]:
    """Current weather plus daily high/low/rain-chance for the next ~5 days.
    Pass 'City,CC' with an ISO country code, e.g. 'Denpasar,ID'. For islands or
    regions use the main city. Cannot forecast beyond ~5 days from today."""
    lat, lon, name, country = _geocode(city)
    cur = _owm("weather", lat, lon)
    fc = _owm("forecast", lat, lon)

    days: dict[str, dict[str, list]] = {}
    for it in fc.get("list", []):
        d = days.setdefault(it["dt_txt"][:10], {"t": [], "p": [], "c": []})
        d["t"].append(it["main"]["temp"])
        d["p"].append(it.get("pop", 0))
        d["c"].append(it["weather"][0]["description"])

    daily = [
        {
            "date": date,
            "high_c": round(max(v["t"]), 1),
            "low_c": round(min(v["t"]), 1),
            "precip_chance_percent": round(100 * max(v["p"])),
            "condition": max(set(v["c"]), key=v["c"].count),
        }
        for date, v in days.items()
    ]

    return {
        "city": name,
        "country": country,
        "current": {
            "temperature_c": cur["main"]["temp"],
            "feels_like_c": cur["main"]["feels_like"],
            "humidity_percent": cur["main"]["humidity"],
            "condition": cur["weather"][0]["description"],
            "wind_kmh": round(cur["wind"]["speed"] * 3.6, 1),
        },
        "daily_forecast": daily,
        "note": "Free tier only forecasts ~5 days ahead. No UV data.",
    }


if __name__ == "__main__":
    mcp.run(transport="stdio")
