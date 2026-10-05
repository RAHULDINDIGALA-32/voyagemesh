from __future__ import annotations

import asyncio
import json
import logging
import random

log = logging.getLogger(__name__)

RETRYABLE_STATUS = {408, 409, 429, 500, 502, 503, 504}
UNAVAILABLE_MARKERS = ("currently unavailable", "not enough research")


def text(content) -> str:
    """Normalize message content (str or list of content blocks) to plain text."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return "".join(
            b if isinstance(b, str) else b.get("text", "")
            for b in content
            if isinstance(b, str) or (isinstance(b, dict) and b.get("type") == "text")
        )
    return str(content)


def _prune(value):
    """Drop empty values so card JSON doesn't waste tokens on blank fields."""
    if isinstance(value, dict):
        pruned = {k: _prune(v) for k, v in value.items()}
        return {k: v for k, v in pruned.items() if v not in ("", None, [], {})}
    if isinstance(value, list):
        return [v for v in (_prune(i) for i in value) if v not in ("", None, [], {})]
    return value


def clip(raw: str, limit: int) -> str:
    """Keep the head and the tail: itineraries end with the return leg."""
    if len(raw) <= limit:
        return raw
    head = int(limit * 0.7)
    return f"{raw[:head]}\n...[truncated]...\n{raw[-(limit - head):]}"


def compact(raw, limit: int) -> str:
    """Compact JSON where possible, then clip to `limit` characters."""
    if raw is None:
        return ""
    if not isinstance(raw, str):
        raw = json.dumps(raw, ensure_ascii=False, default=str)
    raw = raw.strip()
    if not raw:
        return ""
    try:
        raw = json.dumps(
            _prune(json.loads(raw)), ensure_ascii=False, separators=(",", ":")
        )
    except (ValueError, TypeError):
        pass  # plain text, clip as-is
    return clip(raw, limit)


def usable(section: str) -> bool:
    low = section.lower()
    return bool(section) and not any(m in low for m in UNAVAILABLE_MARKERS)


def _retry_after(exc: Exception) -> float | None:
    headers = getattr(getattr(exc, "response", None), "headers", None)
    try:
        return float(headers.get("retry-after")) if headers else None
    except (TypeError, ValueError):
        return None


async def invoke(
    llm, messages: list, *, name: str, timeout: float = 45, attempts: int = 3
):
    """LLM call with timeout and bounded retry on transient failures.

    413 is deliberately NOT retried: resending the same payload cannot succeed.
    """
    for attempt in range(1, attempts + 1):
        try:
            return await asyncio.wait_for(llm.ainvoke(messages), timeout)
        except Exception as exc:
            status = getattr(exc, "status_code", None)
            transient = (
                isinstance(exc, asyncio.TimeoutError) or status in RETRYABLE_STATUS
            )
            if not transient or attempt == attempts:
                raise
            delay = _retry_after(exc) or min(2**attempt, 10) + random.random()
            log.warning(
                "%s attempt %d/%d failed (%s); retrying in %.1fs",
                name,
                attempt,
                attempts,
                status or type(exc).__name__,
                delay,
            )
            await asyncio.sleep(delay)
