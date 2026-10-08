from __future__ import annotations

import json
import re
from datetime import date
from typing import Any, Literal, get_origin

from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator


def content_to_text(content: object) -> str:
    if isinstance(content, str):
        return content
    return json.dumps(content)


def extract_json(content: object) -> Any | None:
    text = content_to_text(content).strip()
    if not text:
        return None
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.IGNORECASE).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}|\[[\s\S]*\]", text)
        if not match:
            return None
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            return None


def clip(text: str, limit: int = 420) -> str:
    """Make legacy/free-form agent fallback text safe for plain UI fields."""
    cleaned = re.sub(r"```[\s\S]*?```", "", text)
    cleaned = re.sub(r"!?(?:\[([^\]]+)\])\([^)]+\)", r"\1", cleaned)
    cleaned = re.sub(r"(?:^|\n)\s{0,3}(?:#{1,6}\s+|[-*+]\s+|\d+[.)]\s+)", " ", cleaned)
    cleaned = re.sub(r"[*_`~>#]", "", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    if len(cleaned) <= limit:
        return cleaned
    return cleaned[: limit - 1].rstrip() + "…"


class _Loose(BaseModel):
    """Tolerant base: numbers become strings, nulls dropped, "x" -> ["x"] for lists."""

    model_config = ConfigDict(coerce_numbers_to_str=True, extra="ignore")

    @model_validator(mode="before")
    @classmethod
    def _normalise(cls, data):
        if not isinstance(data, dict):
            return data
        out = {}
        for key, value in data.items():
            if value is None:
                continue
            field = cls.model_fields.get(key)
            if (
                field is not None
                and get_origin(field.annotation) is list
                and isinstance(value, str)
            ):
                value = [value] if value.strip() else []
            out[key] = value
        return out


class FlightOption(_Loose):
    airline: str = ""
    flight_number: str = ""
    origin: str = ""
    destination: str = ""
    departs: str = ""
    arrives: str = ""
    duration: str = ""
    cabin: str = ""
    estimate: str = ""
    notes: str = ""


class FlightCard(_Loose):
    headline: str = "Flights"
    summary: str = ""
    metric: str = ""
    metric_label: str = "route"
    options: list[FlightOption] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)


class HotelOption(_Loose):
    name: str = ""
    area: str = ""
    nights: str = ""
    style: str = ""
    estimate_per_night: str = ""
    why: str = ""
    source: str = ""


class HotelCard(_Loose):
    headline: str = "Hotels"
    summary: str = ""
    metric: str = ""
    metric_label: str = "stay"
    options: list[HotelOption] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)


class BudgetLine(_Loose):
    category: str
    amount: str = ""
    notes: str = ""


class BudgetCard(_Loose):
    headline: str = "Budget"
    summary: str = ""
    metric: str = ""
    metric_label: str = "estimated total"
    estimated_total: str = "Unknown"
    currency: str = ""
    lines: list[BudgetLine] = Field(default_factory=list)
    exclusions: list[str] = Field(default_factory=list)
    assumptions: list[str] = Field(default_factory=list)


class ItineraryStop(_Loose):
    time: str = ""
    title: str = ""
    detail: str = ""
    place: str = ""


class ItineraryDay(_Loose):
    day: str = ""
    title: str = ""
    summary: str = ""
    stops: list[ItineraryStop] = Field(default_factory=list)


class ItineraryCard(_Loose):
    headline: str = "Itinerary"
    summary: str = ""
    metric: str = ""
    metric_label: str = "days"
    days: list[ItineraryDay] = Field(default_factory=list)
    highlights: list[str] = Field(default_factory=list)


def expected_days(constraints: dict[str, str]) -> int | None:
    """Return an inclusive day count for common natural-language date ranges."""
    value = str((constraints or {}).get("travel_dates") or "")
    match = re.search(
        r"(\d{1,2})\s+([A-Za-z]+)\s*(?:to|until|through|-)\s*"
        r"(\d{1,2})\s+([A-Za-z]+)(?:\s*,?\s*(\d{4}))?",
        value,
        re.I,
    )
    if not match:
        match = re.search(
            r"(\d{1,2})\s*(?:to|until|through|-)\s*(\d{1,2})\s+"
            r"([A-Za-z]+)(?:\s*,?\s*(\d{4}))?",
            value,
            re.I,
        )
        if match:
            # Normalize the compact form to the full-form groups.
            groups = (
                match.group(1),
                match.group(3),
                match.group(2),
                match.group(3),
                match.group(4),
            )

            class _Match:
                def group(self, index: int):
                    return groups[index - 1]

            match = _Match()
    if not match:
        return None
    try:
        year = int(match.group(5) or date.today().year)
        start = date.fromisoformat(
            f"{year}-{_month_number(match.group(2)):02d}-{int(match.group(1)):02d}"
        )
        end_year = year if match.group(5) else year
        end = date.fromisoformat(
            f"{end_year}-{_month_number(match.group(4)):02d}-{int(match.group(3)):02d}"
        )
        if end < start:
            end = date.fromisoformat(
                f"{year + 1}-{_month_number(match.group(4)):02d}-{int(match.group(3)):02d}"
            )
        return (end - start).days + 1
    except (ValueError, KeyError):
        return None


