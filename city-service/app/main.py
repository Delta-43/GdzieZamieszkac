"""City service: the AI report and resident feedback. The contract is city-service/openapi.yaml.

It reads facts from the read-only API over HTTP, calls the language model through OpenRouter, and stores unverified feedback in local SQLite.
It never logs or stores the typed text of an AI request, and it logs no addresses or bodies.
"""
from __future__ import annotations

import logging
import re
import time
import uuid
from datetime import UTC, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from starlette.exceptions import HTTPException as StarletteHTTPException

from .backend_client import BackendClient, BackendError
from .config import Settings, get_settings
from .feedback import FeedbackStore
from .guard import unsupported_numbers
from .llm import LlmError, OpenRouterClient
from .ratelimit import Bucket

PREFIX = "/v1"
log = logging.getLogger("city-service")
REQUEST_ID = re.compile(r"^[A-Za-z0-9._-]{1,64}$")
LABEL = {
    "pl": "Tekst napisany przez sztuczną inteligencję na podstawie obliczonych danych. Wyniki liczy kod, nie model.",
    "en": "Text written by artificial intelligence from computed data. The scores are computed in code, not by the model.",
}
FEEDBACK_NOTE = {
    "pl": "Zgłoszenia są zapisywane jako niezweryfikowane. Nie są publikowane i nie wpływają na żaden wynik, dopóki nie będzie weryfikacji tożsamości.",
    "en": "Reports are stored as unverified. They are not published and change no score until identity checks exist.",
}
SIZE_BANDS = ("up_to_30", "31_50", "51_70", "over_70")
Lang = Literal["pl", "en"]


class Weights(BaseModel):
    """The shape of `Weights` in backend/openapi.yaml. The data API checks the keys and the 0 to 5 range and this service passes its 422 on."""
    model_config = ConfigDict(extra="forbid")

    category: dict[str, float] | None = None
    metric: dict[str, float] | None = None


class AiReportRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    requirements: str = Field(min_length=3, max_length=1000)
    persona: str | None = Field(default=None, max_length=40)
    weights: Weights | None = None
    lang: Lang = "pl"


