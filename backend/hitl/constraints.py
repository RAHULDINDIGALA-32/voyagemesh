"""Single source of truth for trip constraints."""

from __future__ import annotations

import re
from collections.abc import Mapping
from typing import Any

MAX_CONSTRAINT_LENGTH = 500

# Required-by-agents fields (what HITL asks for / validates).
CANONICAL_CONSTRAINTS = {
    "origin",
    "destination",
    "travel_dates",
    "traveler_count",
    "budget",
}
# Accepted and stored, but never required.
OPTIONAL_CONSTRAINTS = {"duration", "preferences"}

_ALIAS_GROUPS: dict[str, tuple[str, ...]] = {
    "origin": (
        "from",
        "source",
        "departure",
        "departure_city",
        "departure_location",
        "origin_city",
        "starting_point",
        "start_location",
        "leaving_from",
        "depart_from",
        "starting_city",
        "home_city",
    ),
    "destination": (
        "to",
        "destination_city",
        "arrival_city",
        "going_to",
        "dest",
        "target_destination",
        "city",
        "trip_destination",
    ),
    "travel_dates": (
        "dates",
        "date",
        "travel_date",
        "trip_dates",
        "date_range",
        "travel_period",
        "dates_of_travel",
        "period",
        "when",
    ),
    "traveler_count": (
        "travelers",
        "travellers",
        "number_of_travelers",
        "number_of_travellers",
        "num_travelers",
        "traveller_count",
        "passengers",
        "people",
        "group_size",
        "party_size",
        "pax",
        "guests",
        "adults",
    ),
    "budget": ("total_budget", "trip_budget", "max_budget", "budget_amount"),
    "duration": ("trip_duration", "length_of_stay", "days", "nights", "number_of_days"),
    "preferences": ("preference", "interests", "travel_style", "notes"),
}
_ALIASES: dict[str, str] = {
    alias: canon for canon, aliases in _ALIAS_GROUPS.items() for alias in aliases
}
_ALIASES.update({c: c for c in CANONICAL_CONSTRAINTS | OPTIONAL_CONSTRAINTS})

# Split date keys that get merged into ``travel_dates``.
_START_KEYS = {
    "start_date",
    "from_date",
    "departure_date",
    "depart_date",
    "outbound_date",
    "check_in",
    "checkin",
    "start",
    "begin_date",
    "arrival_date",
}
_END_KEYS = {
    "end_date",
    "to_date",
    "return_date",
    "inbound_date",
    "check_out",
    "checkout",
    "end",
    "finish_date",
}
_WRAPPER_KEYS = {"constraints", "trip_constraints", "trip_details", "details"}

# Values an LLM writes when it "fills" a field it does not actually know.
_EMPTY = {
    "",
    "-",
    "none",
    "null",
    "nil",
    "n/a",
    "na",
    "unknown",
    "unspecified",
    "not specified",
    "not provided",
    "not mentioned",
    "tbd",
    "tba",
}


def _flatten(value: Any, joiner: str = ", ") -> str:
    if value is None or isinstance(value, bool):
        return ""
    if isinstance(value, Mapping):
        text = " to ".join(p for p in (_flatten(v) for v in value.values()) if p)
    elif isinstance(value, (list, tuple, set)):
        text = joiner.join(p for p in (_flatten(v) for v in value) if p)
    else:
        text = str(value)
    text = " ".join(text.split())
    return "" if text.lower() in _EMPTY else text[:MAX_CONSTRAINT_LENGTH]


def normalize_constraints(raw: Any) -> dict[str, str]:
    """Canonical-key, string-valued, placeholder-free constraints."""
    if not isinstance(raw, Mapping):
        return {}

    out: dict[str, str] = {}
    start = end = ""

    for key, value in raw.items():
        if not isinstance(key, str):
            continue
        k = re.sub(r"[\s\-]+", "_", key.strip().lower())

        if k in _WRAPPER_KEYS and isinstance(value, Mapping):
            for nk, nv in normalize_constraints(value).items():
                out.setdefault(nk, nv)
            continue
        if k in _START_KEYS:
            start = start or _flatten(value)
            continue
        if k in _END_KEYS:
            end = end or _flatten(value)
            continue

        canon = _ALIASES.get(k)
        if not canon:
            continue
        text = _flatten(value, " to " if canon == "travel_dates" else ", ")
        if text:
            out.setdefault(canon, text)

    if "travel_dates" not in out and (start or end):
        out["travel_dates"] = f"{start} to {end}" if start and end else start or end

    return out


# --------------------------------------------------------------------------
# Deterministic extraction from the raw request
# --------------------------------------------------------------------------

