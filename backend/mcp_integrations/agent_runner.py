from __future__ import annotations

from langchain_core.messages import HumanMessage
from langchain.agents import create_agent

from llm.client import get_llm
from mcp_integrations.client import get_server_tools


async def run_mcp_agent(*, server_name: str, system_prompt: str, request: str) -> str:
    """Run a single-purpose MCP agent and return its evidence-led result.

    The LangGraph prebuilt agent performs tool selection, but its recursion is
    bounded to prevent an unavailable provider from causing unbounded work.
    """
    tools = await get_server_tools(server_name)
    if not tools:
        raise RuntimeError(f"{server_name} MCP server exposed no tools")

    agent = create_agent(
        get_llm(),
        tools,
        prompt=system_prompt,
    )
    result = await agent.ainvoke(
        {"messages": [HumanMessage(content=request)]},
        {"recursion_limit": 8},
    )
    messages = result.get("messages", [])
    if not messages:
        raise RuntimeError("MCP agent returned no response")
    content = messages[-1].content
    return content if isinstance(content, str) else str(content)
