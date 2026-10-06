from functools import lru_cache

from langchain_groq import ChatGroq

from config import get_settings

DEFAULT_TEMPERATURE = 0.2
DEFAULT_MAX_RETRIES = 2


def _create_groq_client(api_key: str) -> ChatGroq:
    settings = get_settings()

    return ChatGroq(
        model=settings.llm_model,
        api_key=api_key,
        temperature=DEFAULT_TEMPERATURE,
        max_retries=DEFAULT_MAX_RETRIES,
        timeout=settings.request_timeout_seconds,
    )


@lru_cache
def get_supervisor_llm() -> ChatGroq:
    settings = get_settings()

    return _create_groq_client(settings.groq_supervisor_key)


@lru_cache
def get_budget_llm() -> ChatGroq:
    settings = get_settings()

    return _create_groq_client(settings.groq_budget_key)


@lru_cache
def get_itinerary_llm() -> ChatGroq:
    settings = get_settings()

    return _create_groq_client(settings.groq_itinerary_key)


@lru_cache
def get_final_llm() -> ChatGroq:
    settings = get_settings()

    return _create_groq_client(settings.groq_final_key)


@lru_cache
def get_mcp_llm() -> ChatGroq:
    """
    Shared only by MCP-backed research agents.

    Flight, hotel and weather all intentionally use this same client
    because the MCP execution layer is centralized in agent_runner.py.
    """
    settings = get_settings()

    return _create_groq_client(settings.groq_mcp_key)


@lru_cache
def get_alt_mcp_llm() -> ChatGroq:
    """
    Shared only by MCP-backed research agents.

    Flight, hotel and weather all intentionally use this same client
    because the MCP execution layer is centralized in agent_runner.py.
    """
    settings = get_settings()

    return _create_groq_client(settings.groq_alt_mcp_key)


# Backwards compatibility


@lru_cache
def get_llm() -> ChatGroq:
    """
    Deprecated compatibility alias.

    New agents MUST use their dedicated getter.

    Keeping this temporarily prevents unrelated legacy imports from
    immediately breaking while the agent modules are migrated.
    """
    return get_supervisor_llm()
