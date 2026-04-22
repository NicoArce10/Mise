"""Environment-backed settings.

Reads `.env` at the repo root so that `.env.example` serves as the single
source of truth for local configuration. In production the same variables
can be injected directly into the environment.

`.env` is also loaded into `os.environ` at import time. Pydantic's
BaseSettings reads `.env` for the typed settings object, but other code
paths (e.g. `api/processing.py` checking `MISE_PIPELINE_MODE` or
`ANTHROPIC_API_KEY` directly) use `os.environ.get(...)`. Without the
explicit load_dotenv call, those reads return None even though the key
is defined in `.env`, and the pipeline silently falls back to fixture
mode. load_dotenv is a no-op if the vars are already set in the real
environment (e.g. CI, Docker), so this is safe everywhere.
"""
from __future__ import annotations

from pathlib import Path

try:
    from dotenv import load_dotenv  # type: ignore[import-not-found]
except ImportError:  # pragma: no cover
    load_dotenv = None  # type: ignore[assignment]

from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent

if load_dotenv is not None:
    load_dotenv(REPO_ROOT / ".env", override=False)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=REPO_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-opus-4-7"

    api_host: str = "127.0.0.1"
    api_port: int = 8000

    cors_origins: str = "http://127.0.0.1:5173,http://localhost:5173"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
