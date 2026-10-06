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

    # ------------------------------------------------------------------
    # LLM / Groq
    # ------------------------------------------------------------------

    groq_api_key: SecretStr | None = None

    groq_supervisor_api_key: SecretStr | None = None
    groq_budget_api_key: SecretStr | None = None
    groq_itinerary_api_key: SecretStr | None = None
    groq_final_api_key: SecretStr | None = None
    groq_mcp_api_key: SecretStr | None = None
    groq_alt_mcp_api_key: SecretStr | None = None

    llm_model: str = "openai/gpt-oss-120b"

    # ------------------------------------------------------------------
    # External APIs
    # ------------------------------------------------------------------

    tavily_api_key: SecretStr
    aviationstack_api_key: SecretStr

    database_url: SecretStr

    aviationstack_base_url: str = "https://api.aviationstack.com/v1/flights"

    tavily_mcp_url: str = "https://mcp.tavily.com/mcp/"

    aviationstack_mcp_command: str = "uvx"
    aviationstack_mcp_package: str = "aviationstack-mcp"

    openweather_api_key: SecretStr | None = None

    # ------------------------------------------------------------------
    # Application defaults
    # ------------------------------------------------------------------

    default_origin_iata: str = "HYD"

    request_timeout_seconds: float = 20.0

    max_flight_results: int = Field(
        default=10,
        ge=1,
        le=100,
    )

    max_hotel_results: int = Field(
        default=5,
        ge=1,
        le=10,
    )

    # ------------------------------------------------------------------
    # Observability
    # ------------------------------------------------------------------

    langsmith_tracing: bool = True
    langsmith_project: str = "VoyageMesh"

    # ------------------------------------------------------------------
    # Application
    # ------------------------------------------------------------------

    frontend_url: str = "http://localhost:3000"
    environment: str = "development"

    supabase_url: str | None = None
    supabase_jwt_secret: SecretStr | None = None

    # ------------------------------------------------------------------
    # Generic API key properties
    # ------------------------------------------------------------------

    @property
    def groq_key(self) -> str:
        """
        Legacy Groq key.

        Kept for backwards compatibility only.
        New features should use the agent-specific properties.
        """
        if self.groq_api_key is None:
            raise ValueError(
                "GROQ_API_KEY is not configured. "
                "Use the dedicated GROQ_*_API_KEY settings."
            )

        return self.groq_api_key.get_secret_value()

    def _get_groq_agent_key(
        self,
        key: SecretStr | None,
        env_name: str,
    ) -> str:
        """
        Resolve a dedicated Groq API key.

        We do not silently fall back to GROQ_API_KEY because doing so would
        defeat rate-limit isolation.
        """
        if key is None:
            raise ValueError(
                f"{env_name} is not configured. "
                f"Each LLM agent must have its own Groq API key."
            )

        value = key.get_secret_value().strip()

        if not value:
            raise ValueError(f"{env_name} is configured but empty.")

        return value

    @property
    def groq_supervisor_key(self) -> str:
        return self._get_groq_agent_key(
            self.groq_supervisor_api_key,
            "GROQ_SUPERVISOR_API_KEY",
        )

    @property
    def groq_budget_key(self) -> str:
        return self._get_groq_agent_key(
            self.groq_budget_api_key,
            "GROQ_BUDGET_API_KEY",
        )

    @property
    def groq_itinerary_key(self) -> str:
        return self._get_groq_agent_key(
            self.groq_itinerary_api_key,
            "GROQ_ITINERARY_API_KEY",
        )

    @property
    def groq_final_key(self) -> str:
        return self._get_groq_agent_key(
            self.groq_final_api_key,
            "GROQ_FINAL_API_KEY",
        )

    @property
    def groq_mcp_key(self) -> str:
        return self._get_groq_agent_key(
            self.groq_mcp_api_key,
            "GROQ_MCP_API_KEY",
        )

    @property
    def groq_alt_mcp_key(self) -> str:
        return self._get_groq_agent_key(
            self.groq_alt_mcp_api_key,
            "GROQ_ALT_MCP_API_KEY",
        )

    # ------------------------------------------------------------------
    # Other API keys
    # ------------------------------------------------------------------

    @property
    def tavily_key(self) -> str:
        return self.tavily_api_key.get_secret_value()

    @property
    def aviationstack_key(self) -> str:
        return self.aviationstack_api_key.get_secret_value()

    @property
    def openweather_key(self) -> str:
        if self.openweather_api_key is None:
            return ""

        return self.openweather_api_key.get_secret_value()

    # ------------------------------------------------------------------
    # Environment
    # ------------------------------------------------------------------

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    # ------------------------------------------------------------------
    # Database
    # ------------------------------------------------------------------

    @property
    def postgres_url(self) -> str:
        url = self.database_url.get_secret_value().strip()

        if url.startswith("postgres://"):
            url = "postgresql://" + url[len("postgres://") :]

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

        query = dict(
            parse_qsl(
                parsed.query,
                keep_blank_values=True,
            )
        )

        if host not in {"localhost", "127.0.0.1"} and "sslmode" not in query:
            query["sslmode"] = "require"
            url = urlunparse(parsed._replace(query=urlencode(query)))

        return url


@lru_cache
def get_settings() -> Settings:
    return Settings()