def _month_number(value: str) -> int:
    name = value.lower()[:3]
    months = {
        "jan": 1,
        "feb": 2,
        "mar": 3,
        "apr": 4,
        "may": 5,
        "jun": 6,
        "jul": 7,
        "aug": 8,
        "sep": 9,
        "oct": 10,
        "nov": 11,
        "dec": 12,
    }
    return months[name]


def itinerary_is_valid(card: ItineraryCard, constraints: dict[str, str]) -> bool:
    required = expected_days(constraints) or 1
    if len(card.days) < required:
        return False
    return all(day.stops or day.summary.strip() for day in card.days)


class WeatherDay(_Loose):
    date: str = ""  # "Mon 12", "Day 1"
    condition: str = ""  # "Light rain"
    high: str = ""  # "31" or "31°C"
    low: str = ""
    precip_chance: str = ""  # "40%"


class WeatherCard(_Loose):
    headline: str = "Weather"
    summary: str = ""  # ONE short sentence, not a data dump
    metric: str = ""  # kept for backwards compatibility
    metric_label: str = "conditions"

    condition: str = ""  # "Partly cloudy"
    season: str = ""  # "Monsoon", "Dry season"
    temp_high: str = ""
    temp_low: str = ""
    temp_unit: str = ""  # "C" or "F"
    feels_like: str = ""
    humidity: str = ""  # "65%"
    wind: str = ""  # "12 km/h NW"
    precip_chance: str = ""  # "40%"
    uv_index: str = ""  # "7"

    forecast: list[WeatherDay] = Field(default_factory=list)
    alerts: list[str] = Field(default_factory=list)
    packing_hints: list[str] = Field(default_factory=list)


class PackingItem(BaseModel):
    item: str
    reason: str = ""
    category: str = "general"


class PackingList(BaseModel):
    summary: str = ""
    items: list[PackingItem] = Field(default_factory=list)


class TimelineEvent(BaseModel):
    when: str = ""
    title: str
    detail: str = ""
    kind: Literal[
        "origin", "flight", "hotel", "activity", "budget", "return", "destination"
    ] = "activity"


class TripTimeline(BaseModel):
    summary: str = ""
    events: list[TimelineEvent] = Field(default_factory=list)


class FinalChart(BaseModel):
    chat_message: str
    trip_summary: str = ""
    origin: str = ""
    destination: str = ""
    dates: str = ""
    travelers: str = ""
    packing: PackingList = Field(default_factory=PackingList)
    timeline: TripTimeline = Field(default_factory=TripTimeline)
    assumptions: list[str] = Field(default_factory=list)


class TripDocument(BaseModel):
    origin: str = ""
    destination: str = ""
    dates: str = ""
    travelers: str = ""
    trip_summary: str = ""
    chat_message: str = ""
    flights: FlightCard = Field(default_factory=FlightCard)
    hotels: HotelCard = Field(default_factory=HotelCard)
    budget: BudgetCard = Field(default_factory=BudgetCard)
    itinerary: ItineraryCard = Field(default_factory=ItineraryCard)
    weather: WeatherCard = Field(default_factory=WeatherCard)
    packing: PackingList = Field(default_factory=PackingList)
    timeline: TripTimeline = Field(default_factory=TripTimeline)
    assumptions: list[str] = Field(default_factory=list)


def parse_model(model: type[BaseModel], raw: object) -> BaseModel | None:
    data = extract_json(raw)
    if not isinstance(data, dict):
        return None
    try:
        return model.model_validate(data)
    except ValidationError:
        return None


def flight_card_from(raw: str) -> FlightCard:
    parsed = parse_model(FlightCard, raw)
    if parsed:
        return parsed  # type: ignore[return-value]
    return FlightCard(
        headline="Flights",
        summary=clip(raw) if raw else "Flight research is still thin.",
    )


def hotel_card_from(raw: str) -> HotelCard:
    parsed = parse_model(HotelCard, raw)
    if parsed:
        return parsed  # type: ignore[return-value]
    return HotelCard(
        headline="Hotels", summary=clip(raw) if raw else "Stay research is still thin."
    )


def budget_card_from(raw: str) -> BudgetCard:
    parsed = parse_model(BudgetCard, raw)
    if parsed:
        return parsed  # type: ignore[return-value]
    total = "Unknown"
    match = re.search(r"Estimated total:\s*(.+)", raw, re.IGNORECASE)
    if match:
        total = match.group(1).strip()
    return BudgetCard(
        headline="Budget",
        summary=clip(raw) if raw else "Budget analysis is still thin.",
        metric=total if total != "Unknown" else "",
        estimated_total=total,
    )


