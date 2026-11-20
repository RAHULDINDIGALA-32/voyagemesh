from __future__ import annotations

import logging
import os
from typing import Any

from observability.redact import redact

log = logging.getLogger(__name__)
_configured = False
_enabled = False


def configure_langsmith(environment: str, project: str | None = None) -> bool:
    global _configured, _enabled
    if _configured:
        return _enabled
    _configured = True
    enabled_value = os.getenv("LANGSMITH_TRACING", os.getenv("LANGCHAIN_TRACING_V2", "false"))
    _enabled = enabled_value.lower() in {"1", "true", "yes", "on"} and bool(os.getenv("LANGSMITH_API_KEY", os.getenv("LANGCHAIN_API_KEY")))
    selected = project or os.getenv("LANGSMITH_PROJECT", f"voyagemesh-{environment}")
    if environment == "production":
        selected = "voyagemesh-prod"
    elif environment != "development":
        selected = f"voyagemesh-{environment}"
    os.environ.setdefault("LANGSMITH_PROJECT", selected)
    os.environ.setdefault("LANGCHAIN_PROJECT", selected)
    os.environ.setdefault("LANGCHAIN_ENDPOINT", os.getenv("LANGSMITH_ENDPOINT", "https://api.smith.langchain.com"))
    os.environ.setdefault("LANGCHAIN_TRACING_SAMPLING_RATE", os.getenv("LANGSMITH_SAMPLE_RATE", "1.0"))
    # LangSmith SDK versions differ in hook names. These environment flags are
    # understood by current clients; custom traceable spans still receive
    # already-redacted payloads from this application.
    os.environ.setdefault("LANGCHAIN_HIDE_INPUTS", "false")
    os.environ.setdefault("LANGCHAIN_HIDE_OUTPUTS", "false")
    log.info("LangSmith tracing configured enabled=%s project=%s", _enabled, selected, extra={"event": "tracing_configured"})
    return _enabled


def tracing_enabled() -> bool:
    return _enabled


def traceable(name: str, run_type: str = "chain", **kwargs: Any):
    """Optional LangSmith decorator that never makes tracing a hard dependency."""
    try:
        from langsmith import traceable as decorator
        return decorator(name=name, run_type=run_type, **kwargs)
    except Exception:
        return lambda function: function


def safe_metadata(value: Any) -> Any:
    return redact(value)

