from __future__ import annotations

import json
import logging
from typing import Any

from langchain.agents import create_agent
from langchain.agents.middleware import wrap_tool_call
from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage
from langchain_core.tools import StructuredTool
from langgraph.errors import GraphRecursionError
from pydantic import BaseModel, ConfigDict, Field

from agents.structured import extract_json
from llm.client import get_llm
from llm.utils import invoke
from mcp_integrations.client import get_server_tools

log = logging.getLogger(__name__)

DEFAULT_TOOL_ROUNDS = 2
MAX_TOOL_CHARS = 3000  # per tool result entering the agent loop (~750 tokens)
MAX_EVIDENCE_CHARS = 3000  # per tool result in the fallback prompt
MAX_TOTAL_EVIDENCE_CHARS = 9000  # whole evidence block in the fallback prompt
JSON_TOOL_NAME = "json"


class JsonAnswer(BaseModel):
    """Free-form final card. gpt-oss emits this as a tool named `json`."""

    model_config = ConfigDict(extra="allow")

    headline: str = ""
    summary: str = ""
    metric: str = ""
    metric_label: str = ""
    options: list[Any] = Field(default_factory=list)
    notes: list[Any] = Field(default_factory=list)
    packing_hints: list[Any] = Field(default_factory=list)


def _dump_json(payload: dict[str, Any]) -> str:
    return json.dumps(payload, ensure_ascii=False)


def _json_tool_fn(**kwargs: Any) -> str:
    return _dump_json(kwargs)


# gpt-oss / Groq serializes structured answers as a tool call named `json`.
# Registering it stops `tool_use_failed` and lets us read the payload.
JSON_ANSWER_TOOL = StructuredTool.from_function(
    func=_json_tool_fn,
    name=JSON_TOOL_NAME,
    description=(
        "Submit the final JSON answer after research tools are done. "
        "Call this once. Do not call research tools after this."
    ),
    args_schema=JsonAnswer,
)


def _budget_note(rounds: int) -> str:
    return (
        f"\n\nTOOL BUDGET: you may make at most {rounds} research-tool rounds. "
        f"When you are ready to answer, call the `{JSON_TOOL_NAME}` tool with the "
        "required JSON fields. Do not retry a tool that returned an error or empty "
        "data with minor variations. If dates are missing, do not ask the user; "
        "research the route without a date, then answer."
    )


