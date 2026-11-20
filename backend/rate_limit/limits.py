from __future__ import annotations

import asyncio
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import AsyncIterator

from fastapi import HTTPException, Request

from config import get_settings


class RateLimitError(Exception):
    def __init__(self, scope: str, message: str, retry_after: int, status_code: int = 429):
        self.scope = scope
        self.message = message
        self.retry_after = max(1, retry_after)
        self.status_code = status_code
        super().__init__(message)


class SlidingWindow:
    def __init__(self) -> None:
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock = asyncio.Lock()

    async def allow(self, key: str, limit: int, window: float = 60) -> bool:
        now = time.monotonic()
        async with self._lock:
            events = self._events[key]
            while events and now - events[0] >= window:
                events.popleft()
            if len(events) >= limit:
                return False
            events.append(now)
            if len(self._events) > 2048:
                for stale_key, stale in list(self._events.items()):
                    if not stale or now - stale[-1] >= window:
                        self._events.pop(stale_key, None)
            return True


class WorkflowLimiter:
    def __init__(self) -> None:
        self._active = 0
        self._lock = asyncio.Lock()

    @asynccontextmanager
    async def slot(self) -> AsyncIterator[None]:
        settings = get_settings()
        if settings.rate_limit_enabled:
            async with self._lock:
                if self._active >= settings.max_global_active_workflows:
                    raise RateLimitError("global", "The planning service is busy. Please retry shortly.", 30, 503)
                self._active += 1
        try:
            yield
        finally:
            if settings.rate_limit_enabled:
                async with self._lock:
                    self._active = max(0, self._active - 1)


ip_limiter = SlidingWindow()
workflow_limiter = WorkflowLimiter()


def client_ip(request: Request) -> str:
    # Render is the only supported trusted proxy for this deployment shape.
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded and request.headers.get("host", "").endswith(("onrender.com", ".com")):
        return forwarded.split(",", 1)[0].strip()
    return request.client.host if request.client else "unknown"


async def enforce_ip_rate_limit(request: Request) -> None:
    settings = get_settings()
    if not settings.rate_limit_enabled:
        return
    if not await ip_limiter.allow(client_ip(request), settings.ip_burst_limit_per_min):
        raise HTTPException(
            status_code=429,
            detail={
                "error": "rate_limited",
                "scope": "ip",
                "message": "Too many planning requests. Please retry shortly.",
                "retry_after_seconds": 60,
            },
            headers={"Retry-After": "60"},
        )


def rate_limit_response(exc: RateLimitError) -> HTTPException:
    return HTTPException(
        status_code=exc.status_code,
        detail={
            "error": "rate_limited",
            "scope": exc.scope,
            "message": exc.message,
            "retry_after_seconds": exc.retry_after,
        },
        headers={"Retry-After": str(exc.retry_after)},
    )

