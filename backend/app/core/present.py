"""Builders for the response shapes in backend/openapi.yaml. Plain dicts, so optional fields can be left out and required nullable
fields kept exactly as the contract says. Nothing here translates or formats live text except the derived yield figures, whose
strings are built from the same number formats the stored display strings use."""
from __future__ import annotations

import json
import re
from datetime import date, datetime
from pathlib import Path

import numpy as np
import pandas as pd

from . import scoring
from .config import Settings
from .i18n import CATEGORY_LABELS, DEFAULT_LANG, LANGS, fmt_number, t
from .store import Derived

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
HIGHLIGHT_KEYS = ("sale_price_median_m2", "rent_price_median_m2")
TOP_DRIVERS = 3


class ProblemError(Exception):
    """An error the API reports as problem+json with this status."""
    def __init__(self, status: int, title: str, detail: str | None = None):
        self.status, self.title, self.detail = status, title, detail


def _load_json(name: str) -> dict:
    return json.loads((DATA_DIR / name).read_text(encoding="utf-8"))


UNAVAILABLE = _load_json("unavailable_metrics.json")
PERSONAS = _load_json("personas.json")["personas"]


def iso(v) -> str | None:
    """A date or datetime as ISO text; None stays None."""
    if v is None:
        return None
    return v.isoformat() if isinstance(v, (date, datetime)) else str(v)


def note(d: Derived, text: str | None, lang: str) -> str | None:
    """A stored English note, or its stored Polish version; English if there is none (never translated live)."""
    if not text:
        return None
    return d.snap.notes_pl.get(text, text) if lang == "pl" else text


def pick(row_or_def: dict, field: str, lang: str) -> str:
    """The `<field>_<lang>` text of a catalogue or row dict, falling back to English."""
    return row_or_def.get(f"{field}_{lang}") or row_or_def.get(f"{field}_en") or ""


# ---------------------------------------------------------------- metric entries

def source_of(row: dict) -> dict:
    """The provenance block of a stored row."""
    s = {"name": row["source"] or "", "licence": row["licence"] or "", "attribution": row["attribution"] or ""}
    if row.get("source_url"):
        s["url"] = row["source_url"]
    return s


def unavailable(d: Derived, settings: Settings, key: str, lang: str) -> dict:
    """A metric without a value: the reason stored for this city, else a generic one (no data for the city, or none for this district)."""
    reason = UNAVAILABLE.get(settings.city, {}).get(key) or {}
    generic = t("no_city_data" if key not in d.available else "no_value", lang)
    return {"key": key, "available": False, "label": pick(d.defs[key], "label", lang), "reason": reason.get(lang) or reason.get("en") or generic}


def metric_value(d: Derived, code: str, key: str, lang: str) -> dict:
    """One stored value in the contract's MetricValue shape, with provenance and rank."""
    row, definition = d.rows[(code, key)], d.defs[key]
    out = {"key": key, "available": True, "label": pick(definition, "label", lang), "display": (row[f"value_{lang}"] or row["value_en"] or ""),
           "value": float(row["value_num"]), "unit": row["unit"] or definition["unit"], "data_kind": row["data_kind"], "n_obs": row["n_obs"],
           "as_of": iso(row["as_of_date"]), "source": source_of(row), "method": note(d, row["method"], lang) or "",
           "caveat": note(d, row["coverage_note"], lang)}
    if definition["refresh_cadence"] == "weekly":
        out["updated_at"] = iso(row["fetched_at"])
    rank = d.rank_of(code, key)
    if rank:
        out["rank"] = rank
    return out


