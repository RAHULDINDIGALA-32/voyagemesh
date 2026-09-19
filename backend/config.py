
from functools import lru_cache

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    groq_api_key: SecretStr
    tavily_api_key: SecretStr
    aviationstack_api_key: SecretStr

    database_url: SecretStr

    llm_model: str = "openai/gpt-oss-120b"

    aviationstack_base_url: str = (
        "https://api.aviationstack.com/v1/flights"
    )
    default_origin_iata: str = "HYD"

    request_timeout_seconds: float = 20.0
    max_flight_results: int = Field(default=10, ge=1, le=100)
    max_hotel_results: int = Field(default=5, ge=1, le=10)

    langsmith_tracing: bool = True
    langsmith_project: str = "VoyageMesh"

    @property
    def groq_key(self) -> str:
        return self.groq_api_key.get_secret_value()

    @property
    def tavily_key(self) -> str:
        return self.tavily_api_key.get_secret_value()

    @property
    def aviationstack_key(self) -> str:
        return self.aviationstack_api_key.get_secret_value()

    @property
    def postgres_url(self) -> str:
        return self.database_url.get_secret_value()


@lru_cache
def get_settings() -> Settings:
    return Settings()