_MONTH = (
    r"(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|"
    r"aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
)
_DAY = r"\d{1,2}(?:st|nd|rd|th)?"
_DATE = (
    rf"(?:{_DAY}(?:\s+of)?\s+{_MONTH}\b(?:,?\s+\d{{4}})?"
    rf"|{_MONTH}\b\.?\s+{_DAY}\b(?:,?\s+\d{{4}})?"
    r"|\d{4}-\d{2}-\d{2}"
    r"|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})"
)
_SEP = r"\s*(?:to|until|till|through|thru|-|–|—)\s*"
_DATE_RANGE = re.compile(
    rf"(?P<a>{_DATE}|{_DAY}){_SEP}(?P<b>{_DATE}|{_DAY}(?:,?\s+\d{{4}})?)", re.I
)
_SINGLE_DATE = re.compile(_DATE, re.I)
_HAS_DATE_SIGNAL = re.compile(rf"{_MONTH}|\d[/.-]\d", re.I)

_PLACE = r"[A-Z][\w.'’-]*(?:\s+[A-Z][\w.'’-]*){0,3}"
_ROUTE = re.compile(rf"(?i:\bfrom)\s+(?P<o>{_PLACE})\s+(?i:to)\s+(?P<d>{_PLACE})")
_DEST_ONLY = re.compile(
    rf"(?i:\b(?:trip|travel|travelling|traveling|fly|flight|flights|vacation|"
    rf"holiday|visit|visiting)\s+to)\s+(?P<d>{_PLACE})"
)

_TRAVELERS = re.compile(
    r"(?P<n>\d{1,2})\s*(?:travell?ers?|people|persons?|adults?|pax|guests|friends|members)\b"
    r"|\b(?:family|group|party)\s+of\s+(?P<m>\d{1,2})\b",
    re.I,
)

_CUR_CODE = r"(?:INR|USD|EUR|Rs\.?|₹|\$|€)"
_BUDGET = re.compile(
    r"(?:\bbudget\b[^\d₹$€]{0,15}|\b(?:under|within|up\s*to|upto|max(?:imum)?)\s+)"
    rf"(?P<amt>{_CUR_CODE}\s*\d[\d,]*(?:\.\d{{1,2}})?"
    r"|\d[\d,]*(?:\.\d{1,2})?\s*(?:INR|USD|EUR|rupees|dollars|euros))",
    re.I,
)
_CUR_WORDS = {
    "rs": "INR",
    "rs.": "INR",
    "rupees": "INR",
    "dollars": "USD",
    "euros": "EUR",
}


_TRAILING_MONTH = re.compile(rf"\s+{_MONTH}\.?$", re.I)


def _clean_place(value: str) -> str:
    """'Rome Dec' -> 'Rome' (a capitalised month glued onto the city name)."""
    value = value.strip()
    while (trimmed := _TRAILING_MONTH.sub("", value)) != value and trimmed:
        value = trimmed
    return value


def _extract_dates(query: str) -> str:
    for m in _DATE_RANGE.finditer(query):
        # "2 to 3 travelers" must not look like a date range.
        if _HAS_DATE_SIGNAL.search(m.group(0)):
            return f"{m.group('a').strip()} to {m.group('b').strip()}"
    single = _SINGLE_DATE.search(query)
    return single.group(0).strip() if single else ""


def _extract_budget(query: str) -> str:
    m = _BUDGET.search(query)
    if not m:
        return ""
    amt = " ".join(m.group("amt").split())
    parts = re.match(
        r"^(?P<cur>[A-Za-z.]+)?\s*(?P<num>[\d,.]+)\s*(?P<suffix>[A-Za-z]+)?$", amt
    )
    if not parts:
        return amt
    cur = parts.group("cur") or parts.group("suffix") or ""
    cur = _CUR_WORDS.get(cur.lower(), cur.upper())
    return f"{cur} {parts.group('num')}".strip()


def extract_constraints_from_query(query: str) -> dict[str, str]:
    """Best-effort, deterministic read of the explicit constraints in a request."""
    if not isinstance(query, str) or not query.strip():
        return {}
    found: dict[str, str] = {}

    route = _ROUTE.search(query)
    if route:
        found["origin"] = _clean_place(route.group("o"))
        found["destination"] = _clean_place(route.group("d"))
    else:
        dest = _DEST_ONLY.search(query)
        if dest:
            found["destination"] = _clean_place(dest.group("d"))

    if dates := _extract_dates(query):
        found["travel_dates"] = dates
    if budget := _extract_budget(query):
        found["budget"] = budget

    if m := _TRAVELERS.search(query):
        found["traveler_count"] = m.group("n") or m.group("m")
    elif re.search(r"\bsolo\b", query, re.I):
        found["traveler_count"] = "1"
    elif re.search(r"\b(?:couple|honeymoon)\b", query, re.I):
        found["traveler_count"] = "2"

    return normalize_constraints(found)


def resolve_constraints(*sources: Any, query: str = "") -> dict[str, str]:
    """Earlier sources win; the raw query only fills what is still missing."""
    merged: dict[str, str] = {}
    for source in (*sources, extract_constraints_from_query(query)):
        for key, value in normalize_constraints(source).items():
            merged.setdefault(key, value)
    return merged