def derived_entry(d: Derived, code: str, lang: str, kind: str) -> dict | None:
    """`yield_gross` or `payback_years` for a district, from the stored medians. Estimated by definition."""
    y = d.yields.get(code)
    if not y:
        return None
    sale, rent = y["sale"], y["rent"]
    if kind == "yield_gross":
        value, display, unit = y["yield"], f"{fmt_number(y['yield'] * 100, 1, lang)}%", "fraction"
    else:
        value, display, unit = y["payback"], f"{fmt_number(y['payback'], 1, lang)} {t('years', lang)}", "years"
    names = {s["source"] for s in (sale, rent) if s["source"]}
    return {"key": kind, "available": True, "label": t("yield_label" if kind == "yield_gross" else "payback_label", lang), "display": display,
            "value": float(value), "unit": unit, "data_kind": "estimated", "n_obs": min(x for x in (sale["n_obs"], rent["n_obs"]) if x is not None) if
            any(x["n_obs"] is not None for x in (sale, rent)) else None,
            "as_of": iso(min(sale["as_of_date"], rent["as_of_date"])),
            "source": {"name": " and ".join(sorted(names)), "licence": " / ".join(sorted({s["licence"] for s in (sale, rent) if s["licence"]})),
                       "attribution": "; ".join(sorted({s["attribution"] for s in (sale, rent) if s["attribution"]}))},
            "method": t("yield_method" if kind == "yield_gross" else "payback_method", lang), "caveat": t("yield_caveat", lang)}


def metric_entry(d: Derived, settings: Settings, code: str, key: str, lang: str) -> dict:
    """A value if the district has one, else the unavailable entry."""
    if (code, key) in d.rows:
        return metric_value(d, code, key, lang)
    return unavailable(d, settings, key, lang)


# ---------------------------------------------------------------- districts

def score_of(d: Derived, code: str) -> float | None:
    """The stored default livability score of a district, one decimal, or None."""
    v = d.wide.get("livability_score_default")
    return None if v is None or pd.isna(v.get(code)) else round(float(v[code]), 1)


def district_list_item(d: Derived, code: str, lang: str) -> dict:
    """A district for the list: score and the price and rent highlights."""
    highlights = []
    for key in HIGHLIGHT_KEYS:
        row = d.rows.get((code, key))
        if row:
            highlights.append({"key": key, "display": row[f"value_{lang}"] or row["value_en"] or "", "data_kind": row["data_kind"]})
    dist = d.districts[code]
    return {"code": code, "name": dist["name"], "area_km2": dist["area_km2"], "livability_score": score_of(d, code), "highlights": highlights}


def district_detail(d: Derived, settings: Settings, code: str, lang: str) -> dict:
    """Everything about a district, grouped by category, plus yield and payback."""
    dist = d.districts[code]
    groups = []
    for cat in d.category_order:
        keys = [k for k, df in d.defs.items() if df["category"] == cat]
        groups.append({"category": cat, "label": CATEGORY_LABELS.get(cat, {}).get(lang, cat),
                       "metrics": [metric_entry(d, settings, code, k, lang) for k in keys]})
    return {"code": code, "name": dist["name"], "area_km2": dist["area_km2"], "lang": lang, "livability_score": score_of(d, code),
            "score_note": t("score_note", lang), "categories": groups,
            "yield_gross": derived_entry(d, code, lang, "yield_gross"), "payback_years": derived_entry(d, code, lang, "payback_years")}


def boundaries(d: Derived) -> dict:
    """The simplified district polygons as a GeoJSON FeatureCollection."""
    return {"type": "FeatureCollection", "features": [
        {"type": "Feature", "geometry": x["geometry"], "properties": {"code": x["code"], "name": x["name"]}}
        for x in d.snap.districts if x["geometry"]]}


def report(d: Derived, code: str, lang: str) -> dict:
    """The stored report in `lang`, else the English one with `lang_fallback` set."""
    fallback = (code, lang) not in d.snap.reports
    row = d.snap.reports.get((code, DEFAULT_LANG if fallback else lang))
    if not row:
        raise ProblemError(404, "No report", f"There is no stored report for district '{code}'.")
    flagged = any(r["data_kind"] != "observed" for (c, _), r in d.rows.items() if c == code)
    return {"district": code, "lang": DEFAULT_LANG if fallback else lang, "lang_fallback": fallback and lang != DEFAULT_LANG,
            "livability_score": row["livability_score"], "body": row["body"], "model": row["model"], "generated_at": iso(row["generated_at"]),
            "estimated_or_proxy_values_flagged": flagged}


