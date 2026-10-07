from datetime import date
from agents.structured import WeatherCard, dump_card, weather_card_from
from mcp_integrations.agent_runner import run_mcp_agent

WEATHER_JSON = (
    "{"
    '"headline": "Weather in Lisbon",'
    '"summary": "Mild and mostly dry; evenings turn cool.",'
    '"condition": "Partly cloudy",'
    '"season": "Spring",'
    '"temp_high": "22",'
    '"temp_low": "14",'
    '"temp_unit": "C",'
    '"feels_like": "21",'
    '"humidity": "62%",'
    '"wind": "14 km/h NW",'
    '"precip_chance": "20%",'
    '"uv_index": "6",'
    '"forecast": ['
    "{"
    '"date": "Mon 12",'
    '"condition": "Sunny",'
    '"high": "23",'
    '"low": "14",'
    '"precip_chance": "5%"'
    "}"
    "],"
    '"alerts": [],'
    '"packing_hints": ['
    '"Light jacket",'
    '"Sunscreen"'
    "]"
    "}"
)


SYSTEM_PROMPT = (
    "You are VoyageMesh's weather agent.\n"
    "1. Call `get_weather_overview` ONCE for the destination, passing 'City,CC' "
    "(for islands/regions use the main city, e.g. Bali -> 'Denpasar,ID'). "
    "If it errors, retry at most once with a corrected name.\n"
    "2. The tool only covers ~5 days from today. If the trip dates are later, "
    "do NOT invent daily forecasts: leave `forecast` as [], use the live "
    "reading as a baseline, and set `summary`, `season` and `packing_hints` "
    "from well-known typical climate for the travel month, wording the summary "
    "as 'Typically ...'.\n"
    '3. Only copy numbers that appear in tool output. Unknown scalar -> "", '
    "unknown list -> [].\n"
    "4. Finish by calling the `json` tool once. Never ask the user questions.\n"
    "The example below shows FORMAT ONLY; never reuse its values.\n" + WEATHER_JSON
)


async def weather_agent(state: dict) -> dict:
    tc = state.get("trip_constraints", {})
    try:
        results = await run_mcp_agent(
            server_name="weather",
            system_prompt=SYSTEM_PROMPT,
            request=(
                f"Today: {date.today().isoformat()}\n"
                f"Destination: {tc.get('destination', '')}\n"
                f"Travel dates: {tc.get('travel_dates', '')}\n"
                f"User query: {state['user_query']}"
            ),
            tool_names=("get_weather_overview",),
            answer_schema=WeatherCard,
        )
        card = weather_card_from(results)
        if not (card.condition or card.temp_high or card.forecast or card.summary):
            raise RuntimeError("empty weather card")
        return {"weather_results": dump_card(card)}
    except Exception as exc:
        return {
            "weather_results": dump_card(
                weather_card_from("Weather research is currently unavailable.")
            ),
            "errors": [f"weather_mcp: {type(exc).__name__}"],
        }
