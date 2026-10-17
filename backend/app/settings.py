"""Environment-backed application settings."""

from pathlib import Path

from pydantic import AnyHttpUrl, Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=REPOSITORY_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
        validate_default=True,
    )

    qloo_api_key: SecretStr | None = None
    qloo_base_url: AnyHttpUrl = Field(default=AnyHttpUrl("https://hackathon.api.qloo.com"))
    qloo_timeout_seconds: float = Field(default=30, gt=0, le=120)
    qloo_max_retries: int = Field(default=2, ge=0, le=4)
    qloo_retry_backoff_seconds: float = Field(default=0.5, ge=0, le=10)

    llm_base_url: AnyHttpUrl | None = None
    llm_api_key: SecretStr | None = None
    llm_model: str | None = Field(default=None, min_length=1, max_length=200)
    llm_fallback_base_url: AnyHttpUrl | None = None
    llm_fallback_api_key: SecretStr | None = None
    llm_fallback_model: str | None = Field(default=None, min_length=1, max_length=200)
    llm_timeout_seconds: float = Field(default=45, gt=0, le=180)
    llm_max_retries: int = Field(default=1, ge=0, le=3)
    llm_retry_backoff_seconds: float = Field(default=0.5, ge=0, le=10)
    llm_min_request_interval_seconds: float = Field(default=1, ge=0, le=60)
    llm_invalid_output_retries: int = Field(default=1, ge=0, le=2)
    llm_http_referer: str | None = Field(default=None, max_length=500)
    llm_app_title: str | None = Field(default="Vyuha", max_length=100)

    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    max_request_bytes: int = Field(default=1_048_576, ge=1_024, le=10_485_760)
    analysis_per_ip_daily_limit: int = Field(default=10, ge=1, le=10_000)
    analysis_daily_limit: int = Field(default=100, ge=1, le=100_000)
    vyuha_saved_run_path: Path | None = None
    log_level: str = Field(default="INFO", pattern=r"^(DEBUG|INFO|WARNING|ERROR|CRITICAL)$")

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


def get_settings() -> Settings:
    return Settings()
