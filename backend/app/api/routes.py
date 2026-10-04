"""The /v1 routes. Thin: every answer is built in app.core.present from the in-memory snapshot."""
from __future__ import annotations

from fastapi import APIRouter, Body, Depends, Query, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from ..core import present
from ..core.config import Settings
from ..core.i18n import CATEGORIES, LANGS, resolve_lang, t
from ..core.present import ProblemError, shown
from ..core.store import DataStore, Derived, StoreUnavailable

router = APIRouter()
WEEKLY_MAX_AGE = 60


# ---------------------------------------------------------------- dependencies

def settings_dep(request: Request) -> Settings:
    return request.app.state.settings


def data_dep(request: Request) -> Derived:
    try:
        return request.app.state.store.get()
    except StoreUnavailable as e:
        raise ProblemError(503, "Data unavailable", "The data could not be loaded yet; try again shortly.") from e


def lang_dep(request: Request, lang: str | None = Query(None, description="en or pl")) -> str:
    if lang is not None and lang not in LANGS:
        raise ProblemError(422, "Unsupported language", f"lang must be one of {', '.join(LANGS)}.")
    return resolve_lang(lang, request.headers.get("accept-language"))


def known_district(d: Derived, code: str) -> str:
    if code not in d.districts:
        raise ProblemError(404, "Unknown district", f"There is no district '{shown(code)}'.")
    return code


def short_cache_if_weekly(response: Response, d: Derived) -> None:
    """Responses that carry weekly-refresh metrics get a shorter cache lifetime (contract: header CacheControl)."""
    if any(d.defs[k]["refresh_cadence"] == "weekly" for k in d.available):
        response.headers["Cache-Control"] = f"public, max-age={WEEKLY_MAX_AGE}"


# ---------------------------------------------------------------- system

@router.get("/health")
def health(request: Request):
    store: DataStore = request.app.state.store
    try:
        store.get()
    except StoreUnavailable as e:
        raise ProblemError(503, "Data unavailable", "The database has not been reachable since the service started.") from e
    ok = store.database_reachable is not False
    return {"status": "ok" if ok else "degraded", "database": "reachable" if ok else "unreachable"}


@router.get("/meta")
def get_meta(d: Derived = Depends(data_dep), s: Settings = Depends(settings_dep), lang: str = Depends(lang_dep)):
    return present.meta(d, s, lang)


# ---------------------------------------------------------------- districts

@router.get("/districts")
def list_districts(d: Derived = Depends(data_dep), lang: str = Depends(lang_dep)):
    return {"lang": lang, "score_note": t("score_note", lang), "districts": [present.district_list_item(d, c, lang) for c in d.codes]}


@router.get("/districts.geojson")
def district_boundaries(d: Derived = Depends(data_dep)):
    return JSONResponse(present.boundaries(d), media_type="application/geo+json")


@router.get("/districts/{code}")
def get_district(code: str, response: Response, d: Derived = Depends(data_dep), s: Settings = Depends(settings_dep), lang: str = Depends(lang_dep)):
    short_cache_if_weekly(response, d)
    return present.district_detail(d, s, known_district(d, code), lang)


@router.get("/districts/{code}/report")
def get_report(code: str, d: Derived = Depends(data_dep), lang: str = Depends(lang_dep)):
    return present.report(d, known_district(d, code), lang)


@router.get("/districts/{code}/similar")
def get_similar(code: str, limit: int = Query(3, ge=1, le=10), d: Derived = Depends(data_dep), lang: str = Depends(lang_dep)):
    return present.similar(d, known_district(d, code), lang, limit)


@router.get("/districts/{code}/series/{key}")
def get_series(code: str, key: str, d: Derived = Depends(data_dep), lang: str = Depends(lang_dep)):
    return present.series(d, known_district(d, code), key, lang)


@router.get("/districts/{code}/outlook")
def get_outlook(code: str, d: Derived = Depends(data_dep), lang: str = Depends(lang_dep)):
    return present.outlook(d, known_district(d, code), lang)


@router.get("/districts/{code}/rent-vs-buy")
def get_rent_vs_buy(code: str, area_m2: float = Query(..., ge=15, le=250), d: Derived = Depends(data_dep), lang: str = Depends(lang_dep)):
    return present.rent_vs_buy(d, known_district(d, code), lang, area_m2)


# ---------------------------------------------------------------- metrics

@router.get("/metrics")
def list_metrics(d: Derived = Depends(data_dep), s: Settings = Depends(settings_dep), lang: str = Depends(lang_dep)):
    return {"lang": lang, "metrics": present.catalogue(d, s, lang)}


@router.get("/metrics/{key}/values")
def get_metric_values(key: str, response: Response, d: Derived = Depends(data_dep), s: Settings = Depends(settings_dep), lang: str = Depends(lang_dep)):
    out = present.metric_values(d, s, key, lang)
    if d.defs[key]["refresh_cadence"] == "weekly":
        response.headers["Cache-Control"] = f"public, max-age={WEEKLY_MAX_AGE}"
    return out


# ---------------------------------------------------------------- tools

@router.get("/compare")
def compare(response: Response, codes: str = Query(..., max_length=200, description="two to four district codes, comma separated"),
            d: Derived = Depends(data_dep), s: Settings = Depends(settings_dep), lang: str = Depends(lang_dep)):
    wanted = [c.strip() for c in codes.split(",") if c.strip()]
    if not 2 <= len(wanted) <= 4 or len(set(wanted)) != len(wanted):
        raise ProblemError(422, "Invalid codes", "Give two to four different district codes, comma separated.")
    for c in wanted:
        known_district(d, c)
    short_cache_if_weekly(response, d)
    return {"lang": lang, "districts": [present.district_detail(d, s, c, lang) for c in wanted]}


@router.get("/commute")
def get_commute(from_: str = Query(..., alias="from"), d: Derived = Depends(data_dep), lang: str = Depends(lang_dep)):
    return present.commute(d, known_district(d, from_), lang)


@router.get("/personas")
def list_personas(lang: str = Depends(lang_dep)):
    return {"lang": lang, "personas": present.personas(lang)}


class WeightsIn(BaseModel):
    """Request weights. Sizes are capped so a request cannot be made expensive; the 0 to 5 range is checked in the route for a clearer message."""
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    category: dict[str, float] = Field(default_factory=dict, max_length=len(CATEGORIES))
    metric: dict[str, float] = Field(default_factory=dict, max_length=100)


class RecommendIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    weights: WeightsIn | None = None
    lang: str | None = None


@router.post("/recommend")
def post_recommend(request: Request, body: RecommendIn | None = Body(None), d: Derived = Depends(data_dep), lang_q: str = Depends(lang_dep)):
    lang = lang_q
    if body and body.lang is not None:
        if body.lang not in LANGS:
            raise ProblemError(422, "Unsupported language", f"lang must be one of {', '.join(LANGS)}.")
        lang = body.lang
    w = body.weights if body and body.weights else WeightsIn()
    unknown = sorted(set(w.category) - set(CATEGORIES))
    if unknown:
        raise ProblemError(422, "Unknown category", f"Categories are: {', '.join(CATEGORIES)}. Got: {', '.join(unknown)}.")
    out_of_range = sorted(k for k, v in {**w.category, **w.metric}.items() if not 0 <= v <= 5)
    if out_of_range:
        raise ProblemError(422, "Weight out of range", f"Weights must be between 0 and 5. Check: {', '.join(out_of_range)}.")
    return present.recommend(d, lang, w.category, w.metric)
