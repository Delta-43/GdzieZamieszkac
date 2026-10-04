import pytest
from fastapi.testclient import TestClient

from app.core.store import DataStore
from app.main import create_app
from tests.conftest import settings
from tests.fixtures import CODES, NOW, make_snapshot


def metrics_of(detail):
    return {m["key"]: m for g in detail["categories"] for m in g["metrics"]}


# ---------------------------------------------------------------- language, notes and reports

def test_language_query_beats_header_beats_default(client):
    assert client.get("/v1/districts").json()["lang"] == "en"
    assert client.get("/v1/districts", headers={"Accept-Language": "pl-PL,pl;q=0.9,en;q=0.5"}).json()["lang"] == "pl"
    assert client.get("/v1/districts?lang=en", headers={"Accept-Language": "pl"}).json()["lang"] == "en"
    assert client.get("/v1/districts", headers={"Accept-Language": "de,fr;q=0.8"}).json()["lang"] == "en"
    assert client.get("/v1/districts", headers={"Accept-Language": "en;q=0.3,pl;q=0.9"}).json()["lang"] == "pl"


def test_display_strings_and_notes_come_from_storage(client):
    en = metrics_of(client.get("/v1/districts/delta").json())["sale_price_median_m2"]
    pl = metrics_of(client.get("/v1/districts/delta?lang=pl").json())["sale_price_median_m2"]
    assert (en["method"], pl["method"]) == ("Test method.", "Metoda testowa.")
    assert pl["caveat"] == "Niska pewność: mniej niż 20 transakcji." and en["caveat"].startswith("Low confidence")
    assert en["display"] == "9,000" and pl["display"] == "9 000"


def test_report_falls_back_to_english_and_says_so(client):
    pl = client.get("/v1/districts/alpha/report?lang=pl").json()
    assert (pl["lang"], pl["lang_fallback"]) == ("pl", False)
    fb = client.get("/v1/districts/beta/report?lang=pl").json()
    assert (fb["lang"], fb["lang_fallback"], fb["body"]) == ("en", True, "English report for beta.")


# ---------------------------------------------------------------- values, ranks, gaps

def test_rank_follows_direction_and_ranks_counts_per_km2(client):
    m = metrics_of(client.get("/v1/districts/alpha").json())
    assert m["sale_price_median_m2"]["rank"] == {"position": 4, "of": 4, "direction": "lower is better"}  # highest price is worst
    assert m["transit_stops_total"]["rank"]["position"] == 2  # 50 stops / 10 km2 = 5.0 is second to gamma at 5.33
    assert "rank" not in m["population_total"]  # neutral metrics are shown, never ranked


def test_unavailable_metrics_carry_a_reason(client):
    m = metrics_of(client.get("/v1/districts/alpha").json())
    assert m["residents_registered"] == {"key": "residents_registered", "available": False, "label": "residents_registered label",
                                         "reason": "The Warsaw source (Panorama dzielnic) has no count of registered residents; see total population instead."}
    assert m["crime_detection_rate"]["available"] is False and m["crime_detection_rate"]["reason"] == "No data for this city."
    pl = metrics_of(client.get("/v1/districts/alpha?lang=pl").json())["residents_registered"]["reason"]
    assert pl.startswith("Źródło dla Warszawy")


def test_metric_values_sorted_best_first_and_gap_is_explicit(client):
    v = client.get("/v1/metrics/sale_price_median_m2/values").json()
    assert [x["district"] for x in v["values"]] == ["delta", "gamma", "beta", "alpha"]  # lower price is better
    assert v["values"][0]["rank"]["position"] == 1
    gap = client.get("/v1/metrics/crime_detection_rate/values").json()
    assert gap["values"] == [] and gap["available"] is False and gap["reason"]


def test_provenance_travels_with_the_value(client):
    m = metrics_of(client.get("/v1/districts/alpha").json())["sale_price_median_m2"]
    assert m["source"] == {"name": "Test source", "url": "https://example.org/source", "licence": "Test licence", "attribution": "Test attribution"}
    assert (m["data_kind"], m["n_obs"], m["as_of"]) == ("observed", 500, "2026-09-30")


