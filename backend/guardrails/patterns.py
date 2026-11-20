"""Small deterministic injection corpus used before any model validator."""

from __future__ import annotations

import base64
import re
import unicodedata


# Role changes and jailbreak personas.
ROLE_OVERRIDE_PATTERNS = (
    r"\byou\s+are\s+now\b", r"\bact\s+as\b", r"\bdeveloper\s+mode\b", r"\bDAN\b",
)
# Requests to reveal hidden instructions.
EXTRACTION_PATTERNS = (
    r"\b(?:show|print|reveal|repeat|dump|extract)\b.{0,80}\b(?:system|developer|hidden)\b.{0,30}\b(?:prompt|message|instruction)s?\b",
)
# Common serialized prompt delimiters.
DELIMITER_PATTERNS = (r"</?system\b", r"\[/?INST\]", r"<\|im_(?:start|end)\|>", r"<\|system\|>")
# Common non-English forms of "ignore previous instructions".
MULTILINGUAL_PATTERNS = (
    r"(?:ignora|ignorez|ignorieren).{0,40}(?:instrucciones|instructions|anweisungen)",
    r"(?:pichhli|pichली).{0,40}(?:hidayat|instructions|निर्देश)",
    r"(?:忽略|无视).{0,20}(?:之前|先前).{0,20}(?:指令|说明)",
)

COMPILED_PATTERNS = tuple(
    re.compile(pattern, re.IGNORECASE | re.DOTALL)
    for pattern in (*ROLE_OVERRIDE_PATTERNS, *EXTRACTION_PATTERNS, *DELIMITER_PATTERNS, *MULTILINGUAL_PATTERNS)
)


def normalize_for_detection(value: str) -> str:
    value = unicodedata.normalize("NFKC", value)
    value = "".join(
        character
        for character in value
        if unicodedata.category(character) not in {"Cf", "Cc"} or character in "\n\r\t"
    )
    return " ".join(value.lower().split())


def has_injection_pattern(value: str) -> bool:
    normalized = normalize_for_detection(value)
    return any(pattern.search(normalized) for pattern in COMPILED_PATTERNS)


def has_encoded_blob(value: str) -> bool:
    # Long encoded blobs are not useful for ordinary travel requests and are a
    # cheap signal for concealed prompt text. Avoid decoding arbitrary content.
    if re.search(r"(?<![A-Za-z0-9])[A-Fa-f0-9]{96,}(?![A-Za-z0-9])", value):
        return True
    for candidate in re.findall(r"(?<![A-Za-z0-9])[A-Za-z0-9+/]{80,}={0,2}(?![A-Za-z0-9])", value):
        try:
            decoded = base64.b64decode(candidate, validate=True)
        except Exception:
            continue
        if len(decoded) >= 40:
            return True
    return False

