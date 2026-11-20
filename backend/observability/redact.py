from __future__ import annotations

import re
from typing import Any


_PATTERNS = (
    (re.compile(r"\b(?:sk|gsk|AIza)[-_A-Za-z0-9]{16,}\b", re.I), "[REDACTED_KEY]"),
    (re.compile(r"\b[A-Fa-f0-9]{32,}\b"), "[REDACTED_TOKEN]"),
    (re.compile(r"\b[A-Za-z0-9+/]{40,}={0,2}\b"), "[REDACTED_TOKEN]"),
    (re.compile(r"\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b"), "[REDACTED_EMAIL]"),
    (re.compile(r"(?<!\w)(?:\+?\d[\d ()-]{8,}\d)(?!\w)"), "[REDACTED_PHONE]"),
    (re.compile(r"(?<!\d)(?:\d[ -]?){13,19}(?!\d)"), "[REDACTED_CARD]"),
    (re.compile(r"\b[A-Z]{1,3}\d{6,9}\b"), "[REDACTED_DOCUMENT]"),
)


def redact(value: Any) -> Any:
    if isinstance(value, str):
        for pattern, replacement in _PATTERNS:
            value = pattern.sub(replacement, value)
        return value
    if isinstance(value, list):
        return [redact(item) for item in value]
    if isinstance(value, tuple):
        return tuple(redact(item) for item in value)
    if isinstance(value, dict):
        return {key: redact(item) for key, item in value.items()}
    return value

