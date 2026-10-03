"""Production protections: security headers, request ids, safe errors, rate limits, body limit, compression, ETag handling, CORS, settings."""
import json
import logging

import pytest
from fastapi.testclient import TestClient

from app.core.config import load_settings
from app.core.middleware import RateLimiter, client_key, etag_matches
from app.core.store import DataStore
from app.main import create_app
from tests.conftest import settings
from tests.fixtures import make_snapshot


def make_client(**overrides):
    base = settings()
    cfg = type(base)(**{**base.__dict__, **overrides})
    snap = make_snapshot()
    return TestClient(create_app(cfg, DataStore(lambda: snap, lambda: snap.version)), raise_server_exceptions=False)


# ---------------------------------------------------------------- headers and request ids

def test_security_headers_on_every_kind_of_response(client):
    for r in (client.get("/v1/districts"), client.get("/v1/districts/nowhere"), client.get("/v1/districts?lang=de"), client.get("/elsewhere")):
        assert r.headers["x-content-type-options"] == "nosniff" and r.headers["x-frame-options"] == "DENY"
        assert r.headers["referrer-policy"] == "no-referrer" and "default-src 'none'" in r.headers["content-security-policy"]
        assert "strict-transport-security" not in r.headers  # development


def test_hsts_only_in_production():
    with make_client(environment="production", cors_origins=("https://app.example",)) as c:
        assert c.get("/v1/districts").headers["strict-transport-security"].startswith("max-age=")


def test_request_id_is_generated_echoed_and_sanitised(client):
    assert len(client.get("/v1/districts").headers["x-request-id"]) == 32
    assert client.get("/v1/districts", headers={"X-Request-ID": "trace-123.abc"}).headers["x-request-id"] == "trace-123.abc"
    assert client.get("/v1/districts", headers={"X-Request-ID": "bad id with spaces\tand\x7f"}).headers["x-request-id"] != "bad id with spaces"


def test_access_log_is_json_and_holds_nothing_personal(client, capfd):
    client.get("/v1/districts?lang=pl", headers={"X-Request-ID": "log-test-1", "Accept-Language": "pl", "User-Agent": "secret-agent"})
    line = next(ln for ln in capfd.readouterr().out.splitlines() if "log-test-1" in ln)
    entry = json.loads(line)
    assert entry["event"] == "request" and entry["status"] == 200 and entry["path"] == "/v1/districts" and entry["request_id"] == "log-test-1"
    assert "secret-agent" not in line and "testclient" not in line and "127.0.0.1" not in line  # no headers, no client address


def test_unexpected_errors_become_a_safe_500(client, capfd):
    def boom(*_a, **_k):
        raise RuntimeError("database password is hunter2")
    client.app.state.store.get = boom  # any route that touches the store now fails unexpectedly
    r = client.get("/v1/districts")
    assert r.status_code == 500 and r.headers["content-type"].startswith("application/problem+json")
    body = r.json()
    assert body["title"] == "Internal error" and "hunter2" not in r.text and "Traceback" not in r.text
    assert r.headers["x-request-id"] in body["detail"]
    assert "hunter2" in capfd.readouterr().out  # the detail goes to the log only


# ---------------------------------------------------------------- rate limiting

def test_token_bucket_blocks_then_refills():
    now = [0.0]
    limiter = RateLimiter(60, clock=lambda: now[0])  # 1 token per second, burst 60
    assert all(limiter.check("a") is None for _ in range(60))
    wait = limiter.check("a")
    assert wait is not None and 0 < wait <= 1.0
    assert limiter.check("b") is None  # another client is unaffected
    now[0] = 2.0
    assert limiter.check("a") is None


