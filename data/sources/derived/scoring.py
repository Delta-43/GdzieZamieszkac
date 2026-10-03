"""Percentile-rank scoring shared by the derived metrics and (later) the backend's /recommend.

Pure functions, no database access. A district's score for one metric is its percentile rank among the
districts of the same city, scaled 0-100 with 100 = best: the lowest value scores 0 and the highest 100
(ties share the average rank), and the scale is flipped for metrics where a higher value is worse.
Scores are relative within one city and must never be compared across cities.

Count metrics (stops, departures, shops, schools...) grow with district size, so they are ranked per km².
"""
import pandas as pd

# Metrics that are counts of things in the district; ranked per km² of district area.
PER_KM2 = {"transit_stops_total", "transit_stops_bus", "transit_stops_tram", "transit_stops_rail_metro",
           "transit_departures_weekday", "transit_night_departures", "amenity_schools", "amenity_hospitals_clinics",
           "amenity_supermarkets", "amenity_malls", "amenity_gyms", "amenity_open_sports_grounds", "amenity_aed_public", "amenity_nursery_places", "amenity_restaurants_cafes"}
# Excluded from the default livability score: sub-splits of a metric that is already in (double counting), the
# composite indices themselves, and metrics without a direction.
NOT_IN_SCORE = {"transit_stops_bus", "transit_stops_tram", "transit_stops_rail_metro", "air_quality_index",
                "safety_index", "livability_score_default", "night_noise_estimate", "busyness_index",
                "walkability_index", "family_friendliness_index", "heat_exposure_index"}


def normalise(values: pd.Series, area_km2: pd.Series, key: str) -> pd.Series:
    return values / area_km2 if key in PER_KM2 else values


def percentile(values: pd.Series, higher_is: str = "better") -> pd.Series:
    """0-100, 100 = best. `higher_is` is 'better' or 'worse'."""
    v = values.dropna()
    if len(v) < 2:
        return pd.Series(50.0, index=values.index).where(values.notna())
    r = (v.rank(method="average") - 1) / (len(v) - 1)
    r = r if higher_is == "better" else 1 - r
    return (r * 100).reindex(values.index)


def category_weights(metrics: dict[str, tuple[str, str]]) -> dict[str, float]:
    """Equal weight per category, split equally among the metrics of that category.
    `metrics` maps metric_key -> (category, higher_is). Metrics with 'neutral' or in NOT_IN_SCORE get no weight."""
    used = {k: c for k, (c, d) in metrics.items() if d in ("better", "worse") and k not in NOT_IN_SCORE}
    cats = sorted(set(used.values()))
    per_cat = {c: [k for k, cc in used.items() if cc == c] for c in cats}
    return {k: 1 / (len(cats) * len(ks)) for c, ks in per_cat.items() for k in ks}


def weighted_score(wide: pd.DataFrame, area_km2: pd.Series, metrics: dict[str, tuple[str, str]],
                   weights: dict[str, float] | None = None) -> tuple[pd.Series, pd.DataFrame]:
    """Weighted mean of percentile scores over the metrics present in `wide` (columns = metric keys, rows = districts).
    Returns (score per district, per-metric percentile table). Weights are renormalised over the metrics available."""
    weights = weights or category_weights(metrics)
    cols = [k for k in weights if k in wide.columns and wide[k].notna().any()]
    table = pd.DataFrame({k: percentile(normalise(wide[k], area_km2, k), metrics[k][1]) for k in cols})
    w = pd.Series({k: weights[k] for k in cols})
    score = (table * w).sum(axis=1, min_count=1) / w.sum()
    return score, table