def _text(content) -> str:
    """Normalize message content (str or list of content blocks) to plain text."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict) and block.get("type") == "text":
                parts.append(block.get("text", ""))
        return "".join(parts)
    return str(content)


def _clip(text: str, limit: int) -> str:
    return text if len(text) <= limit else text[:limit] + "\n...[truncated]"


def _as_json_text(value: Any) -> str | None:
    if isinstance(value, dict):
        if value.get("name") == JSON_TOOL_NAME and isinstance(value.get("arguments"), dict):
            return _dump_json(value["arguments"])
        return _dump_json(value)
    if isinstance(value, str):
        parsed = extract_json(value)
        if parsed is None:
            stripped = value.strip()
            return stripped or None
        return _as_json_text(parsed)
    return None


def recover_json_tool_payload(raw: Any) -> str | None:
    """Pull a JSON card out of a gpt-oss `json` tool call or Groq failed_generation."""
    return _as_json_text(raw)


def _tool_call_payload(message: Any) -> str | None:
    for call in getattr(message, "tool_calls", None) or []:
        if isinstance(call, dict):
            name, args = call.get("name"), call.get("args")
        else:
            name, args = getattr(call, "name", ""), getattr(call, "args", None)
        if name == JSON_TOOL_NAME and args is not None:
            return recover_json_tool_payload(args)
    kwargs = getattr(message, "additional_kwargs", None) or {}
    function_call = kwargs.get("function_call") or {}
    if function_call.get("name") == JSON_TOOL_NAME:
        return recover_json_tool_payload(function_call.get("arguments"))
    return None


def answer_from_messages(messages: list) -> str:
    """Prefer a `json` tool payload; otherwise the last non-empty assistant text."""
    for message in reversed(messages):
        from_call = _tool_call_payload(message)
        if from_call:
            return from_call
        if isinstance(message, ToolMessage) and getattr(message, "name", "") == JSON_TOOL_NAME:
            recovered = recover_json_tool_payload(message.content)
            if recovered:
                return recovered
        text = _text(getattr(message, "content", ""))
        if text.strip() and not isinstance(message, (HumanMessage, ToolMessage)):
            recovered = recover_json_tool_payload(text)
            return recovered or text
    return ""


def evidence_text(messages: list) -> str:
    evidence = [
        _clip(_text(m.content), MAX_EVIDENCE_CHARS)
        for m in messages
        if isinstance(m, ToolMessage) and getattr(m, "name", "") != JSON_TOOL_NAME
    ]
    return _clip("\n---\n".join(evidence), MAX_TOTAL_EVIDENCE_CHARS)


def _error_body(exc: Exception) -> dict:
    for attr in ("body", "error"):
        value = getattr(exc, attr, None)
        if isinstance(value, dict):
            return value
    response = getattr(exc, "response", None)
    if response is None:
        return {}
    try:
        data = response.json()
    except Exception:
        return {}
    return data if isinstance(data, dict) else {}


def recover_failed_generation(exc: Exception) -> str | None:
    body = _error_body(exc)
    error = body.get("error") if isinstance(body.get("error"), dict) else body
    failed = error.get("failed_generation") if isinstance(error, dict) else None
    if not failed:
        return None
    return recover_json_tool_payload(failed)


@wrap_tool_call
async def _clip_tool_output(request, handler):
    """Cap every tool result BEFORE it enters the message history."""
    result = await handler(request)
    if isinstance(result, ToolMessage):
        result = result.model_copy(
            update={"content": _clip(_text(result.content), MAX_TOOL_CHARS)}
        )
    return result


async def _final_answer_from_evidence(
    *, system_prompt: str, request: str, messages: list
) -> str:
    """Force a final JSON card using whatever the agent already gathered."""
    evidence_block = evidence_text(messages) or "(no tool results were obtained)"
    prompt = [
        SystemMessage(content=system_prompt),
        HumanMessage(
            content=(
                f"User request: {request}\n\n"
                f"Tool results gathered so far:\n{evidence_block}\n\n"
                "The research-tool budget is exhausted. Call the json tool once with "
                "the final answer in the required shape. Be honest about anything missing."
            )
        ),
    ]
    try:
        result = await invoke(
            get_llm().bind_tools([JSON_ANSWER_TOOL]),
            prompt,
            name="mcp_evidence_fallback",
        )
        answer = answer_from_messages([result])
        if answer:
            return answer
        return _text(result.content)
    except Exception as exc:
        recovered = recover_failed_generation(exc)
        if recovered:
            log.warning("evidence fallback recovered json tool payload after %s", type(exc).__name__)
            return recovered
        leftover = evidence_text(messages)
        if leftover:
            log.warning(
                "evidence fallback failed (%s); returning raw tool evidence",
                type(exc).__name__,
            )
            return leftover
        raise


async def _salvage(*, server_name: str, system_prompt: str, request: str, messages: list, exc: Exception) -> str:
    recovered = recover_failed_generation(exc) or answer_from_messages(messages)
    if recovered:
        log.warning(
            "%s agent recovered structured answer after %s",
            server_name,
            type(exc).__name__,
        )
        return recovered
    if evidence_text(messages):
        log.warning(
            "%s agent hit %s; answering from evidence",
            server_name,
            getattr(exc, "status_code", None) or type(exc).__name__,
        )
        return await _final_answer_from_evidence(
            system_prompt=system_prompt, request=request, messages=messages
        )
    raise exc


async def run_mcp_agent(
    *,
    server_name: str,
    system_prompt: str,
    request: str,
    tool_names: tuple[str, ...] | None = None,
    max_rounds: int = DEFAULT_TOOL_ROUNDS,
) -> str:
    """Run a single-purpose MCP agent and return its evidence-led result.

    tool_names: keep only tools whose name contains one of these substrings
                (e.g. ("search",)). Fewer tools = fewer schema tokens per call.
    """
    tools = await get_server_tools(server_name)
    if tool_names:
        tools = [t for t in tools if any(n in t.name for n in tool_names)]
    if not tools:
        raise RuntimeError(f"{server_name} MCP server exposed no matching tools")
    tools = [*tools, JSON_ANSWER_TOOL]
    log.info("%s agent tools: %s", server_name, [t.name for t in tools])

    agent = create_agent(
        get_llm(),
        tools,
        system_prompt=system_prompt + _budget_note(max_rounds),
        middleware=[_clip_tool_output],
    )

    messages: list = [HumanMessage(content=request)]
    try:
        async for state in agent.astream(
            {"messages": messages},
            {"recursion_limit": 2 * max_rounds + 4},
            stream_mode="values",
        ):
            messages = state["messages"]
    except GraphRecursionError:
        log.warning("%s agent hit recursion limit; forcing final answer", server_name)
        try:
            return await _final_answer_from_evidence(
                system_prompt=system_prompt, request=request, messages=messages
            )
        except Exception as exc:
            return await _salvage(
                server_name=server_name,
                system_prompt=system_prompt,
                request=request,
                messages=messages,
                exc=exc,
            )
    except Exception as exc:
        return await _salvage(
            server_name=server_name,
            system_prompt=system_prompt,
            request=request,
            messages=messages,
            exc=exc,
        )

    if len(messages) <= 1:
        raise RuntimeError("MCP agent returned no response")
    answer = answer_from_messages(messages)
    if answer:
        return answer
    leftover = evidence_text(messages)
    if leftover:
        return leftover
    raise RuntimeError("MCP agent returned no response")
