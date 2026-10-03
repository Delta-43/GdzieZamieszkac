"""Settings from the environment. `CITY` picks the Postgres schema this deployment serves (AGENTS.md: one deployment per city).

For local work the file server/config/.env is read first; real environment variables win. Values are never printed or logged.
`ENVIRONMENT=production` (the Docker image's default) makes the service fail fast on an unsafe configuration. A secret may be given as `NAME` or as
`NAME_FILE` (a path); in production only the read-only `API_DB_URL` is accepted, never `SUPABASE_DB_URL`.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

CITIES = {"warsaw": "Warszawa", "krakow": "Kraków"}
ENV_FILE = Path(__file__).resolve().parents[3] / "server" / "config" / ".env"


def _read_env_file() -> dict[str, str]:
    env: dict[str, str] = {}
    if ENV_FILE.exists():
        for raw in ENV_FILE.read_text().splitlines():
            line = raw.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip().strip('"').strip("'")
    return env


@dataclass(frozen=True)
class Settings:
    """Everything the service reads from its environment, validated by `load_settings`."""
    city: str
    db_url: str
    environment: str = "development"
    cors_origins: tuple[str, ...] = ("http://localhost:5173",)
    cache_max_age: int = 300
    refresh_seconds: int = 60
    rate_limit_per_minute: int = 600            # per client address, /v1 except /health; 0 disables (blunt: users can share an address)
    recommend_rate_limit_per_minute: int = 60   # per client address, POST /recommend (the only request-time computation); 0 disables
    trusted_proxy_hops: int = 0                 # reverse proxies in front of the service; 0 = use the socket address
    max_body_bytes: int = 16_384
    log_level: str = "INFO"

    @property
    def schema(self) -> str:
        return self.city  # the schema is the city; validated against CITIES

    @property
    def city_name(self) -> str:
        return CITIES[self.city]

    @property
    def production(self) -> bool:
        return self.environment == "production"


def _secret(env: dict[str, str], name: str) -> str:
    """The value of `name`, or the contents of the file named by `<name>_FILE` (the Docker secrets and mounted-file convention)."""
    if env.get(name):
        return env[name]
    path = env.get(f"{name}_FILE")
    if path:
        try:
            return Path(path).read_text().strip()
        except OSError as e:
            raise RuntimeError(f"{name}_FILE is set but the file cannot be read ({type(e).__name__})") from e
    return ""


def load_settings(env: dict[str, str] | None = None) -> Settings:
    """Settings from `env` if given (exactly that, nothing else: tests rely on it), else the .env file overlaid by the real environment."""
    merged = {**_read_env_file(), **os.environ} if env is None else env
    city = merged.get("CITY", "").lower()
    if city not in CITIES:
        raise RuntimeError(f"CITY must be one of {sorted(CITIES)}, got {city!r}")
    environment = merged.get("ENVIRONMENT", "development").lower()
    if environment not in ("development", "production"):
        raise RuntimeError("ENVIRONMENT must be 'development' or 'production'")
    raw_origins = merged.get("CORS_ORIGINS", "" if environment == "production" else "http://localhost:5173")
    origins = tuple(o.strip().rstrip("/") for o in raw_origins.split(",") if o.strip())
    if environment == "production":
        if not origins:
            raise RuntimeError("CORS_ORIGINS must list the frontend origin of this city in production")
        bad = [o for o in origins if o == "*" or not o.startswith("https://")]
        if bad:
            raise RuntimeError("CORS_ORIGINS must be explicit https origins in production (no '*', no http)")
    db_url = _secret(merged, "API_DB_URL")  # a read-only role
    if environment == "production":
        if not db_url:
            raise RuntimeError("API_DB_URL (or API_DB_URL_FILE) must be set in production: the backend only uses the read-only role")
    else:
        db_url = db_url or merged.get("SUPABASE_DB_URL", "")  # development convenience: the write-capable URL from server/config/.env
    return Settings(city=city, db_url=db_url, environment=environment, cors_origins=origins,
                    cache_max_age=int(merged.get("CACHE_MAX_AGE", "300")), refresh_seconds=int(merged.get("REFRESH_SECONDS", "60")),
                    rate_limit_per_minute=int(merged.get("RATE_LIMIT_PER_MINUTE", "600")),
                    recommend_rate_limit_per_minute=int(merged.get("RECOMMEND_RATE_LIMIT_PER_MINUTE", "60")),
                    trusted_proxy_hops=int(merged.get("TRUSTED_PROXY_HOPS", "0")), max_body_bytes=int(merged.get("MAX_BODY_BYTES", "16384")),
                    log_level=merged.get("LOG_LEVEL", "INFO").upper())


@lru_cache
def get_settings() -> Settings:
    """The settings of this process, loaded once."""
    return load_settings()
