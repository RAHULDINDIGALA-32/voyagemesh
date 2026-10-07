from __future__ import annotations

import re
import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal, InvalidOperation
from typing import Any, Literal
from hitl.errors import InterventionExpired, InvalidResponse, StaleIntervention

from pydantic import BaseModel, Field, field_validator

InterventionType = Literal[
    "constraint_clarification", "budget_decision", "itinerary_review"
]

MAX_HITL_RESPONSE_LENGTH = 500
HITL_TTL_HOURS = 24
CANONICAL_CONSTRAINTS = {
    "origin",
    "destination",
    "travel_dates",
    "traveler_count",
    "budget",
}
CONSTRAINT_ALIASES = {
    "from": "origin",
    "departure": "origin",
    "departure_city": "origin",
    "to": "destination",
    "destination_city": "destination",
    "dates": "travel_dates",
    "date": "travel_dates",
    "travel_date": "travel_dates",
    "number_of_travelers": "traveler_count",
    "travelers": "traveler_count",
}
REVIEW_PREFERENCES = {
    "reduce_cost",
    "more_free_time",
    "more_sightseeing",
    "change_hotel",
    "change_flight",
    "other",
}


class HumanResponseRequest(BaseModel):
    intervention_id: str = Field(pattern=r"^hitl_[a-f0-9]{32}$")
    expected_version: int = Field(ge=1)
    action: str = Field(min_length=1, max_length=40)
    data: dict[str, str] = Field(default_factory=dict)

    @field_validator("data")
    @classmethod
    def limit_response_data(cls, value: dict[str, str]) -> dict[str, str]:
        if len(value) > 8:
            raise ValueError("Too many response fields")
        cleaned: dict[str, str] = {}
        for key, item in value.items():
            if not re.fullmatch(r"[a-z_]{1,40}", key):
                raise ValueError("Response field names are invalid")
            if (
                not isinstance(item, str)
                or len(item.strip()) > MAX_HITL_RESPONSE_LENGTH
            ):
                raise ValueError("Response field values are invalid")
            cleaned[key] = item.strip()
        return cleaned


def utc_now() -> datetime:
    return datetime.now(UTC)


def normalize_constraints(constraints: dict[str, str]) -> dict[str, str]:
    normalized: dict[str, str] = {}
    for key, value in constraints.items():
        canonical_key = CONSTRAINT_ALIASES.get(key.lower().strip(), key.lower().strip())
        if (
            canonical_key in CANONICAL_CONSTRAINTS
            and isinstance(value, str)
            and value.strip()
        ):
            normalized[canonical_key] = value.strip()[:MAX_HITL_RESPONSE_LENGTH]
    return normalized


def missing_constraints(state: dict) -> list[str]:
    constraints = normalize_constraints(state.get("trip_constraints", {}))
    required_by_agent = {
        "flight_agent": {"origin", "destination", "travel_dates"},
        "hotel_agent": {"destination", "travel_dates"},
        "weather_agent": {"destination"},
        "itinerary_agent": {"destination", "travel_dates"},
    }
    required: set[str] = set()
    for agent in state.get("selected_agents", []):
        required.update(required_by_agent.get(agent, set()))
    return sorted(field for field in required if not constraints.get(field))


def intervention_question(
    intervention_type: InterventionType, required_fields: list[str]
) -> str:
    if intervention_type == "constraint_clarification":
        labels = {
            "origin": "your departure city",
            "destination": "your destination",
            "travel_dates": "your travel dates or date range",
            "traveler_count": "the number of travelers",
        }
        details = ", ".join(
            labels.get(field, field.replace("_", " ")) for field in required_fields
        )
        return f"I need {details} before I can continue planning your trip."
    if intervention_type == "budget_decision":
        return "The estimated trip cost exceeds your stated budget. How would you like to proceed?"
    return "Your proposed itinerary is ready. Review it before I prepare the final response."


