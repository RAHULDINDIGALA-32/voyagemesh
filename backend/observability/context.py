from __future__ import annotations

import contextvars
import hashlib
import os
import secrets
from contextlib import contextmanager
from typing import Any, Iterator


_context: contextvars.ContextVar[dict[str, Any]] = contextvars.ContextVar(
    "voyagemesh_observability_context", default={}
)
_llm_calls: contextvars.ContextVar[int] = contextvars.ContextVar(
    "voyagemesh_llm_calls", default=0
)


def get_context() -> dict[str, Any]:
    return dict(_context.get())


def set_context(**values: Any) -> contextvars.Token:
    current = get_context()
    current.update({key: value for key, value in values.items() if value is not None})
    return _context.set(current)


def reset_context(token: contextvars.Token) -> None:
    _context.reset(token)


@contextmanager
def context_scope(**values: Any) -> Iterator[dict[str, Any]]:
    token = set_context(**values)
    try:
        yield get_context()
    finally:
        reset_context(token)


def new_request_id() -> str:
    return secrets.token_hex(16)


def valid_request_id(value: str | None) -> bool:
    if not value or len(value) > 128:
        return False
    return all(character.isalnum() or character in "._:-" for character in value)


def hash_user_id(user_id: str | None) -> str:
    if not user_id:
        return "anonymous"
    salt = os.getenv("LOG_HASH_SALT", "voyagemesh-development-salt")
    return hashlib.sha256(f"{salt}:{user_id}".encode()).hexdigest()[:12]


def reset_llm_calls() -> None:
    _llm_calls.set(0)


def increment_llm_call(limit: int | None = None) -> int:
    count = _llm_calls.get() + 1
    _llm_calls.set(count)
    if limit is not None and count > limit:
        raise RuntimeError("run_budget_exceeded")
    return count


def llm_call_count() -> int:
    return _llm_calls.get()


def apply_langsmith_context(config: dict, *, request_id: str, thread_id: str, user_id_hash: str, environment: str, app_version: str) -> dict:
    """Add stable, redacted metadata to a LangGraph invocation config."""
    result = dict(config)
    metadata = dict(result.get("metadata") or {})
    metadata.update({
        "request_id": request_id,
        "thread_id": thread_id,
        "user_id_hash": user_id_hash,
        "environment": environment,
        "app_version": app_version,
        "git_sha": os.getenv("RENDER_GIT_COMMIT", os.getenv("GIT_SHA", "unknown")),
    })
    result["metadata"] = metadata
    result.setdefault("tags", []).append(f"env:{environment}")
    result.setdefault("run_name", "voyagemesh.plan")
    return result

