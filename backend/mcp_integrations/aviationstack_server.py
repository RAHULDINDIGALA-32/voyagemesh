from __future__ import annotations

import hashlib
import json
import os
import tempfile
import time
from pathlib import Path
from typing import Any

import requests
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("VoyageMesh Flights")

TIMEOUT_SECONDS = 20
CACHE_TTL_SECONDS = 6 * 3600
CACHE_FILE = Path(tempfile.gettempdir()) / "voyagemesh_aviationstack_cache.json"
# Some free keys refuse HTTPS (error `https_access_restricted`), so fall back.
BASES = ("https://api.aviationstack.com/v1", "http://api.aviationstack.com/v1")


def _api_key() -> str:
    key = (
        os.environ.get("AVIATIONSTACK_API_KEY")
        or os.environ.get("AVIATION_STACK_API_KEY")
        or ""
    ).strip()
    if not key:
        raise RuntimeError("AVIATIONSTACK_API_KEY is not configured")
    return key


def _load_cache() -> dict[str, Any]:
    try:
        return json.loads(CACHE_FILE.read_text())
    except Exception:
        return {}


def _get(endpoint: str, params: dict[str, Any]) -> dict[str, Any]:
    cache_key = hashlib.sha1(
        json.dumps([endpoint, params], sort_keys=True).encode()
    ).hexdigest()
    cache = _load_cache()
    hit = cache.get(cache_key)
    if hit and time.time() - hit["at"] < CACHE_TTL_SECONDS:
        return hit["data"]

    last_error = "unknown error"
    for base in BASES:
        try:
            response = requests.get(
                f"{base}/{endpoint}",
                params={**params, "access_key": _api_key()},
                timeout=TIMEOUT_SECONDS,
            )
            data = response.json()
        except (requests.RequestException, ValueError) as exc:
            last_error = type(exc).__name__
            continue

        err = data.get("error") if isinstance(data, dict) else None
        if err:
            code = str(err.get("code") or err.get("type") or "")
            last_error = f"{code}: {err.get('message') or err.get('info') or ''}"
            if code == "https_access_restricted":
                continue
            # e.g. usage_limit_reached (100/month used up), function_access_restricted
            raise RuntimeError(f"AviationStack error {last_error}")

        cache[cache_key] = {"at": time.time(), "data": data}
        try:
            CACHE_FILE.write_text(json.dumps(cache))
        except OSError:
            pass
        return data

    raise RuntimeError(f"AviationStack request failed: {last_error}")


@mcp.tool()
def search_route_flights(
    origin_iata: str, destination_iata: str, limit: int = 8
) -> dict[str, Any]:
    """Find flights currently operating directly between two airports.

    Use 3-letter IATA codes, e.g. origin_iata='HYD', destination_iata='DPS'.
    Uses real-time data only: it cannot look up future dates and never
    returns fares. Costs one API request, so call it sparingly.
    """
    origin = origin_iata.strip().upper()
    dest = destination_iata.strip().upper()
    if not (
        len(origin) == 3 and len(dest) == 3 and origin.isalpha() and dest.isalpha()
    ):
        raise ValueError("origin_iata and destination_iata must be 3-letter IATA codes")

    data = _get("flights", {"dep_iata": origin, "arr_iata": dest, "limit": 100})

    seen: set[str] = set()
    flights: list[dict[str, Any]] = []
    for item in data.get("data", []) or []:
        flight = item.get("flight") or {}
        number = flight.get("iata")
        if not number or number in seen or flight.get("codeshared"):
            continue
        seen.add(number)
        dep = item.get("departure") or {}
        arr = item.get("arrival") or {}
        flights.append(
            {
                "airline": (item.get("airline") or {}).get("name"),
                "flight_number": number,
                "from": dep.get("iata"),
                "to": arr.get("iata"),
                "departs_local": (dep.get("scheduled") or "")[11:16],
                "arrives_local": (arr.get("scheduled") or "")[11:16],
                "observed_on": item.get("flight_date"),
            }
        )
        if len(flights) >= max(1, min(limit, 15)):
            break

    return {
        "origin": origin,
        "destination": dest,
        "direct_flights_found": len(flights),
        "flights": flights,
        "note": (
            "Times are scheduled local times from recent operations, not for the "
            "traveller's dates. No fares available."
            if flights
            else "No direct flights found on this route; it likely needs a connection."
        ),
    }


if __name__ == "__main__":
    mcp.run(transport="stdio")
