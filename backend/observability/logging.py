from __future__ import annotations

import json
import logging
import os
import sys
from datetime import UTC, datetime
from typing import Any

from observability.context import get_context
from observability.redact import redact


class ContextFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        context = get_context()
        for field in ("request_id", "user_id_hash", "thread_id", "agent", "provider", "trace_id"):
            if not hasattr(record, field):
                setattr(record, field, context.get(field, "-"))
        if not hasattr(record, "event"):
            record.event = "log"
        return True


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": redact(record.getMessage()),
            "request_id": getattr(record, "request_id", "-"),
            "user_id_hash": getattr(record, "user_id_hash", "-"),
            "thread_id": getattr(record, "thread_id", "-"),
            "agent": getattr(record, "agent", "-"),
            "provider": getattr(record, "provider", "-"),
            "event": getattr(record, "event", "log"),
        }
        for field in ("duration_ms", "error_type", "trace_id", "category", "scope"):
            value = getattr(record, field, None)
            if value is not None:
                payload[field] = redact(value)
        if record.exc_info:
            payload["error_type"] = record.exc_info[0].__name__
        return json.dumps(payload, ensure_ascii=False, default=str)


class TextFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        return f"{record.levelname} {record.name} [{getattr(record, 'event', 'log')}] {redact(record.getMessage())}"


def configure_logging() -> None:
    root = logging.getLogger()
    if getattr(root, "_voyagemesh_configured", False):
        return
    handler = logging.StreamHandler(sys.stdout)
    handler.addFilter(ContextFilter())
    handler.setFormatter(TextFormatter() if os.getenv("LOG_FORMAT", "json").lower() == "text" else JsonFormatter())
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(os.getenv("LOG_LEVEL", "INFO").upper())
    root._voyagemesh_configured = True  # type: ignore[attr-defined]


def log_event(logger: logging.Logger, level: int, event: str, message: str, **fields: Any) -> None:
    extra = {"event": event, **fields}
    logger.log(level, message, extra=extra)