# ---------------------------------------------------------------- catalogue and metric values

def catalogue(d: Derived, settings: Settings, lang: str) -> list[dict]:
    """The whole metric catalogue with availability and, for gaps, the reason."""
    out = []
    for k, df in d.defs.items():
        entry = {"key": k, "category": df["category"], "label": pick(df, "label", lang), "description": pick(df, "description", lang),
                 "unit": df["unit"], "higher_is": df["higher_is"], "refresh_cadence": df["refresh_cadence"], "data_kind": df["default_data_kind"],
                 "available": k in d.available, "has_series": k in d.series_keys}
        if k not in d.available:
            entry["reason"] = unavailable(d, settings, k, lang)["reason"]
        out.append(entry)
    return out


def metric_values(d: Derived, settings: Settings, key: str, lang: str) -> dict:
    """One metric for every district, best first for directional metrics."""
    if key not in d.defs:
        raise ProblemError(404, "Unknown metric", f"There is no metric '{key}' in the catalogue.")
    df = d.defs[key]
    out = {"key": key, "label": pick(df, "label", lang), "lang": lang, "higher_is": df["higher_is"], "values": []}
    if key not in d.available:
        out["available"], out["reason"] = False, unavailable(d, settings, key, lang)["reason"]
        return out
    for c in d.codes:
        if (c, key) not in d.rows:
            continue
        row = d.rows[(c, key)]
        v = {"district": c, "value": float(row["value_num"]), "display": row[f"value_{lang}"] or row["value_en"] or "",
             "data_kind": row["data_kind"], "n_obs": row["n_obs"]}
        rank = d.rank_of(c, key)
        if rank:
            v["rank"] = rank
        out["values"].append(v)
    ranked = key in d.ranks
    out["values"].sort(key=lambda v: (v["rank"]["position"], v["district"]) if ranked and "rank" in v else (-v["value"], v["district"]))
    return out


# ---------------------------------------------------------------- similar districts

def similar(d: Derived, code: str, lang: str, limit: int) -> dict:
    """Districts whose percentile profile is closest to `code`, with the metrics where they are closest."""
    table = d.default_table.sub(50.0)  # centre each percentile so that "average" is zero and cosine can go negative
    vec = table.loc[code]
    results = []
    for other in d.codes:
        if other == code:
            continue
        both = vec.notna() & table.loc[other].notna()
        a, b = vec[both].to_numpy(float), table.loc[other][both].to_numpy(float)
        denom = np.linalg.norm(a) * np.linalg.norm(b)
        cos = float(a @ b / denom) if denom else 0.0
        gap = (vec[both] - table.loc[other][both]).abs()
        closest = list(gap.sort_values(kind="stable").index[:3])
        results.append((round((1 + cos) / 2, 3), other, closest))
    results.sort(key=lambda r: (-r[0], r[1]))
    return {"district": code, "lang": lang,
            "method": t("similar_method", lang),
            "similar": [{"code": o, "name": d.districts[o]["name"], "similarity": s, "closest_on": c} for s, o, c in results[:limit]]}


# ---------------------------------------------------------------- rent versus buy

def rent_vs_buy(d: Derived, code: str, lang: str, area_m2: float) -> dict:
    """Price, rent, yield and payback of a flat of `area_m2`, from the stored district medians."""
    y = d.yields.get(code)
    if not y:
        raise ProblemError(422, "No price data", f"District '{code}' has no sale price or no rent to compare.")
    price, rent = y["sale"]["value_num"] * area_m2, y["rent"]["value_num"] * area_m2
    return {"district": code, "lang": lang, "area_m2": area_m2,
            "price": {"value": round(price), "currency": "PLN", "display": f"{fmt_number(round(price), 0, lang)} PLN"},
            "monthly_rent": {"value": round(rent), "currency": "PLN", "display": f"{fmt_number(round(rent), 0, lang)} PLN {t('per_month', lang)}"},
            "yield_gross": y["yield"], "yield_display": f"{fmt_number(y['yield'] * 100, 1, lang)}%",
            "payback_years": y["payback"], "payback_display": f"{fmt_number(y['payback'], 1, lang)} {t('years', lang)}",
            "data_kind": "estimated",
            "based_on": [{"key": r["metric_key"], "display": r[f"value_{lang}"] or r["value_en"] or "", "data_kind": r["data_kind"]}
                         for r in (y["sale"], y["rent"])],
            "caveat": t("yield_caveat", lang)}


