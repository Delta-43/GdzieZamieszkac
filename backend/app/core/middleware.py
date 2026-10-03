"""Production middleware, installed by `install(app, settings, store)`.

Outermost first: request id and access log (also turns any unexpected error into a safe 500) -> CORS -> security headers -> body size limit ->
rate limit -> cache headers (weak ETag, Vary, stale-data warning) -> gzip -> routes. Every response, including 413 and 429, therefore carries the
security headers and, for the browser, the CORS headers. Gzip is innermost because it only skips small bodies when it sees them whole.
Everything is per process: with several workers, limits and caches are per worker.
"""
from __future__ import annotations

import hashlib
import logging
import re
import time
import uuid
from collections.abc import Callable

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from starlette.middleware.gzip import GZipMiddleware
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from .config import Settings
from .store import DataStore

PREFIX = "/v1"
log = logging.getLogger("gdziezamieszkac")
REQUEST_ID = re.compile(r"^[A-Za-z0-9._-]{1,64}$")
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",  # an API: it serves data, never documents or scripts
}
HSTS = "max-age=31536000; includeSubDomains"


def problem(path: str, status: int, title: str, detail: str | None = None, headers: dict[str, str] | None = None) -> JSONResponse:
    """RFC 9457 problem details, the error format of the whole API."""
    body = {"type": "about:blank", "title": title, "status": status, "instance": path}
    if detail:
        body["detail"] = detail
    return JSONResponse(body, status_code=status, media_type="application/problem+json", headers=headers)


# ---------------------------------------------------------------- rate limiting

class RateLimiter:
    """Token bucket per key, in memory. `check` returns None when the request may pass, else the seconds to wait."""

    def __init__(self, per_minute: int, clock: Callable[[], float] = time.monotonic, max_keys: int = 10_000):
        self.rate, self.capacity, self.clock, self.max_keys = per_minute / 60.0, float(per_minute), clock, max_keys
        self.buckets: dict[str, tuple[float, float]] = {}  # key -> (tokens, last refill)

    def check(self, key: str) -> float | None:
        """Take one token for `key`: None if allowed, else the seconds to wait."""
        if self.capacity <= 0:
            return None
        now = self.clock()
        tokens, last = self.buckets.get(key, (self.capacity, now))
        tokens = min(self.capacity, tokens + (now - last) * self.rate)
        if tokens < 1.0:
            self.buckets[key] = (tokens, now)
            return (1.0 - tokens) / self.rate
        self.buckets[key] = (tokens - 1.0, now)
        if len(self.buckets) > self.max_keys:  # bound the memory: forget clients whose bucket has refilled
            self.buckets = {k: v for k, v in self.buckets.items() if min(self.capacity, v[0] + (now - v[1]) * self.rate) < self.capacity}
        return None


def client_key(request: Request, hops: int) -> str:
    """The client address for rate limiting only (never logged). Behind `hops` trusted proxies the real client is that far from the right of X-Forwarded-For."""
    if hops > 0:
        parts = [p.strip() for p in request.headers.get("x-forwarded-for", "").split(",") if p.strip()]
        if len(parts) >= hops:
            return parts[-hops]
    return request.client.host if request.client else "unknown"


# ---------------------------------------------------------------- body size limit

class BodyLimit:
    """Reject request bodies above `max_bytes` with 413, whether or not the client declares a length."""

    def __init__(self, app: ASGIApp, max_bytes: int):
        self.app, self.max_bytes = app, max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        declared = dict(scope["headers"]).get(b"content-length")
        if declared and declared.isdigit() and int(declared) > self.max_bytes:
            await self._reject(scope, receive, send)
            return
        seen, rejected = 0, False

        async def limited() -> Message:
            # A chunked body has no declared length: count it, answer 413 ourselves and tell the app the client is gone.
            nonlocal seen, rejected
            message = await receive()
            if message["type"] == "http.request":
                seen += len(message.get("body", b""))
                if seen > self.max_bytes:
                    if not rejected:
                        rejected = True
                        await self._reject(scope, receive, send)
                    return {"type": "http.disconnect"}
            return message

        async def guarded_send(message: Message) -> None:
            if not rejected:
                await send(message)

        try:
            await self.app(scope, limited, guarded_send)
        except Exception:
            if not rejected:
                raise

    async def _reject(self, scope: Scope, receive: Receive, send: Send) -> None:
        await problem(scope["path"], 413, "Request too large", f"The body must be at most {self.max_bytes} bytes.")(scope, receive, send)