def test_weekly_metrics_get_updated_at_and_a_shorter_cache(client):
    m = metrics_of(client.get("/v1/districts/alpha").json())
    assert "updated_at" in m["air_no2_mean"] and "updated_at" not in m["sale_price_median_m2"]
    assert client.get("/v1/districts/alpha").headers["cache-control"] == "public, max-age=60"
    assert client.get("/v1/districts").headers["cache-control"] == "public, max-age=300"


# ---------------------------------------------------------------- yield and rent versus buy

def test_yield_and_payback_are_derived_from_the_medians(client):
    d = client.get("/v1/districts/alpha").json()
    assert d["yield_gross"]["value"] == pytest.approx(90 * 12 / 20000) and d["yield_gross"]["display"] == "5.4%"
    assert d["yield_gross"]["data_kind"] == "estimated"
    assert d["payback_years"]["value"] == pytest.approx(20000 / (90 * 12)) and d["payback_years"]["display"] == "18.5 years"
    assert client.get("/v1/districts/alpha?lang=pl").json()["yield_gross"]["display"] == "5,4%"


def test_rent_vs_buy_arithmetic_and_formats(client):
    r = client.get("/v1/districts/alpha/rent-vs-buy?area_m2=50").json()
    assert r["price"] == {"value": 1000000, "currency": "PLN", "display": "1,000,000 PLN"}
    assert r["monthly_rent"]["value"] == 4500 and r["monthly_rent"]["display"] == "4,500 PLN per month"
    assert r["yield_gross"] == pytest.approx(0.054) and r["yield_display"] == "5.4%"
    pl = client.get("/v1/districts/alpha/rent-vs-buy?area_m2=50&lang=pl").json()
    assert pl["price"]["display"] == "1 000 000 PLN" and pl["payback_display"].endswith(" lat")


def test_rent_vs_buy_validates_the_area(client):
    assert client.get("/v1/districts/alpha/rent-vs-buy").status_code == 422
    assert client.get("/v1/districts/alpha/rent-vs-buy?area_m2=300").status_code == 422


# ---------------------------------------------------------------- compare and similar

def test_compare_keeps_request_order_and_validates(client):
    assert [d["code"] for d in client.get("/v1/compare?codes=gamma,alpha,beta").json()["districts"]] == ["gamma", "alpha", "beta"]
    assert client.get("/v1/compare?codes=alpha,alpha").status_code == 422
    assert client.get("/v1/compare?codes=alpha,beta,gamma,delta,alpha").status_code == 422
    assert client.get("/v1/compare?codes=alpha,nowhere").status_code == 404


def test_similar_excludes_the_district_and_respects_limit(client):
    s = client.get("/v1/districts/alpha/similar?limit=2").json()["similar"]
    assert len(s) == 2 and all(x["code"] != "alpha" and 0 <= x["similarity"] <= 1 for x in s)
    assert s[0]["similarity"] >= s[1]["similarity"] and 1 <= len(s[0]["closest_on"]) <= 3
    assert client.get("/v1/districts/alpha/similar?limit=0").status_code == 422


# ---------------------------------------------------------------- recommend

def ranking(client, body=None):
    r = client.post("/v1/recommend", json=body) if body is not None else client.post("/v1/recommend")
    assert r.status_code == 200, r.text
    return r.json()


def test_recommend_without_weights_reproduces_the_stored_default_score(client):
    stored = {d["code"]: d["livability_score"] for d in client.get("/v1/districts").json()["districts"]}
    out = ranking(client)
    assert out["weights_normalised"] is False and {r["code"]: r["score"] for r in out["ranking"]} == pytest.approx(stored, abs=0.051)
    assert [r["rank"] for r in out["ranking"]] == [1, 2, 3, 4]
    assert ranking(client, {"weights": {"category": dict.fromkeys(("transport", "cost", "safety", "environment", "livability"), 1)}})["ranking"] == out["ranking"]