class RentPaid(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["rent_paid"]
    district: str = Field(max_length=60)
    rent_pln: int = Field(ge=100, le=50_000)
    size_band: Literal["up_to_30", "31_50", "51_70", "over_70"]
    month: str = Field(pattern=r"^\d{4}-(0[1-9]|1[0-2])$")


class DataProblem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    type: Literal["data_problem"]
    district: str = Field(max_length=60)
    metric_key: str = Field(max_length=80)
    message: str = Field(min_length=10, max_length=500)


FeedbackRequest = Annotated[RentPaid | DataProblem, Field(discriminator="type")]


def problem(path: str, status: int, title: str, detail: str | None = None, headers: dict[str, str] | None = None) -> JSONResponse:
    body = {"type": "about:blank", "title": title, "status": status, "instance": path}
    if detail:
        body["detail"] = detail
    return JSONResponse(body, status_code=status, media_type="application/problem+json", headers=headers)


class ProblemError(Exception):
    def __init__(self, status: int, title: str, detail: str | None = None):
        super().__init__(title)
        self.status, self.title, self.detail = status, title, detail


FACTS = {
    "en": {
        "rank": "Rank {rank}: {name}, score {score} out of 100 (a percentile score that compares districts of one city only, {city}).",
        "driver": "{name}: {label}, percentile {p} within {city} (100 is the best, 0 the worst).",
        "highlight": "{name}: {metric} is {display} ({kind}).",
        "kind": {"observed": "observed", "estimated": "estimated", "proxy": "proxy"},
        "score": "{score} pts (0-100)",
    },
    "pl": {
        "rank": "Miejsce {rank}: {name}, wynik {score} na 100 (wynik percentylowy, który porównuje wyłącznie dzielnice jednego miasta: {city}).",
        "driver": "{name}: {label}, percentyl {p} (miasto: {city}; 100 to najlepiej, 0 najgorzej).",
        "highlight": "{name}: {metric} wynosi {display} ({kind}).",
        "kind": {"observed": "dane obserwowane", "estimated": "szacunek", "proxy": "wskaźnik pośredni"},
        "score": "{score} pkt (0-100)",
    },
}


def fmt(value: float, lang: str) -> str:
    """One decimal, with the decimal mark of the language (a comma in Polish, as in the API's display strings)."""
    text = f"{value:.1f}"
    return text.replace(".", ",") if lang == "pl" else text


def score_display(score: float, lang: str) -> str:
    return FACTS[lang]["score"].format(score=fmt(score, lang))


def build_facts(ranking: list[dict], highlights: dict[str, list[dict]], labels: dict[str, str], lang: str = "en", city: str = "") -> list[str]:
    """Plain-text facts for the top three districts, in the request language. Every number the model may use is in this list."""
    t = FACTS[lang]
    facts: list[str] = []
    for row in ranking[:3]:
        facts.append(t["rank"].format(rank=row["rank"], name=row["name"], score=fmt(row["score"], lang), city=city))
        facts.extend(t["driver"].format(name=row["name"], label=d["label"], p=fmt(d["percentile"], lang), city=city) for d in row.get("top_drivers", []))
        for h in highlights.get(row["code"], []):
            kind = t["kind"].get(h["data_kind"], h["data_kind"])
            facts.append(t["highlight"].format(name=row["name"], metric=labels.get(h["key"], h["key"]), display=h["display"], kind=kind))
    return facts


def create_app(settings: Settings | None = None, backend: BackendClient | None = None, llm: OpenRouterClient | None = None,
               feedback: FeedbackStore | None = None) -> FastAPI:
    settings = settings or get_settings()
    backend = backend or BackendClient(settings.api_base_url)
    llm = llm or OpenRouterClient(settings.openrouter_url, settings.openrouter_key, settings.model, settings.llm_timeout_seconds)
    feedback = feedback or FeedbackStore(settings.feedback_db_path)
    ai_bucket, fb_bucket = Bucket(settings.ai_rate_limit_per_minute), Bucket(settings.feedback_rate_limit_per_minute)
    cache: dict[str, tuple[float, set[str]]] = {}
    city_cache: dict[str, tuple[float, str]] = {}
    router = APIRouter()

    async def city_name(lang: str) -> str:
        """The city name as `GET /meta` of the data API gives it (it is never written into this service). Cached for five minutes."""
        hit = city_cache.get(lang)
        if hit and time.monotonic() - hit[0] < 300:
            return hit[1]
        name = (await backend.meta(lang))["city_name"]
        city_cache[lang] = (time.monotonic(), name)
        return name

    async def known(kind: str, lang: str = "en") -> set[str]:
        """District codes or metric keys from the API, cached for five minutes."""
        hit = cache.get(kind)
        if hit and time.monotonic() - hit[0] < 300:
            return hit[1]
        data = await (backend.districts(lang) if kind == "districts" else backend.metrics(lang))
        keys = {x["code"] for x in data["districts"]} if kind == "districts" else {x["key"] for x in data["metrics"]}
        cache[kind] = (time.monotonic(), keys)
        return keys

    def limited(bucket: Bucket) -> None:
        wait = bucket.check()
        if wait is not None:
            raise ProblemError(429, "Too many requests", f"Try again in {int(wait) + 1} seconds.")

    @router.get("/health")
    async def health():
        return {"status": "ok", "api": "reachable" if await backend.health() else "unreachable", "ai": "configured" if llm.configured else "not_configured"}

    @router.post("/ai-report")
    async def ai_report(body: AiReportRequest):
        if not llm.configured:
            raise ProblemError(503, "AI report unavailable", "The language model is not configured on this server.")
        if body.persona and body.weights:
            raise ProblemError(422, "Invalid request", "Send either persona or weights, not both.")
        limited(ai_bucket)
        try:
            weights = body.weights.model_dump(exclude_none=True) if body.weights else None
            if body.persona:
                found = {p["key"]: p["weights"] for p in (await backend.personas(body.lang))["personas"]}
                if body.persona not in found:
                    raise ProblemError(422, "Invalid request", "Unknown persona.")
                weights = found[body.persona]
            rec = await backend.recommend(weights, body.lang)
            districts = (await backend.districts(body.lang))["districts"]
            metrics = (await backend.metrics(body.lang))["metrics"]
            city = await city_name(body.lang)
        except BackendError as e:
            raise ProblemError(e.status if e.status in (422, 503) else 502, "Data API error", e.detail) from e
        top = {r["code"] for r in rec["ranking"][:3]}
        highlights = {d["code"]: d.get("highlights", []) for d in districts if d["code"] in top}
        facts = build_facts(rec["ranking"], highlights, {m["key"]: m["label"] for m in metrics}, body.lang, city)
        try:
            text = await llm.narrate(body.requirements, facts, body.lang)
        except LlmError as e:
            raise ProblemError(502, "AI report failed", f"The language model did not answer ({e}). The stored area reports still work.") from e
        bad = unsupported_numbers(text, facts)
        if bad:  # the text holds a number that is not a supplied fact: drop it, never show it
            raise ProblemError(502, "AI report rejected", "The generated text contained numbers that are not in the data, so it was dropped.")
        return {
            "lang": body.lang, "ai_generated": True, "label": LABEL[body.lang], "model": settings.model,
            "generated_at": datetime.now(UTC).isoformat(timespec="seconds"), "report": text,
            "basis": {"persona": body.persona, "weights": weights, "note": rec["note"]},
            "districts": [{"rank": r["rank"], "code": r["code"], "name": r["name"], "score": r["score"], "score_display": score_display(r["score"], body.lang)}
                          for r in rec["ranking"][:3]],
            "facts": facts,
        }

    @router.post("/feedback", status_code=201)
    async def post_feedback(body: FeedbackRequest):
        limited(fb_bucket)
        try:
            if body.district not in await known("districts"):
                raise ProblemError(422, "Invalid request", "Unknown district.")
            if isinstance(body, DataProblem) and body.metric_key not in await known("metrics"):
                raise ProblemError(422, "Invalid request", "Unknown metric.")
        except BackendError as e:
            raise ProblemError(503, "Data API error", e.detail) from e
        if isinstance(body, RentPaid):
            rid = feedback.add("rent_paid", body.district, rent_pln=body.rent_pln, size_band=body.size_band, month=body.month)
        else:
            rid = feedback.add("data_problem", body.district, metric_key=body.metric_key, message=body.message)
        return {"id": rid, "status": "unverified", "published": False, "note": FEEDBACK_NOTE}

    @router.get("/feedback/status")
    async def feedback_status():
        return {"accepting": True, "identity_check": "not_yet", "stored_as": "unverified", "published": False, "affects_scores": False, "note": FEEDBACK_NOTE}

    app = FastAPI(title="GdzieZamieszkac city service", version="0.1.0", openapi_url=None, docs_url=None, redoc_url=None)
    app.state.settings = settings
    app.include_router(router, prefix=PREFIX)
    app.add_middleware(CORSMiddleware, allow_origins=list(settings.cors_origins), allow_methods=["GET", "POST", "OPTIONS"],
                       allow_headers=["Content-Type", "Accept-Language"], expose_headers=["X-Request-ID", "Retry-After"])

    @app.middleware("http")
    async def protect(request: Request, call_next):
        rid = request.headers.get("x-request-id", "")
        rid = rid if REQUEST_ID.match(rid) else uuid.uuid4().hex
        length = request.headers.get("content-length")
        if length and length.isdigit() and int(length) > settings.max_body_bytes:
            response = problem(request.url.path, 413, "Request too large")
        else:
            response = await call_next(request)
        response.headers.update({"X-Request-ID": rid, "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "Cache-Control": "no-store",
                                 "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'"})
        return response

    @app.exception_handler(ProblemError)
    async def _problem(request: Request, exc: ProblemError):
        headers = {"Retry-After": exc.detail.split()[3]} if exc.status == 429 and exc.detail else None
        return problem(request.url.path, exc.status, exc.title, exc.detail, headers)

    @app.exception_handler(StarletteHTTPException)
    async def _http(request: Request, exc: StarletteHTTPException):
        is_404 = exc.status_code == 404
        return problem(request.url.path, exc.status_code, "Not found" if is_404 else "Error", None if is_404 else str(exc.detail))

    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError):
        # Field names only: the message of a validation error can echo the typed text.
        fields = ", ".join(sorted({".".join(str(p) for p in e["loc"] if p != "body") or "body" for e in exc.errors()}))
        return problem(request.url.path, 422, "Invalid request", f"Invalid fields: {fields}")

    return app


def app_from_env() -> FastAPI:
    return create_app()
