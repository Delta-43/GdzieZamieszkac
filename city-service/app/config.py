"""Settings from the environment. For local work server/config/.env is read first; real environment variables win.

Values are never printed or logged. A secret may be given as `NAME` or as `NAME_FILE` (a path).
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

ENV_FILE = Path(__file__).resolve().parents[2] / "server" / "config" / ".env"


def _read_env_file() -> dict[str, str]:
    env: dict[str, str] = {}
    if ENV_FILE.exists():
        for raw in ENV_FILE.read_text().splitlines():
            line = raw.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def _secret(env: dict[str, str], name: str) -> str:
    if env.get(name):
        return env[name]
    path = env.get(f"{name}_FILE")
    if path:
        try:
            return Path(path).read_text().strip()
        except OSError as e:
            raise RuntimeError(f"{name}_FILE is set but the file cannot be read ({type(e).__name__})") from e
    return ""


@dataclass(frozen=True)
class Settings:
    api_base_url: str = "http://localhost:8000/v1"   # the read-only API this service reads facts from
    openrouter_key: str = ""                          # OPENROUTER_LLM_KEY; empty turns the AI report off (503)
    openrouter_url: str = "https://openrouter.ai/api/v1/chat/completions"
    model: str = "z-ai/glm-5.3-flash"
    feedback_db_path: str = str(Path(__file__).resolve().parents[1] / "data" / "feedback.sqlite")  # city-service/data/, git-ignored
    environment: str = "development"
    cors_origins: tuple[str, ...] = ("http://localhost:5173",)
    ai_rate_limit_per_minute: int = 10                # all clients share one bucket (tailnet proxy); 0 disables
    feedback_rate_limit_per_minute: int = 30
    max_body_bytes: int = 8_192
    llm_timeout_seconds: float = 40.0

    @property
    def production(self) -> bool:
        return self.environment == "production"


def load_settings(env: dict[str, str] | None = None) -> Settings:
    """Settings from `env` if given (exactly that: tests rely on it), else the .env file overlaid by the real environment."""
    m = {**_read_env_file(), **os.environ} if env is None else env
    environment = m.get("ENVIRONMENT", "development").lower()
    if environment not in ("development", "production"):
        raise RuntimeError("ENVIRONMENT must be 'development' or 'production'")
    raw = m.get("CITY_SERVICE_CORS_ORIGINS", "" if environment == "production" else "http://localhost:5173")
    origins = tuple(o.strip().rstrip("/") for o in raw.split(",") if o.strip())
    if environment == "production" and (not origins or any(o == "*" for o in origins)):
        raise RuntimeError("CITY_SERVICE_CORS_ORIGINS must list explicit origins in production (no '*')")
    default_db = "/data/feedback.sqlite" if environment == "production" else Settings.feedback_db_path
    return Settings(
        api_base_url=m.get("API_BASE_URL", Settings.api_base_url).rstrip("/"),
        openrouter_key=_secret(m, "OPENROUTER_LLM_KEY"),
        model=m.get("OPENROUTER_MODEL", Settings.model),
        feedback_db_path=m.get("FEEDBACK_DB_PATH", default_db),
        environment=environment, cors_origins=origins,
        ai_rate_limit_per_minute=int(m.get("AI_RATE_LIMIT_PER_MINUTE", "10")),
        feedback_rate_limit_per_minute=int(m.get("FEEDBACK_RATE_LIMIT_PER_MINUTE", "30")),
        max_body_bytes=int(m.get("MAX_BODY_BYTES", "8192")),
    )


@lru_cache
def get_settings() -> Settings:
    return load_settings()
