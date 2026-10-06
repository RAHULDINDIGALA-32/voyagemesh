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
from llm.client import get_alt_mcp_llm, get_mcp_llm
from llm.utils import invoke
from mcp_integrations.client import get_server_tools

log = logging.getLogger(__name__)


DEFAULT_TOOL_ROUNDS = 2

# Per tool result entering the agent loop.
MAX_TOOL_CHARS = 3000

# Per tool result in the fallback prompt.
MAX_EVIDENCE_CHARS = 3000

# Maximum combined evidence sent to the fallback LLM.
MAX_TOTAL_EVIDENCE_CHARS = 9000

JSON_TOOL_NAME = "json"


class JsonAnswer(BaseModel):
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


# Groq serializes structured answers as a tool call named `json`.
#
# Registering it prevents `tool_use_failed` and allows us to recover
# the structured payload from the tool call.
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
    """
    Normalize message content (str or list of content blocks) to plain text.
    """

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
    """
    Normalize a possible JSON tool payload into a JSON string.
    """

    if isinstance(value, dict):
        if value.get("name") == JSON_TOOL_NAME and isinstance(
            value.get("arguments"),
            dict,
        ):
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
    """
    Pull a JSON card out of a gpt-oss `json` tool call
    or Groq failed_generation.
    """

    return _as_json_text(raw)


def _tool_call_payload(message: Any) -> str | None:
    """
    Extract a `json` tool call from an AI message.
    """

    for call in getattr(message, "tool_calls", None) or []:
        if isinstance(call, dict):
            name = call.get("name")
            args = call.get("args")
        else:
            name = getattr(call, "name", "")
            args = getattr(call, "args", None)

        if name == JSON_TOOL_NAME and args is not None:
            return recover_json_tool_payload(args)

    kwargs = getattr(message, "additional_kwargs", None) or {}

    function_call = kwargs.get("function_call") or {}

    if function_call.get("name") == JSON_TOOL_NAME:
        return recover_json_tool_payload(function_call.get("arguments"))

    return None


def answer_from_messages(messages: list) -> str:
    """
    Prefer a `json` tool payload.

    Otherwise return the last non-empty assistant text.
    """

    for message in reversed(messages):
        from_call = _tool_call_payload(message)

        if from_call:
            return from_call

        if (
            isinstance(message, ToolMessage)
            and getattr(message, "name", "") == JSON_TOOL_NAME
        ):
            recovered = recover_json_tool_payload(message.content)

            if recovered:
                return recovered

        text = _text(getattr(message, "content", ""))

        if text.strip() and not isinstance(message, (HumanMessage, ToolMessage)):
            recovered = recover_json_tool_payload(text)

            return recovered or text

    return ""


def evidence_text(messages: list) -> str:
    """
    Extract research-tool evidence from the message history.
    """

    evidence = [
        _clip(
            _text(message.content),
            MAX_EVIDENCE_CHARS,
        )
        for message in messages
        if (
            isinstance(message, ToolMessage)
            and getattr(message, "name", "") != JSON_TOOL_NAME
        )
    ]

    return _clip(
        "\n---\n".join(evidence),
        MAX_TOTAL_EVIDENCE_CHARS,
    )


def _error_body(exc: Exception) -> dict:
    """
    Extract a structured error body from an SDK/API exception.
    """

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


def _is_rate_limit_error(exc: Exception) -> bool:
    """
    Detect Groq/API rate-limit failures.

    Handles:
    - HTTP 429
    - SDK RateLimitError
    - structured API error bodies
    """

    # Standard HTTP/API status.
    if getattr(exc, "status_code", None) == 429:
        return True

    # Some SDK exceptions expose the HTTP response.
    response = getattr(exc, "response", None)

    if response is not None:
        status_code = getattr(response, "status_code", None)

        if status_code == 429:
            return True

    # SDK class-name fallback.
    if type(exc).__name__ == "RateLimitError":
        return True

    # Inspect structured Groq error payload.
    body = _error_body(exc)

    error = body.get("error") if isinstance(body.get("error"), dict) else body

    if isinstance(error, dict):
        code = str(error.get("code", "")).lower()

        if code in {
            "rate_limit_exceeded",
            "rate_limit",
            "too_many_requests",
        }:
            return True

        message = str(error.get("message", "")).lower()

        if "rate limit" in message:
            return True

    return False


def recover_failed_generation(exc: Exception) -> str | None:
    """
    Recover a structured JSON answer from Groq's failed_generation
    payload when possible.
    """

    body = _error_body(exc)

    error = body.get("error") if isinstance(body.get("error"), dict) else body

    failed = error.get("failed_generation") if isinstance(error, dict) else None

    if not failed:
        return None

    return recover_json_tool_payload(failed)