def test_recommend_weights_change_the_ranking_and_explain_it(client):
    cost_only = ranking(client, {"weights": {"category": {"cost": 5, "transport": 0, "safety": 0, "environment": 0, "livability": 0}}})
    assert cost_only["weights_normalised"] is True and cost_only["ranking"][0]["code"] == "delta"  # cheapest district
    assert {d["key"] for r in cost_only["ranking"] for d in r["top_drivers"]} <= {"sale_price_median_m2", "rent_price_median_m2"}
    assert all(len(r["top_drivers"]) <= 3 for r in cost_only["ranking"])
    assert cost_only["metrics_used"] == 2 and "crime_detection_rate" in cost_only["missing_metrics"]


def test_metric_override_scales_a_metric_inside_its_category(client):
    base = {"category": {"cost": 5, "transport": 0, "safety": 0, "environment": 0, "livability": 0}}
    rent_out = ranking(client, {"weights": {**base, "metric": {"sale_price_median_m2": 0}}})
    assert rent_out["metrics_used"] == 1 and {d["key"] for r in rent_out["ranking"] for d in r["top_drivers"]} == {"rent_price_median_m2"}


@pytest.mark.parametrize("weights,title", [
    ({"category": {"cost": -1}}, "Weight out of range"), ({"category": {"cost": 6}}, "Weight out of range"),
    ({"category": {"nightlife": 3}}, "Unknown category"), ({"metric": {"nothing": 2}}, "Unknown metric"),
    ({"metric": {"population_total": 2}}, "Metric is not scored"), ({"metric": {"walkability_index": 2}}, "Metric is not scored"),
    ({"category": dict.fromkeys(("transport", "cost", "safety", "environment", "livability"), 0)}, "No weights")])
def test_recommend_rejects_bad_weights(client, weights, title):
    r = client.post("/v1/recommend", json={"weights": weights})
    assert r.status_code == 422 and r.json()["title"] == title


def test_recommend_rejects_unknown_fields_and_languages(client):
    assert client.post("/v1/recommend", json={"weights": {"category": {}}, "extra": 1}).status_code == 422
    assert client.post("/v1/recommend", json={"lang": "de"}).status_code == 422
    assert client.post("/v1/recommend", json={"lang": "pl"}).json()["note"].startswith("Wyniki")


# ---------------------------------------------------------------- personas, boundaries, meta

def test_personas_are_valid_weight_sets(client):
    personas = client.get("/v1/personas").json()["personas"]
    assert {p["key"] for p in personas} >= {"student", "family"}
    for p in personas:
        out = ranking(client, {"weights": p["weights"]})
        assert out["weights_normalised"] is True
    assert client.get("/v1/personas?lang=pl").json()["personas"][0]["label"] == "Student"


def test_personas_cover_different_priorities_with_text_in_both_languages(client):
    personas = client.get("/v1/personas").json()["personas"]
    keys = [p["key"] for p in personas]
    assert len(keys) == len(set(keys)) and {"couple", "newly_married", "city_life", "quiet_green"} <= set(keys)
    cats = ("transport", "livability", "amenities", "environment", "cost", "safety")
    vectors = {p["key"]: [p["weights"]["category"].get(c, 1) for c in cats] for p in personas}
    # The presets must differ enough for the choice to matter: some pair is far apart, and one leaves cost out altogether.
    distance = max(sum(abs(a - b) for a, b in zip(vectors[x], vectors[y], strict=True)) for x in vectors for y in vectors)
    assert distance >= 15
    assert any(v[cats.index("cost")] == 0 for v in vectors.values())
    for lang in ("en", "pl"):
        for p in client.get(f"/v1/personas?lang={lang}").json()["personas"]:
            assert p["label"].strip() and p["description"].strip()
    en, pl = client.get("/v1/personas?lang=en").json()["personas"], client.get("/v1/personas?lang=pl").json()["personas"]
    assert [p["description"] for p in en] != [p["description"] for p in pl]


