
from functools import lru_cache

from langchain_groq import ChatGroq

from config import get_settings


@lru_cache
def get_llm() -> ChatGroq:
    settings = get_settings()

    return ChatGroq(
        model=settings.llm_model,
        api_key=settings.groq_key,
        temperature=0.2,
        max_retries=2,
        timeout=settings.request_timeout_seconds,
    )