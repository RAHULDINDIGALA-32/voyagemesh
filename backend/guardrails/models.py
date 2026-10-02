from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel, Field, model_validator

GuardrailCategory = Literal[
    "allowed",
    "invalid",
    "non_travel",
    "unsafe",
    "prompt_injection",
    "unsupported_claim",
]


class ModelGuardrailDecision(BaseModel):
    allowed: bool
    category: GuardrailCategory
    reason: str = Field(min_length=1, max_length=500)

    @model_validator(mode="after")
    def category_matches_decision(self):
        if self.allowed != (self.category == "allowed"):
            raise ValueError("allowed decisions must use category 'allowed'")
        return self


@dataclass(frozen=True)
class GuardrailDecision:
    allowed: bool
    category: GuardrailCategory
    reason: str
    source: Literal["model", "deterministic"]

    def as_state(self) -> dict[str, str | bool]:
        return {
            "allowed": self.allowed,
            "category": self.category,
            "reason": self.reason,
            "source": self.source,
        }