# ---------------------------------------------------------------- ETag

def etag_matches(header: str | None, etag: str) -> bool:
    """If-None-Match: a list of entity tags, weak or strong, or '*'."""
    if not header:
        return False
    bare = etag.removeprefix("W/")
    return any(t.strip() == "*" or t.strip().removeprefix("W/") == bare for t in header.split(","))


# ---------------------------------------------------------------- install

def install(app: FastAPI, settings: Settings, store: DataStore) -> None:
    """Attach the production middleware to the app, in the order described in the module docstring."""
    app.add_middleware(GZipMiddleware, minimum_size=1024)  # innermost: it must see the whole body to skip small ones
    general = RateLimiter(settings.rate_limit_per_minute)
    recommend = RateLimiter(settings.recommend_rate_limit_per_minute)

    @app.middleware("http")
    async def cache_headers(request: Request, call_next):
        """Weak ETag from the data version, Vary, a default cache lifetime and the stale-data warning (contract: components.headers)."""
        response = await call_next(request)
        if not request.url.path.startswith(PREFIX):
            return response
        stale = store.is_stale()
        if stale and stale["is_stale"]:
            response.headers["X-Data-Warning"] = "stale-data; see /v1/meta"
        response.headers["Vary"] = "Accept-Language"
        version = store.current_version()
        if request.method == "GET" and response.status_code == 200 and version and not request.url.path.endswith("/health"):
            key = f"{request.url.path}?{request.url.query}|{request.headers.get('accept-language', '')}"
            etag = f'W/"{version}-{hashlib.sha256(key.encode()).hexdigest()[:8]}"'
            response.headers["ETag"] = etag
            response.headers.setdefault("Cache-Control", f"public, max-age={settings.cache_max_age}")
            if etag_matches(request.headers.get("if-none-match"), etag):
                keep = ("etag", "cache-control", "x-data-warning", "vary")
                return Response(status_code=304, headers={k: v for k, v in response.headers.items() if k.lower() in keep})
        return response

    @app.middleware("http")
    async def rate_limit(request: Request, call_next):
        """Answer 429 with Retry-After when a client exceeds its limit (health checks and CORS preflights are exempt)."""
        path = request.url.path
        if request.method == "OPTIONS" or not path.startswith(PREFIX) or path.endswith("/health"):
            return await call_next(request)
        who = client_key(request, settings.trusted_proxy_hops)
        limiter = recommend if (request.method == "POST" and path.endswith("/recommend")) else general
        wait = limiter.check(f"{'r' if limiter is recommend else 'g'}:{who}")
        if wait is not None:
            return problem(path, 429, "Too many requests", "Slow down and try again shortly.", {"Retry-After": str(max(1, round(wait)))})
        return await call_next(request)

    app.add_middleware(BodyLimit, max_bytes=settings.max_body_bytes)

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        """Add the security headers (and HSTS in production) to every response."""
        response = await call_next(request)
        for name, value in SECURITY_HEADERS.items():
            response.headers[name] = value
        if settings.production:
            response.headers["Strict-Transport-Security"] = HSTS
        return response

    app.add_middleware(CORSMiddleware, allow_origins=list(settings.cors_origins), allow_methods=["GET", "POST", "OPTIONS"],
                       allow_headers=["Accept", "Accept-Language", "Content-Type", "If-None-Match", "X-Request-ID"],
                       expose_headers=["ETag", "X-Data-Warning", "X-Request-ID", "Retry-After"], max_age=600)

    @app.middleware("http")
    async def request_id_and_log(request: Request, call_next):
        """Outermost: give every request an id, log one line, and turn an unexpected error into a safe 500 (details only in the log)."""
        incoming = request.headers.get("x-request-id", "")
        rid = incoming if REQUEST_ID.match(incoming) else uuid.uuid4().hex
        started = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            log.exception("unhandled error", extra={"request_id": rid, "method": request.method, "path": request.url.path, "event": "error"})
            response = problem(request.url.path, 500, "Internal error", f"Something went wrong. Quote request id {rid} if you report it.")
        response.headers["X-Request-ID"] = rid
        log.info("request", extra={"request_id": rid, "method": request.method, "path": request.url.path, "status": response.status_code,
                                   "duration_ms": round((time.perf_counter() - started) * 1000, 1), "event": "request"})
        return response
