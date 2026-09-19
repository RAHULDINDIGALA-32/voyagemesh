from functools import lru_cache
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

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

    frontend_url: str = "http://localhost:3000"
    environment: str = "development"

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
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def postgres_url(self) -> str:
        url = self.database_url.get_secret_value().strip()

        if url.startswith("postgres://"):
            url = "postgresql://" + url[len("postgres://"):]

        for dialect in (
            "postgresql+psycopg2://",
            "postgresql+psycopg://",
            "postgresql+asyncpg://",
        ):
            if url.startswith(dialect):
                url = "postgresql://" + url.split("://", 1)[1]
                break

        parsed = urlparse(url)
        host = (parsed.hostname or "").lower()
        query = dict(parse_qsl(parsed.query, keep_blank_values=True))

        if host not in {"localhost", "127.0.0.1"} and "sslmode" not in query:
            query["sslmode"] = "require"
            url = urlunparse(parsed._replace(query=urlencode(query)))

        return url


@lru_cache
def get_settings() -> Settings:
    return Settings()