from __future__ import annotations

import logging

from langchain.agents import create_agent
from langchain.agents.middleware import wrap_tool_call
from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage
from langgraph.errors import GraphRecursionError

from llm.client import get_llm
from mcp_integrations.client import get_server_tools

log = logging.getLogger(__name__)

DEFAULT_TOOL_ROUNDS = 2
MAX_TOOL_CHARS = 3000  # per tool result entering the agent loop (~750 tokens)
MAX_EVIDENCE_CHARS = 3000  # per tool result in the fallback prompt
MAX_TOTAL_EVIDENCE_CHARS = 9000  # whole evidence block in the fallback prompt


def _budget_note(rounds: int) -> str:
    return (
        f"\n\nTOOL BUDGET: you may make at most {rounds} tool rounds in total. "
        "Do not retry a tool that returned an error or empty data with minor "
        "variations. If dates are missing, do not ask the user; research the route "
        "without a date, then answer. After gathering what you can, stop calling "
        "tools and give the final answer immediately."
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
    """Force a tool-free final answer using whatever the agent already gathered."""
    evidence = [
        _clip(_text(m.content), MAX_EVIDENCE_CHARS)
        for m in messages
        if isinstance(m, ToolMessage)
    ]
    evidence_block = _clip(
        "\n---\n".join(evidence) or "(no tool results were obtained)",
        MAX_TOTAL_EVIDENCE_CHARS,
    )
    result = await get_llm().ainvoke(
        [
            SystemMessage(content=system_prompt),
            HumanMessage(
                content=(
                    f"User request: {request}\n\n"
                    f"Tool results gathered so far:\n{evidence_block}\n\n"
                    "The tool budget is exhausted. Do NOT call tools. Using only "
                    "the evidence above, produce the final answer in the required "
                    "format. Be honest about anything missing."
                )
            ),
        ]
    )
    return _text(result.content)


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
            {"recursion_limit": 2 * max_rounds + 3},
            stream_mode="values",
        ):
            messages = state["messages"]
    except GraphRecursionError:
        log.warning("%s agent hit recursion limit; forcing final answer", server_name)
        return await _final_answer_from_evidence(
            system_prompt=system_prompt, request=request, messages=messages
        )
    except Exception as exc:
        # 413 = request too large, 429 = rate limited. If we already have
        # evidence, salvage it with one small tool-free call instead of failing.
        status = getattr(exc, "status_code", None)
        has_evidence = any(isinstance(m, ToolMessage) for m in messages)
        if status in (413, 429) and has_evidence:
            log.warning(
                "%s agent hit HTTP %s; answering from evidence", server_name, status
            )
            return await _final_answer_from_evidence(
                system_prompt=system_prompt, request=request, messages=messages
            )
        raise

    if len(messages) <= 1:
        raise RuntimeError("MCP agent returned no response")
    return _text(messages[-1].content)
