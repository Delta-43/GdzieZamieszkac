import pytest
from fastapi.testclient import TestClient

from app.core.store import DataStore, StoreUnavailable
from app.main import create_app
from tests.conftest import settings
from tests.fixtures import make_snapshot


class Clock:
    t = 0.0

    def __call__(self):
        return self.t


def test_reloads_only_when_the_version_changes_and_not_more_often_than_the_interval():
    clock, calls, state = Clock(), {"load": 0, "probe": 0}, {"version": "v1"}

    def loader():
        calls["load"] += 1
        return make_snapshot(state["version"])

    def probe():
        calls["probe"] += 1
        return state["version"]

    store = DataStore(loader, probe, refresh_seconds=60, clock=clock)
    assert store.get().snap.version == "v1" and calls == {"load": 1, "probe": 0}
    clock.t = 30
    store.get()
    assert calls["probe"] == 0  # inside the interval
    clock.t = 61
    store.get()
    assert calls == {"load": 1, "probe": 1}  # probed, unchanged, no reload
    state["version"], clock.t = "v2", 130
    assert store.get().snap.version == "v2" and calls["load"] == 2


def test_database_loss_keeps_serving_the_last_snapshot_and_health_says_degraded():
    clock, state = Clock(), {"down": False}
    snap = make_snapshot()

    def probe():
        if state["down"]:
            raise ConnectionError("database gone")
        return snap.version

    store = DataStore(lambda: snap, probe, refresh_seconds=10, clock=clock)
    with TestClient(create_app(settings(), store)) as c:
        assert c.get("/v1/health").json() == {"status": "ok", "database": "reachable"}
        state["down"], clock.t = True, 11
        assert c.get("/v1/districts").status_code == 200
        assert c.get("/v1/health").json() == {"status": "degraded", "database": "unreachable"}
        state["down"], clock.t = False, 22
        c.get("/v1/districts")
        assert c.get("/v1/health").json()["status"] == "ok"


def test_first_load_failure_answers_503_then_recovers():
    state = {"fail": True}
    snap = make_snapshot()

    def loader():
        if state["fail"]:
            raise ConnectionError("no database yet")
        return snap

    store = DataStore(loader, lambda: snap.version, refresh_seconds=10)
    with TestClient(create_app(settings(), store)) as c:  # startup must not crash
        r = c.get("/v1/districts")
        assert r.status_code == 503 and r.headers["content-type"].startswith("application/problem+json")
        assert c.get("/v1/health").status_code == 503
        state["fail"] = False
        assert c.get("/v1/districts").status_code == 200
        assert c.get("/v1/health").status_code == 200


def test_store_raises_when_nothing_could_ever_be_loaded():
    store = DataStore(lambda: (_ for _ in ()).throw(ConnectionError("x")), lambda: "v")
    with pytest.raises(StoreUnavailable):
        store.get()