def test_rate_limit_answers_429_with_retry_after_and_spares_health():
    with make_client(rate_limit_per_minute=5) as c:
        codes = [c.get("/v1/districts").status_code for _ in range(8)]
        assert codes[:5] == [200] * 5 and set(codes[5:]) == {429}
        r = c.get("/v1/districts")
        assert r.headers["content-type"].startswith("application/problem+json") and int(r.headers["retry-after"]) >= 1
        assert r.headers["x-content-type-options"] == "nosniff"
        assert c.get("/v1/health").status_code == 200
        assert c.options("/v1/districts", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"}).status_code == 200


def test_recommend_has_its_own_stricter_limit():
    with make_client(recommend_rate_limit_per_minute=2) as c:
        assert [c.post("/v1/recommend").status_code for _ in range(4)] == [200, 200, 429, 429]
        assert c.get("/v1/districts").status_code == 200


def test_429_reaches_the_browser_with_cors_headers():
    with make_client(rate_limit_per_minute=1) as c:
        c.get("/v1/districts")
        r = c.get("/v1/districts", headers={"Origin": "http://localhost:5173"})
        assert r.status_code == 429 and r.headers["access-control-allow-origin"] == "http://localhost:5173"


def test_limit_key_uses_the_right_hop_behind_trusted_proxies():
    class Req:
        def __init__(self, xff, host="10.0.0.1"):
            self.headers, self.client = ({"x-forwarded-for": xff} if xff else {}), type("C", (), {"host": host})()
    assert client_key(Req("1.1.1.1, 2.2.2.2"), 0) == "10.0.0.1"    # no trusted proxy: the header is ignored (it could be forged)
    assert client_key(Req("9.9.9.9, 2.2.2.2"), 1) == "2.2.2.2"     # the proxy appended the real client address
    assert client_key(Req("9.9.9.9, 2.2.2.2, 3.3.3.3"), 2) == "2.2.2.2"
    assert client_key(Req(None), 1) == "10.0.0.1"


def test_limits_are_per_client_behind_a_proxy():
    with make_client(rate_limit_per_minute=1, trusted_proxy_hops=1) as c:
        assert c.get("/v1/districts", headers={"X-Forwarded-For": "5.5.5.5"}).status_code == 200
        assert c.get("/v1/districts", headers={"X-Forwarded-For": "5.5.5.5"}).status_code == 429
        assert c.get("/v1/districts", headers={"X-Forwarded-For": "6.6.6.6"}).status_code == 200


# ---------------------------------------------------------------- body limit, compression, ETag, CORS

def test_oversized_bodies_are_rejected():
    with make_client(max_body_bytes=200) as c:
        r = c.post("/v1/recommend", content=b'{"weights": {"category": {"cost": 1}}, "pad": "' + b"x" * 500 + b'"}', headers={"Content-Type": "application/json"})
        assert r.status_code == 413 and r.headers["content-type"].startswith("application/problem+json")
        assert c.post("/v1/recommend", json={"weights": {"category": {"cost": 1}}}).status_code == 200


def test_chunked_bodies_without_a_length_are_limited_too():
    def chunks():
        yield b'{"pad": "'
        yield b"x" * 400
        yield b'"}'
    with make_client(max_body_bytes=200) as c:
        assert c.post("/v1/recommend", content=chunks(), headers={"Content-Type": "application/json"}).status_code == 413


def test_large_responses_are_compressed_small_ones_not(client):
    big = client.get("/v1/metrics", headers={"Accept-Encoding": "gzip"})
    assert big.headers.get("content-encoding") == "gzip" and big.json()["metrics"]
    assert "content-encoding" not in client.get("/v1/health", headers={"Accept-Encoding": "gzip"}).headers


def test_etag_is_weak_varies_and_matches_lists(client):
    r = client.get("/v1/districts")
    etag = r.headers["etag"]
    assert etag.startswith('W/"') and r.headers["vary"].startswith("Accept-Language")
    assert client.get("/v1/districts", headers={"If-None-Match": f'"zzz", {etag}'}).status_code == 304
    assert client.get("/v1/districts", headers={"If-None-Match": etag.removeprefix("W/")}).status_code == 304
    assert client.get("/v1/districts", headers={"If-None-Match": "*"}).status_code == 304
    assert client.get("/v1/districts", headers={"If-None-Match": '"other"'}).status_code == 200
    assert etag_matches(None, etag) is False


def test_cors_headers_are_narrow(client):
    r = client.options("/v1/recommend", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type"})
    assert r.headers["access-control-allow-origin"] == "http://localhost:5173" and "access-control-allow-credentials" not in r.headers
    assert set(r.headers["access-control-allow-methods"].replace(" ", "").split(",")) == {"GET", "POST", "OPTIONS"}
    denied = client.options("/v1/recommend", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "DELETE"})
    assert denied.status_code == 400


def test_weights_must_be_finite_and_bounded(client):
    for value in ("NaN", "Infinity", "-Infinity"):
        r = client.post("/v1/recommend", content=f'{{"weights": {{"category": {{"cost": {value}}}}}}}', headers={"Content-Type": "application/json"})
        assert r.status_code == 422 and r.json()["title"] in ("Invalid request", "Weight out of range"), value
    too_many = client.post("/v1/recommend", json={"weights": {"metric": {f"m{i}": 1 for i in range(101)}}})
    assert too_many.status_code == 422 and too_many.json()["title"] == "Invalid request" and "at most 100" in too_many.json()["detail"]
    assert client.post("/v1/recommend", json={"weights": {"category": {f"c{i}": 1 for i in range(8)}}}).json()["title"] == "Invalid request"
    long_codes = client.get("/v1/compare?codes=" + ",".join(["alpha"] * 100))
    assert long_codes.status_code == 422 and long_codes.json()["title"] == "Invalid request"


# ---------------------------------------------------------------- settings

def test_production_refuses_unsafe_configuration():
    ok = {"CITY": "warsaw", "ENVIRONMENT": "production", "API_DB_URL": "x", "CORS_ORIGINS": "https://app.example"}
    assert load_settings(ok).production
    for bad in ({"CORS_ORIGINS": ""}, {"CORS_ORIGINS": "*"}, {"CORS_ORIGINS": "http://app.example"}, {"CORS_ORIGINS": "https://a.example, http://b.example"}, {"ENVIRONMENT": "staging"}, {"CITY": "gdansk"}):
        with pytest.raises(RuntimeError):
            load_settings({**ok, **bad})
    assert load_settings({"CITY": "krakow"}).cors_origins == ("http://localhost:5173",)  # development default


def test_read_only_url_is_preferred():
    s = load_settings({"CITY": "warsaw", "API_DB_URL": "reader", "SUPABASE_DB_URL": "writer"})
    assert s.db_url == "reader"
    assert load_settings({"CITY": "warsaw", "SUPABASE_DB_URL": "writer"}).db_url == "writer"


def test_secret_from_a_file_and_production_never_uses_the_write_url(tmp_path):
    f = tmp_path / "api-db-url"
    f.write_text("from-file\n")
    base = {"CITY": "warsaw", "ENVIRONMENT": "production", "CORS_ORIGINS": "https://app.example"}
    assert load_settings({**base, "API_DB_URL_FILE": str(f)}).db_url == "from-file"
    assert load_settings({**base, "API_DB_URL": "direct", "API_DB_URL_FILE": str(f)}).db_url == "direct"  # the variable wins over the file
    with pytest.raises(RuntimeError, match="API_DB_URL"):
        load_settings({**base, "SUPABASE_DB_URL": "writer"})  # a write-capable URL is not accepted in production
    with pytest.raises(RuntimeError, match="cannot be read"):
        load_settings({**base, "API_DB_URL_FILE": str(tmp_path / "missing")})


def test_startup_failure_logs_the_exception_class_not_its_message(capfd):
    def fail():
        raise ConnectionError("postgresql://" + "user:hunter2" + "@host/db refused")  # built at run time: no secret-shaped literal in the repo
    with TestClient(create_app(settings(), DataStore(fail, lambda: "v"))) as c:
        assert c.get("/v1/health").status_code == 503
    out = capfd.readouterr().out
    assert "ConnectionError" in out and "hunter2" not in out
    logging.getLogger("gdziezamieszkac").handlers.clear()