def test_boundaries_are_geojson(client):
    r = client.get("/v1/districts.geojson")
    assert r.headers["content-type"].startswith("application/geo+json")
    assert [f["properties"]["code"] for f in r.json()["features"]] == CODES


def test_meta_lists_sources_for_the_footer(client):
    m = client.get("/v1/meta").json()
    assert (m["city"], m["city_name"], m["district_count"], m["languages"]) == ("warsaw", "Warszawa", 4, ["en", "pl"])
    assert m["sources"][0]["attribution"] == "Test attribution" and "sale_price_median_m2" in m["sources"][0]["metric_keys"]
    assert m["stale"] == {"is_stale": False, "reasons": []} and "X-Data-Warning" not in client.get("/v1/meta").headers


# ---------------------------------------------------------------- caching, stale data, CORS

def test_etag_gives_304_and_varies_with_language(client):
    r = client.get("/v1/districts")
    assert client.get("/v1/districts", headers={"If-None-Match": r.headers["etag"]}).status_code == 304
    assert client.get("/v1/districts", headers={"Accept-Language": "pl"}).headers["etag"] != r.headers["etag"]
    assert "etag" not in client.get("/v1/health").headers


def stale_client(mutate):
    snap = make_snapshot()
    mutate(snap)
    with TestClient(create_app(settings(), DataStore(lambda: snap, lambda: snap.version))) as c:
        yield c


def test_stale_reports_are_served_with_a_warning():
    def mutate(snap):
        snap.reports[("alpha", "en")]["livability_score"] = 99.0
    for c in stale_client(mutate):
        r = c.get("/v1/districts")
        assert r.status_code == 200 and r.headers["x-data-warning"].startswith("stale-data")
        meta = c.get("/v1/meta").json()["stale"]
        assert meta["is_stale"] and "out of date" in meta["reasons"][0]
        assert "nieaktualne" in c.get("/v1/meta?lang=pl").json()["stale"]["reasons"][0]


def test_failed_run_and_old_weekly_data_are_stale():
    def mutate(snap):
        snap.runs.append({"source": "gios", "status": "failed", "finished_at": NOW, "started_at": NOW})
        for r in snap.rows:
            if r["metric_key"] == "air_no2_mean":
                r["fetched_at"] = NOW.replace(month=8, day=1)
    for c in stale_client(mutate):
        reasons = c.get("/v1/meta").json()["stale"]["reasons"]
        assert len(reasons) == 2 and any("failed" in r for r in reasons) and any("14 days" in r for r in reasons)


def test_cors_allows_the_city_frontend_only(client):
    ok = client.options("/v1/districts", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"})
    assert ok.headers["access-control-allow-origin"] == "http://localhost:5173"
    other = client.options("/v1/districts", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"})
    assert "access-control-allow-origin" not in other.headers


def test_unknown_path_is_problem_json(client):
    r = client.get("/v1/nothing")
    assert r.status_code == 404 and r.headers["content-type"].startswith("application/problem+json")


def test_a_very_long_code_is_not_echoed_back_in_full(client):
    for path in ("/v1/districts/" + "a" * 5000, "/v1/metrics/" + "b" * 5000 + "/values"):
        r = client.get(path)
        assert r.status_code == 404 and len(r.json()["detail"]) < 120


def test_a_body_that_is_not_json_gets_a_plain_sentence(client):
    bad = client.post("/v1/recommend", content=b"{oops", headers={"content-type": "application/json"})
    assert bad.status_code == 422 and bad.json()["detail"] == "The request body is not valid JSON."
    wrong = client.post("/v1/recommend", content=b"{}", headers={"content-type": "text/plain"})
    assert wrong.status_code == 422 and "Content-Type: application/json" in wrong.json()["detail"]
    # Field errors keep naming the field.
    assert "cost" in client.post("/v1/recommend", json={"weights": {"category": {"cost": 9}}}).json()["detail"]