@wrap_tool_call
async def _clip_tool_output(request, handler):
    """
    Cap every tool result BEFORE it enters the message history.

    This is important because large MCP responses consume tokens
    on every subsequent LLM call.
    """

    result = await handler(request)

    if isinstance(result, ToolMessage):
        result = result.model_copy(
            update={
                "content": _clip(
                    _text(result.content),
                    MAX_TOOL_CHARS,
                )
            }
        )

    return result


def _build_mcp_agent(
    *,
    llm,
    tools: list,
    system_prompt: str,
):
    """
    Build an MCP agent using the supplied LLM client.

    Keeping agent construction in one place makes primary/alternate
    failover deterministic and avoids duplicating configuration.
    """

    return create_agent(
        llm,
        tools,
        system_prompt=system_prompt,
        middleware=[_clip_tool_output],
    )


async def _stream_mcp_agent(
    *,
    agent,
    messages: list,
    max_rounds: int,
) -> list:
    """
    Execute the MCP agent and return the latest message state.

    This helper intentionally does not perform recovery. The caller
    needs to know whether the failure came from the primary or
    alternate LLM before deciding what to do.
    """

    current_messages = list(messages)

    async for state in agent.astream(
        {"messages": current_messages},
        {
            "recursion_limit": 2 * max_rounds + 4,
        },
        stream_mode="values",
    ):
        current_messages = state["messages"]

    return current_messages


async def _final_answer_from_evidence(
    *,
    system_prompt: str,
    request: str,
    messages: list,
    llm=None,
) -> str:
    """
    Force a final JSON card using whatever research evidence
    the agent has already gathered.

    `llm` is injectable so rate-limit recovery can use the
    alternate MCP client rather than accidentally hitting the
    already-rate-limited primary client again.
    """

    evidence_block = evidence_text(messages) or "(no tool results were obtained)"

    prompt = [
        SystemMessage(content=system_prompt),
        HumanMessage(
            content=(
                f"User request: {request}\n\n"
                f"Tool results gathered so far:\n"
                f"{evidence_block}\n\n"
                "The research-tool budget is exhausted. "
                "Call the json tool once with the final answer "
                "in the required shape. Be honest about anything missing."
            )
        ),
    ]

    selected_llm = llm or get_mcp_llm()

    try:
        result = await invoke(
            selected_llm.bind_tools([JSON_ANSWER_TOOL]),
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
            log.warning(
                "evidence fallback recovered json tool payload after %s",
                type(exc).__name__,
            )

            return recovered

        leftover = evidence_text(messages)

        if leftover:
            log.warning(
                "evidence fallback failed (%s); " "returning raw tool evidence",
                type(exc).__name__,
            )

            return leftover

        raise


async def _salvage(
    *,
    server_name: str,
    system_prompt: str,
    request: str,
    messages: list,
    exc: Exception,
    fallback_llm=None,
) -> str:
    """
    Attempt to recover a useful answer after an agent failure.

    `fallback_llm` allows the caller to explicitly select the
    alternate MCP client after a primary rate-limit failure.
    """

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
            system_prompt=system_prompt,
            request=request,
            messages=messages,
            llm=fallback_llm,
        )

    raise exc


async def _run_with_alternate_mcp(
    *,
    server_name: str,
    system_prompt: str,
    request: str,
    tools: list,
    messages: list,
    max_rounds: int,
) -> str:
    """
    Retry an MCP agent using the alternate Groq MCP client.

    This function is called ONLY after the primary MCP client
    hits a rate limit.

    The existing message history is preserved so successful
    MCP tool calls do not need to be repeated unnecessarily.
    """

    log.warning(
        "%s MCP agent switching from primary client "
        "to alternate MCP client after rate limit",
        server_name,
    )

    alt_agent = _build_mcp_agent(
        llm=get_alt_mcp_llm(),
        tools=tools,
        system_prompt=system_prompt,
    )

    try:
        alt_messages = await _stream_mcp_agent(
            agent=alt_agent,
            messages=messages,
            max_rounds=max_rounds,
        )

    except GraphRecursionError:
        log.warning(
            "%s alternate MCP agent hit recursion limit; "
            "forcing final answer from gathered evidence",
            server_name,
        )

        try:
            return await _final_answer_from_evidence(
                system_prompt=system_prompt,
                request=request,
                messages=messages,
                llm=get_alt_mcp_llm(),
            )
        except Exception as exc:
            return await _salvage(
                server_name=server_name,
                system_prompt=system_prompt,
                request=request,
                messages=messages,
                exc=exc,
                fallback_llm=get_alt_mcp_llm(),
            )

    except Exception as alt_exc:
        # IMPORTANT:
        #
        # Never switch back to the primary client here.
        # Otherwise:
        #
        # primary -> 429 -> alternate -> failure -> primary
        #
        # could create an unintended retry loop.
        return await _salvage(
            server_name=server_name,
            system_prompt=system_prompt,
            request=request,
            messages=messages,
            exc=alt_exc,
            fallback_llm=(get_alt_mcp_llm() if evidence_text(messages) else None),
        )

    if len(alt_messages) <= 1:
        raise RuntimeError(f"{server_name} alternate MCP agent returned no response")

    answer = answer_from_messages(alt_messages)

    if answer:
        log.info(
            "%s MCP agent successfully recovered using " "alternate client",
            server_name,
        )

        return answer

    leftover = evidence_text(alt_messages)

    if leftover:
        return leftover

    raise RuntimeError(f"{server_name} alternate MCP agent returned no response")