def create_intervention(
    intervention_type: InterventionType,
    *,
    version: int,
    required_fields: list[str] | None = None,
    allowed_actions: list[str],
    context: dict[str, Any] | None = None,
    itinerary_version: int | None = None,
) -> dict[str, Any]:
    now = utc_now()
    return {
        "type": intervention_type,
        "status": "pending",
        "intervention_id": f"hitl_{uuid.uuid4().hex}",
        "version": version,
        "created_at": now.isoformat(),
        "expires_at": (now + timedelta(hours=HITL_TTL_HOURS)).isoformat(),
        "question": intervention_question(intervention_type, required_fields or []),
        "required_fields": required_fields or [],
        "allowed_actions": allowed_actions,
        "context": context or {},
        "itinerary_version": itinerary_version,
    }


def _parse_amount(value: str) -> tuple[Decimal, str | None] | None:
    match = re.search(
        r"(?:(INR|USD|EUR)|([₹$€]))?\s*(\d[\d,]*(?:\.\d{1,2})?)", value, re.I
    )
    if not match:
        return None
    currency = match.group(1) or {"₹": "INR", "$": "USD", "€": "EUR"}.get(
        match.group(2)
    )
    try:
        return Decimal(match.group(3).replace(",", "")), currency
    except InvalidOperation:
        return None


def budget_conflict(
    state: dict, tolerance: Decimal = Decimal("0.05")
) -> dict[str, str] | None:
    budget = _parse_amount(state.get("trip_constraints", {}).get("budget", ""))
    match = re.search(
        r"estimated\s+total\s*[:\-]\s*([^\n]+)",
        state.get("budget_analysis", ""),
        re.I,
    )
    estimate = _parse_amount(match.group(1)) if match else None
    if not budget or not estimate or budget[1] != estimate[1]:
        return None
    if estimate[0] <= budget[0] * (Decimal("1") + tolerance):
        return None
    return {
        "user_budget": str(budget[0]),
        "estimated_total": str(estimate[0]),
        "currency": budget[1] or "unspecified",
        "difference": str(estimate[0] - budget[0]),
    }


def validate_human_response(
    intervention: dict[str, Any], response: HumanResponseRequest
) -> dict[str, Any]:
    """Validate and sanitize a response before it can resume a graph."""
    if intervention.get("status") != "pending":
        raise StaleIntervention("This intervention is no longer pending")
    if response.intervention_id != intervention.get("intervention_id"):
        raise StaleIntervention("The intervention does not match the current workflow state")
    if response.expected_version != intervention.get("version"):
        raise StaleIntervention("This review is stale. Please use the latest intervention.")
    if utc_now() >= datetime.fromisoformat(intervention["expires_at"]):
        raise InterventionExpired("This intervention has expired. Reopen the review to continue.")
    if response.action not in intervention.get("allowed_actions", []):
        raise InvalidResponse("That action is not available for this intervention")

    response_data = response.data
    intervention_type = intervention["type"]
    if intervention_type == "constraint_clarification":
        required = set(intervention.get("required_fields", []))
        if set(response_data) - CANONICAL_CONSTRAINTS or not required.issubset(
            response_data
        ):
            raise InvalidResponse("Please provide all requested travel details")
    elif intervention_type == "budget_decision":
        if response.action == "increase_budget":
            amount = _parse_amount(response_data.get("budget", ""))
            if not amount or amount[0] <= 0:
                raise InvalidResponse("Provide a valid increased budget")
        elif response_data:
            raise InvalidResponse("This budget action does not accept additional fields")
    elif intervention_type == "itinerary_review":
        if response.action == "modify":
            preference = response_data.get("preference")
            if preference not in REVIEW_PREFERENCES:
                raise InvalidResponse("Choose a supported itinerary modification")
            if set(response_data) - {"preference", "instructions"}:
                    raise InvalidResponse(
                    "The itinerary modification contains unsupported fields"
                )
        elif response_data:
            raise InvalidResponse("This itinerary action does not accept additional fields")

    return {"action": response.action, "data": response_data}