# ---------------------------------------------------------------- personas and recommendation

def personas(lang: str) -> list[dict]:
    """The persona presets in one language."""
    return [{"key": p["key"], "label": p["label"][lang], "description": p["description"][lang], "weights": p["weights"]} for p in PERSONAS]


def scored_keys(d: Derived) -> set[str]:
    """Metrics that can carry a weight: directional, not a composite or a sub-split, and with data in this city."""
    return {k for k in d.scorable.columns if d.meta[k][1] in ("better", "worse") and k not in scoring.NOT_IN_SCORE and d.scorable[k].notna().any()}


def build_weights(d: Derived, category: dict[str, float], metric: dict[str, float]) -> dict[str, float]:
    """Validate the user's weights and scale the default weights with them.

    Final weight of a metric = default share x category weight x metric multiplier. A category or metric that is not mentioned counts as 1,
    so no weights at all reproduces `livability_score_default`. Zero removes a metric; unknown or unscored metrics are rejected.
    """
    eligible = scored_keys(d)
    unknown = sorted(k for k in metric if k not in d.defs)
    if unknown:
        raise ProblemError(422, "Unknown metric", f"Not in the catalogue: {', '.join(unknown)}.")
    unscored = sorted(k for k in metric if k not in eligible)
    if unscored:
        raise ProblemError(422, "Metric is not scored", f"These metrics do not enter the score in this city: {', '.join(unscored)}.")
    weights = {k: d.base_weights[k] * category.get(d.meta[k][0], 1.0) * metric.get(k, 1.0) for k in eligible if k in d.base_weights}
    weights = {k: w for k, w in weights.items() if w > 0}
    if not weights:
        raise ProblemError(422, "No weights", "At least one weight must be above zero for a metric that has data.")
    return weights


def recommend(d: Derived, lang: str, category: dict[str, float] | None, metric: dict[str, float] | None) -> dict:
    """Rank the districts for the user's weights, with the metrics that contribute most to each score."""
    category, metric = category or {}, metric or {}
    weights = build_weights(d, category, metric)
    score, table = scoring.weighted_score(d.scorable, d.area, d.meta, weights)
    share = pd.Series({k: weights[k] for k in table.columns})
    contribution = table.mul(share / share.sum(), axis=1)  # each metric's part of a district's score
    ranking = []
    for code in sorted(score.index, key=lambda c: (-round(float(score[c]), 1), c)):
        top = contribution.loc[code].dropna().sort_values(ascending=False, kind="stable").index[:TOP_DRIVERS]
        ranking.append({"rank": len(ranking) + 1, "code": code, "name": d.districts[code]["name"], "score": round(float(score[code]), 1),
                        "top_drivers": [{"key": k, "label": pick(d.defs[k], "label", lang), "percentile": round(float(table.loc[code, k]), 1)} for k in top]})
    missing = sorted(k for k in d.meta if d.meta[k][1] in ("better", "worse") and k not in scoring.NOT_IN_SCORE and k not in d.available)
    return {"lang": lang, "weights_normalised": bool(category or metric), "metrics_used": len(share), "missing_metrics": missing,
            "note": t("score_note", lang), "ranking": ranking}


# ---------------------------------------------------------------- meta

