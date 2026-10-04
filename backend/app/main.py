"""FastAPI entrypoint. One deployment serves one city (`CITY`), read-only, from an in-memory snapshot (app.core.store).

The contract is backend/openapi.yaml; tests check every route and response against it. Production middleware is in app.core.middleware.
Run: `uvicorn app.main:app_from_env --factory` (see backend/README.md).
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from .api.routes import router
from .core import middleware
from .core.config import Settings, get_settings
from .core.logs import setup_logging
from .core.middleware import PREFIX, problem
from .core.present import ProblemError
from .core.store import DataStore, StoreUnavailable, make_store

log = logging.getLogger("gdziezamieszkac")
HTTP_TITLES = {404: "Not found", 405: "Method not allowed"}


def validation_detail(exc: RequestValidationError) -> str:
    """The reasons a request was refused, in words. A body that is not JSON, or sent with the wrong content type, gets a plain sentence."""
    errors = exc.errors()
    if any(e["type"] == "json_invalid" for e in errors):
        return "The request body is not valid JSON."
    if any(e["type"] in ("model_attributes_type", "dict_type") and e["loc"] == ("body",) for e in errors):
        return "Send the body as a JSON object, with the header Content-Type: application/json."
    return "; ".join(f"{'.'.join(str(p) for p in e['loc'] if p != 'body')}: {e['msg']}" for e in errors)


def create_app(settings: Settings | None = None, store: DataStore | None = None) -> FastAPI:
    """Build the app: routes, middleware and error handlers. Tests pass their own settings and store."""
    settings = settings or get_settings()
    store = store or make_store(settings)
    setup_logging(settings.log_level)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        try:
            store.get()
            log.info("data loaded", extra={"event": "startup"})
        except StoreUnavailable as e:  # start anyway: requests answer 503 until the data loads
            log.warning("initial data load failed (%s)", type(e.__cause__ or e).__name__, extra={"event": "startup"})
        yield

    # No interactive docs and no generated schema: the contract is backend/openapi.yaml.
    app = FastAPI(title="GdzieZamieszkac API", version="1.0.0", lifespan=lifespan, openapi_url=None, docs_url=None, redoc_url=None)
    app.state.settings, app.state.store = settings, store
    app.include_router(router, prefix=PREFIX)
    middleware.install(app, settings, store)

    @app.exception_handler(ProblemError)
    async def _problem(request: Request, exc: ProblemError):
        return problem(request.url.path, exc.status, exc.title, exc.detail)

    @app.exception_handler(StoreUnavailable)
    async def _unavailable(request: Request, exc: StoreUnavailable):
        return problem(request.url.path, 503, "Data unavailable", "The data could not be loaded yet; try again shortly.")

    @app.exception_handler(StarletteHTTPException)
    async def _http(request: Request, exc: StarletteHTTPException):
        return problem(request.url.path, exc.status_code, HTTP_TITLES.get(exc.status_code, "Error"), None if exc.status_code == 404 else str(exc.detail))

    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError):
        return problem(request.url.path, 422, "Invalid request", validation_detail(exc))

    return app


def app_from_env() -> FastAPI:
    """Factory for uvicorn: settings come from the environment."""
    return create_app()