def itinerary_card_from(raw: str) -> ItineraryCard:
    parsed = parse_model(ItineraryCard, raw)
    if parsed:
        return parsed  # type: ignore[return-value]
    return ItineraryCard(
        headline="Itinerary",
        summary=clip(raw, 520) if raw else "The day plan is still being drawn.",
    )


def weather_card_from(raw: str) -> WeatherCard:
    parsed = parse_model(WeatherCard, raw)
    if parsed:
        return parsed  # type: ignore[return-value]
    # Last resort only: a short sentence, never the whole raw payload.
    return WeatherCard(headline="Weather", summary=clip(raw, 200) if raw else "")


def itinerary_preview(raw: str, limit: int = 3_000) -> str:
    card = itinerary_card_from(raw)
    if card.days:
        lines = [card.summary] + [f"{day.day}: {day.title}" for day in card.days[:8]]
        return "\n".join(part for part in lines if part)[:limit]
    return raw[:limit]


def dump_card(model: BaseModel) -> str:
    return model.model_dump_json()


DEFAULT_PACKING = [
    PackingItem(
        item="Passport / ID", reason="Required at every gate", category="documents"
    ),
    PackingItem(
        item="Cards and a little local cash",
        reason="Transit and small vendors",
        category="documents",
    ),
    PackingItem(
        item="Phone charger and adapter",
        reason="Navigation and tickets",
        category="electronics",
    ),
    PackingItem(
        item="Medicines", reason="Keep a small personal kit", category="health"
    ),
    PackingItem(
        item="Weather-aware layers",
        reason="Match the destination forecast",
        category="clothing",
    ),
]


def fallback_final(state: dict) -> FinalChart:
    constraints = state.get("trip_constraints") or {}
    origin = str(constraints.get("origin") or "")
    destination = str(constraints.get("destination") or "your destination")
    dates = str(constraints.get("travel_dates") or "")
    travelers = str(constraints.get("traveler_count") or "")
    revision = "revise the existing voyage" in str(state.get("user_query", "")).lower()
    if revision:
        chat_message = (
            f"The {destination} chart is updated from your latest instruction. "
            "Open the trip page to review the revised flights, stays, budget, and days."
        )
    else:
        chat_message = (
            f"The voyage to {destination} is planned and filed in Trips. "
            "Open the trip page for the route, stays, ledger, and day plan."
        )
    itinerary = itinerary_card_from(state.get("itinerary", ""))
    flights = flight_card_from(state.get("flight_results", ""))
    hotels = hotel_card_from(state.get("hotel_results", ""))
    events: list[TimelineEvent] = []
    if origin:
        events.append(TimelineEvent(when=dates, title=f"Leave {origin}", kind="origin"))
    for option in flights.options[:2]:
        events.append(
            TimelineEvent(
                when=option.departs or dates,
                title=f"{option.airline} {option.flight_number}".strip() or "Flight",
                detail=f"{option.origin} → {option.destination}".strip(" →"),
                kind="flight",
            )
        )
    for option in hotels.options[:1]:
        events.append(
            TimelineEvent(
                when=option.nights or dates,
                title=option.name or "Stay",
                detail=option.area,
                kind="hotel",
            )
        )
    for day in itinerary.days:
        events.append(
            TimelineEvent(
                when=day.day,
                title=day.title or day.day,
                detail=day.summary,
                kind="activity",
            )
        )
    if destination:
        events.append(
            TimelineEvent(when=dates, title=f"Arrive {destination}", kind="destination")
        )
    return FinalChart(
        chat_message=chat_message,
        trip_summary=itinerary.summary or chat_message,
        origin=origin,
        destination=destination,
        dates=dates,
        travelers=travelers,
        packing=PackingList(
            summary="A practical kit for this voyage.", items=DEFAULT_PACKING
        ),
        timeline=TripTimeline(
            summary="From origin to destination, in travelling order.", events=events
        ),
        assumptions=[],
    )


def assemble_trip_document(state: dict, chart: FinalChart) -> dict:
    constraints = state.get("trip_constraints") or {}
    document = TripDocument(
        origin=chart.origin or str(constraints.get("origin") or ""),
        destination=chart.destination or str(constraints.get("destination") or ""),
        dates=chart.dates or str(constraints.get("travel_dates") or ""),
        travelers=chart.travelers or str(constraints.get("traveler_count") or ""),
        trip_summary=chart.trip_summary,
        chat_message=chart.chat_message,
        flights=flight_card_from(state.get("flight_results", "")),
        hotels=hotel_card_from(state.get("hotel_results", "")),
        budget=budget_card_from(state.get("budget_analysis", "")),
        itinerary=itinerary_card_from(state.get("itinerary", "")),
        weather=weather_card_from(state.get("weather_results", "")),
        packing=(
            chart.packing
            if chart.packing.items
            else PackingList(items=DEFAULT_PACKING, summary=chart.packing.summary)
        ),
        timeline=chart.timeline,
        assumptions=chart.assumptions,
    )
    return document.model_dump()