def meta(d: Derived, settings: Settings, lang: str) -> dict:
    """City, data version, staleness and the source list for the footer."""
    groups: dict[tuple, dict] = {}
    for r in d.snap.rows:
        g = groups.setdefault((r["source"], r["licence"], r["attribution"], r["source_url"]), {"as_of": r["as_of_date"], "keys": set()})
        g["as_of"] = max(g["as_of"], r["as_of_date"])
        g["keys"].add(r["metric_key"])
    sources = []
    for (name, licence, attribution, url), g in sorted(groups.items(), key=lambda x: (x[0][0] or "", x[0][3] or "")):
        s = {"name": name or "", "licence": licence or "", "attribution": attribution or "", "as_of": iso(g["as_of"]), "metric_keys": sorted(g["keys"])}
        if url:
            s["url"] = url
        sources.append(s)
    finished = [r["finished_at"] for r in d.snap.runs if r["finished_at"]]
    return {"city": settings.city, "city_name": settings.city_name, "default_lang": DEFAULT_LANG, "languages": list(LANGS),
            "district_count": len(d.codes), "data_version": d.snap.version, "latest_ingestion_run": iso(max(finished)) if finished else None,
            "stale": {"is_stale": d.stale["is_stale"], "reasons": [r.get(lang) or r["en"] for r in d.stale["reasons"]]},
            "sources": sources, "score_note": t("score_note", lang)}


# ---------------------------------------------------------------- history

SERIES_MIN_OBS = 30  # quarters with fewer observations are low confidence (the contract's `min_obs`)


def series(d: Derived, code: str, key: str, lang: str) -> dict:
    """The stored history of a metric for a district, oldest first. 404 if the metric has no history."""
    if key not in d.defs:
        raise ProblemError(404, "Unknown metric", f"There is no metric '{key}' in the catalogue.")
    rows = d.series.get((code, key))
    if not rows:
        raise ProblemError(404, "No history", f"The metric '{key}' has no stored history for district '{code}'.")
    first = rows[0]
    df = d.defs[key]
    points = [{"period_start": iso(r["period_start"]), "period_end": iso(r["period_end"]), "value": float(r["value_num"]),
               "display": r[f"value_{lang}"] or r["value_en"] or "", "n_obs": r["n_obs"], "low_confidence": r["n_obs"] < SERIES_MIN_OBS} for r in rows]
    caveat = f"{t('series_newest_caveat', lang)} {t('series_thin_caveat', lang).format(n=SERIES_MIN_OBS)}"
    return {"district": code, "key": key, "label": pick(df, "label", lang), "lang": lang, "unit": df["unit"], "data_kind": first["data_kind"],
            "min_obs": SERIES_MIN_OBS, "source": source_of(first),
            "method": note(d, first["method"], lang) or "", "caveat": caveat, "points": points}


# ---------------------------------------------------------------- commute

def commute(d: Derived, code: str, lang: str) -> dict:
    """Minutes from one district to every district, from the stored matrix. 501 while the city's matrix is not loaded."""
    row = d.commute.get(code)
    if not row:
        raise ProblemError(501, "Not implemented", "The commute matrix is not loaded for this city yet.")
    day = re.search(r"\d{4}-\d{2}-\d{2}", d.commute_method or "")
    if not day:
        raise ProblemError(501, "Not implemented", "The commute matrix has no service day recorded.")
    return {"from": code, "lang": lang, "data_kind": "estimated", "method": note(d, d.commute_method, lang), "as_of": day.group(0),
            "caveat": t("commute_caveat", lang),
            "destinations": [{"code": c, "minutes": None if row.get(c) is None else float(row[c])} for c in d.codes]}


# ---------------------------------------------------------------- price outlook

OUTLOOK_BACKTEST = _load_json("outlook_backtest.json")
OUTLOOK_METRIC = "sale_price_median_m2"
OUTLOOK_WINDOWS = (4, 8)
COMPLETE_SHARE = 0.5   # a quarter counts for momentum only with at least this share of the city's median quarterly deed count
BACKTEST_METHODS = {"history_range": "History range", "damped_momentum": "Damped momentum"}


def pct(x: float, lang: str, signed: bool = True) -> str:
    """A fraction as a percentage with one decimal, for example +5.2% (Polish: +5,2%)."""
    return f"{'+' if signed and x > 0 else ''}{fmt_number(x * 100, 1, lang)}%"


