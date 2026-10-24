import os
import sys
from pathlib import Path

import pytest
import yaml
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from datetime import datetime

import app.core.store as store_module
from app.core.config import Settings
from app.core.store import DataStore
from app.main import create_app
from tests.fixtures import NOW, make_snapshot

SPEC_PATH = Path(__file__).resolve().parents[1] / "openapi.yaml"


class _FrozenDatetime(datetime):
    """datetime whose now() is the fixtures' NOW, so staleness does not depend on the day the suite runs."""

    @classmethod
    def now(cls, tz=None):
        return NOW if tz else NOW.replace(tzinfo=None)


@pytest.fixture(autouse=True)
def _frozen_clock(monkeypatch):
    monkeypatch.setattr(store_module, "datetime", _FrozenDatetime)


@pytest.fixture(scope="session")
def spec_dict():
    return yaml.safe_load(SPEC_PATH.read_text(encoding="utf-8"))


def settings(city="warsaw") -> Settings:
    return Settings(city=city, db_url="", cors_origins=("http://localhost:5173",), cache_max_age=300, refresh_seconds=60)


@pytest.fixture
def snap():
    return make_snapshot()


@pytest.fixture
def client(snap):
    store = DataStore(lambda: snap, lambda: snap.version, refresh_seconds=60)
    with TestClient(create_app(settings(), store)) as c:
        yield c


def live_settings(city: str) -> Settings:
    from app.core.config import _read_env_file, load_settings
    env = {**_read_env_file(), **{k: v for k, v in os.environ.items() if k in ("API_DB_URL", "SUPABASE_DB_URL")}}
    return load_settings({**env, "CITY": city, "RATE_LIMIT_PER_MINUTE": "0", "RECOMMEND_RATE_LIMIT_PER_MINUTE": "0"})  # the suite sends hundreds of requests


def have_db() -> bool:
    from app.core.config import _read_env_file
    return bool(os.environ.get("SUPABASE_DB_URL") or _read_env_file().get("SUPABASE_DB_URL"))
