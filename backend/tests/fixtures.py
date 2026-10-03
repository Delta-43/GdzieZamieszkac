"""A small, obviously synthetic snapshot for offline tests (four made-up districts, test-only values, never shown to users).
Real-data checks are in test_live.py."""
from __future__ import annotations

from datetime import UTC, date, datetime

from app.core.store import Derived, Snapshot

NOW = datetime(2026, 9, 30, 12, 0, tzinfo=UTC)
AS_OF = date(2026, 9, 30)
CODES = ["alpha", "beta", "delta", "gamma"]
AREA = {"alpha": 10.0, "beta": 20.0, "gamma": 15.0, "delta": 5.0}


def _def(key, cat, order, higher, unit, cadence="static", kind="observed"):
    return {"metric_key": key, "category": cat, "label_en": f"{key} label", "label_pl": f"{key} etykieta", "description_en": f"{key} description",
            "description_pl": f"{key} opis", "unit": unit, "higher_is": higher, "refresh_cadence": cadence, "default_data_kind": kind, "sort_order": order}


DEFS = [_def("transit_stops_total", "transport", 1, "better", "stops"), _def("sale_price_median_m2", "cost", 2, "worse", "PLN/m²"),
        _def("rent_price_median_m2", "cost", 3, "worse", "PLN/m²"), _def("crimes_per_10k", "safety", 4, "worse", "per 10,000"),
        _def("crime_detection_rate", "safety", 5, "better", "%"), _def("air_no2_mean", "environment", 6, "worse", "µg/m³", "weekly", "estimated"),
        _def("population_total", "demographics", 7, "neutral", "people"), _def("walkability_index", "livability", 8, "better", "index 0-5", kind="proxy"),
        _def("livability_score_default", "livability", 9, "better", "score 0-100", kind="estimated"),
        _def("residents_registered", "demographics", 10, "neutral", "people")]

VALUES = {"transit_stops_total": [50, 30, 10, 80], "sale_price_median_m2": [20000, 15000, 9000, 12000], "rent_price_median_m2": [90, 70, 40, 55],
          "crimes_per_10k": [800, 300, 200, 500], "air_no2_mean": [30, 20, 15, 25], "population_total": [90000, 50000, 20000, 60000],
          "walkability_index": [4.0, 2.5, 1.0, 3.0]}  # order of CODES: alpha, beta, delta, gamma


def _row(code, key, value, kind="observed", n_obs=None, note=None, cadence="static"):
    return {"code": code, "metric_key": key, "value_num": float(value), "value_en": f"{value:,.0f}", "value_pl": f"{value:,.0f}".replace(",", " "),
            "unit": None, "data_kind": kind, "n_obs": n_obs, "source": "Test source", "source_url": "https://example.org/source", "licence": "Test licence",
            "attribution": "Test attribution", "as_of_date": AS_OF, "method": "Test method." if key == "sale_price_median_m2" else None,
            "coverage_note": note, "fetched_at": NOW}


def make_snapshot(version="v1", now=NOW) -> Snapshot:
    kinds = {d["metric_key"]: d["default_data_kind"] for d in DEFS}
    rows = []
    for key, vals in VALUES.items():
        for code, v in zip(CODES, vals):
            n = {"sale_price_median_m2": {"alpha": 500, "beta": 60, "delta": 8, "gamma": 15}}.get(key, {}).get(code)
            note = "Low confidence: fewer than 20 transactions." if key == "sale_price_median_m2" and code in ("delta", "gamma") else None
            rows.append(_row(code, key, v, kinds[key], n, note))
    districts = [{"code": c, "name": c.capitalize(), "area_km2": AREA[c],
                  "geometry": {"type": "MultiPolygon", "coordinates": [[[[i, 0], [i + 1, 0], [i + 1, 1], [i, 1], [i, 0]]]]}} for i, c in enumerate(CODES)]
    snap = Snapshot(districts=districts, metric_defs=DEFS, rows=rows, reports={}, notes_pl={"Test method.": "Metoda testowa.", "Low confidence: fewer than 20 transactions.": "Niska pewność: mniej niż 20 transakcji."},
                    runs=[{"source": "rcn", "status": "ok", "finished_at": now, "started_at": now}], version=version, loaded_at=now)
    score = Derived(snap, now).default_score  # the stored default score is what the engine computes
    for c in CODES:
        rows.append(_row(c, "livability_score_default", round(float(score[c]), 1), "estimated"))
    snap.series = synthetic_series()
    snap.commute = synthetic_commute()
    snap.city_series = synthetic_city_series()
    snap.reports = {(c, "en"): {"code": c, "locale": "en", "body": f"English report for {c}.", "livability_score": round(float(score[c]), 1), "model": "template",
                                "generated_at": now, "data_version": "x"} for c in CODES}
    snap.reports[("alpha", "pl")] = {"code": "alpha", "locale": "pl", "body": "Raport po polsku dla alpha.", "livability_score": round(float(score["alpha"]), 1),
                                     "model": "template", "generated_at": now, "data_version": "x"}
    return snap


def synthetic_series() -> list[dict]:
    """Four made-up quarters for alpha and beta (test-only numbers). In beta the second quarter is thin (under 30 observations)."""
    quarters = [(date(2025, 4, 1), date(2025, 6, 30)), (date(2025, 7, 1), date(2025, 9, 30)), (date(2025, 10, 1), date(2025, 12, 31))]
    out = []
    for code, base, counts in (("alpha", 20000, (400, 420, 380)), ("beta", 15000, (90, 12, 80))):
        for i, ((start, end), n) in enumerate(zip(quarters, counts)):
            v = base + 100 * i
            out.append({"code": code, "metric_key": "sale_price_median_m2", "period_start": start, "period_end": end, "value_num": float(v),
                        "value_en": f"{v:,} PLN/m²", "value_pl": f"{v:,} PLN/m²".replace(",", " "), "n_obs": n, "data_kind": "observed",
                        "method": "Test method.", "source": "Test source", "source_url": "https://example.org/source", "licence": "Test licence",
                        "attribution": "Test attribution"})
    return out


def synthetic_commute() -> list[dict]:
    """A made-up 4x4 matrix (test-only numbers): 10 minutes per step of distance in CODES order; gamma to delta has no connection."""
    method = "Estimated minutes on Wednesday 2026-10-07. Test method."
    out = []
    for i, a in enumerate(CODES):
        for j, b in enumerate(CODES):
            minutes = None if (a, b) == ("gamma", "delta") else 0.0 if a == b else 10.0 * abs(i - j)
            out.append({"from_code": a, "to_code": b, "minutes": minutes, "method": method, "computed_at": NOW})
    return out


def synthetic_city_series() -> list[dict]:
    """Forty made-up quarters rising 1% a quarter (test-only), so every one-year change is about 4.06% and every two-year change about 8.3%."""
    out, start = [], date(2016, 1, 1)
    for i in range(40):
        y, m = start.year + (start.month - 1 + 3 * i) // 12, (start.month - 1 + 3 * i) % 12 + 1
        v = round(10000 * 1.01 ** i)
        out.append({"metric_key": "test_city_price", "period_start": date(y, m, 1), "period_end": date(y, m, 28), "value_num": float(v),
                    "value_en": f"{v:,} PLN/m²", "value_pl": f"{v:,} PLN/m²".replace(",", " "), "data_kind": "observed", "method": "Test method.",
                    "source": "Test source", "source_url": "https://example.org/city", "licence": "Test licence", "attribution": "Test attribution"})
    return out