def growth(a: dict, b: dict, lang: str, annualise: bool) -> dict:
    """The change from stored quarter `a` to later quarter `b`, as a fraction."""
    value = b["value_num"] / a["value_num"] - 1
    years = (b["period_start"] - a["period_start"]).days / 365.25
    ann = (b["value_num"] / a["value_num"]) ** (1 / years) - 1 if annualise and years > 0 else None
    out = {"value": value, "display": pct(value, lang), "annualised": ann, "annualised_display": None if ann is None else pct(ann, lang),
           "from": iso(a["period_start"]), "to": iso(b["period_start"]), "from_display": a[f"value_{lang}"] or a["value_en"] or "",
           "to_display": b[f"value_{lang}"] or b["value_en"] or "", "n_obs_from": a["n_obs"], "n_obs_to": b["n_obs"],
           "low_confidence": min(a["n_obs"], b["n_obs"]) < SERIES_MIN_OBS}
    return out


def city_history(d: Derived, lang: str) -> dict:
    """The spread of past one- and two-year price changes in the whole city, from the stored NBP quarterly series."""
    rows = d.snap.city_series
    if len(rows) < 30:
        return {"available": False}
    v = np.log(np.array([r["value_num"] for r in rows], dtype=float))
    windows = []
    for q in OUTLOOK_WINDOWS:
        g = np.exp(v[q:] - v[:-q]) - 1
        lo, med, hi = (float(x) for x in np.quantile(g, [0.1, 0.5, 0.9]))
        windows.append({"quarters": q, "label": t(f"window_{q}", lang), "low": lo, "median": med, "high": hi, "low_display": pct(lo, lang),
                        "median_display": pct(med, lang), "high_display": pct(hi, lang), "n_windows": int(len(g))})
    first = rows[0]
    return {"available": True, "period_start": iso(first["period_start"]), "period_end": iso(rows[-1]["period_end"]), "windows": windows,
            "source": source_of(first), "method": note(d, first["method"], lang) or ""}


def backtest_summary() -> dict:
    b = OUTLOOK_BACKTEST
    results = [{"quarters": int(h), "method": BACKTEST_METHODS.get(m, m), "origins": v["origins"], "mae_method": v["mae_method"],
                "mae_no_change": v["mae_no_change"], "mae_last_year_continues": v["mae_last_year_continues"], "coverage_80": v["coverage_80"],
                "passes": v["passes"]} for h, e in b["horizons"].items() for m, v in e.items()]
    return {"period_start": b["period"][0], "period_end": b["period"][1], "cities": b["cities"], "results": results}


def complete_quarters(d: Derived) -> set:
    """Quarter start dates whose citywide deed count is at least half of the city's median quarterly count (the register fills with a delay)."""
    totals: dict = {}
    for (_, key), rows in d.series.items():
        if key == OUTLOOK_METRIC:
            for r in rows:
                totals[r["period_start"]] = totals.get(r["period_start"], 0) + r["n_obs"]
    if not totals:
        return set()
    floor = COMPLETE_SHARE * float(np.median(list(totals.values())))
    return {q for q, n in totals.items() if n >= floor}


def outlook(d: Derived, code: str, lang: str) -> dict:
    """Momentum from the stored district history, the city's historical range, and the (unpublished) scenario with its backtest."""
    rows = d.series.get((code, OUTLOOK_METRIC))
    if not rows:
        raise ProblemError(404, "No history", f"District '{code}' has no stored price history to describe.")
    full = complete_quarters(d)
    usable = [r for r in rows if r["period_start"] in full]
    newest = usable[-1] if usable else None
    year_ago = next((r for r in usable if newest and (newest["period_start"] - r["period_start"]).days in range(360, 372)), None)
    return {"district": code, "lang": lang, "data_kind": "observed",
            "momentum": {"growth_12m": growth(year_ago, newest, lang, False) if year_ago else None,
                         "growth_since_start": growth(usable[0], newest, lang, True) if len(usable) >= 2 else None},
            "city_history": city_history(d, lang),
            "scenario": {"published": False, "reason": t("outlook_reason", lang), "ranges": [], "backtest": backtest_summary()},
            "method": t("outlook_method", lang), "caveat": t("outlook_caveat", lang)}