async def run_mcp_agent(
    *,
    server_name: str,
    system_prompt: str,
    request: str,
    tool_names: tuple[str, ...] | None = None,
    max_rounds: int = DEFAULT_TOOL_ROUNDS,
) -> str:
    """
    Run a single-purpose MCP agent and return its evidence-led result.

    Architecture:

        Primary MCP LLM
              |
              | success
              v
          MCP result

              |
              | 429
              v
        Alternate MCP LLM
              |
              v
          MCP result

    tool_names:
        Keep only tools whose name contains one of these substrings.

        Example:
            ("search",)

        Fewer tools means fewer schema tokens per LLM request.
    """

    tools = await get_server_tools(server_name)

    if tool_names:
        tools = [
            tool for tool in tools if any(name in tool.name for name in tool_names)
        ]

    if not tools:
        raise RuntimeError(f"{server_name} MCP server exposed no matching tools")

    # Register the final JSON tool alongside the MCP research tools.
    tools = [
        *tools,
        JSON_ANSWER_TOOL,
    ]

    log.info(
        "%s agent tools: %s",
        server_name,
        [tool.name for tool in tools],
    )

    mcp_system_prompt = system_prompt + _budget_note(max_rounds)

    messages: list = [HumanMessage(content=request)]

    # ---------------------------------------------------------
    # PRIMARY MCP CLIENT
    # ---------------------------------------------------------

    primary_agent = _build_mcp_agent(
        llm=get_mcp_llm(),
        tools=tools,
        system_prompt=mcp_system_prompt,
    )

    try:
        messages = await _stream_mcp_agent(
            agent=primary_agent,
            messages=messages,
            max_rounds=max_rounds,
        )

    except GraphRecursionError:
        log.warning(
            "%s agent hit recursion limit; " "forcing final answer",
            server_name,
        )

        try:
            return await _final_answer_from_evidence(
                system_prompt=system_prompt,
                request=request,
                messages=messages,
                llm=get_mcp_llm(),
            )

        except Exception as exc:
            # If the fallback itself was rate limited,
            # use the alternate MCP client rather than calling
            # the already exhausted primary key again.
            if _is_rate_limit_error(exc):
                log.warning(
                    "%s primary evidence fallback hit rate limit; "
                    "switching to alternate MCP client",
                    server_name,
                )

                try:
                    return await _final_answer_from_evidence(
                        system_prompt=system_prompt,
                        request=request,
                        messages=messages,
                        llm=get_alt_mcp_llm(),
                    )
                except Exception as alt_exc:
                    return await _salvage(
                        server_name=server_name,
                        system_prompt=system_prompt,
                        request=request,
                        messages=messages,
                        exc=alt_exc,
                        fallback_llm=get_alt_mcp_llm(),
                    )

            return await _salvage(
                server_name=server_name,
                system_prompt=system_prompt,
                request=request,
                messages=messages,
                exc=exc,
            )

    except Exception as exc:
        # -----------------------------------------------------
        # PRIMARY RATE LIMIT
        # -----------------------------------------------------

        if _is_rate_limit_error(exc):
            log.warning(
                "%s primary MCP client hit rate limit; "
                "attempting alternate MCP client",
                server_name,
            )

            return await _run_with_alternate_mcp(
                server_name=server_name,
                system_prompt=mcp_system_prompt,
                request=request,
                tools=tools,
                messages=messages,
                max_rounds=max_rounds,
            )

        # -----------------------------------------------------
        # NON-RATE-LIMIT FAILURE
        # -----------------------------------------------------

        return await _salvage(
            server_name=server_name,
            system_prompt=system_prompt,
            request=request,
            messages=messages,
            exc=exc,
        )

    # ---------------------------------------------------------
    # PRIMARY CLIENT COMPLETED SUCCESSFULLY
    # ---------------------------------------------------------

    if len(messages) <= 1:
        raise RuntimeError(f"{server_name} MCP agent returned no response")

    answer = answer_from_messages(messages)

    if answer:
        return answer

    leftover = evidence_text(messages)

    if leftover:
        return leftover

    raise RuntimeError(f"{server_name} MCP agent returned no response")
