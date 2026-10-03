"""History series: ordering, low-confidence flags, languages and the catalogue flag (synthetic data, see fixtures.py)."""
from tests.contract import check

URL = "/v1/districts/{}/series/sale_price_median_m2"


def test_points_are_oldest_first_and_flag_thin_quarters(client):
    body = check(client, URL.format("beta")).json()
    pts = body["points"]
    assert [p["period_start"] for p in pts] == sorted(p["period_start"] for p in pts)
    assert [p["low_confidence"] for p in pts] == [False, True, False]
    assert body["min_obs"] == 30 and body["data_kind"] == "observed"
    assert all(p["n_obs"] is not None and p["display"] for p in pts)


def test_english_and_polish_text_come_from_stored_values(client):
    en = check(client, URL.format("alpha") + "?lang=en").json()
    pl = check(client, URL.format("alpha") + "?lang=pl").json()
    assert en["method"] == "Test method." and pl["method"] == "Metoda testowa."
    assert [p["value"] for p in en["points"]] == [p["value"] for p in pl["points"]]
    assert "20 000" in pl["points"][0]["display"] and en["caveat"] != pl["caveat"]
    assert en["source"]["attribution"] == "Test attribution"


def test_catalogue_says_which_metric_has_history(client):
    metrics = {m["key"]: m for m in check(client, "/v1/metrics").json()["metrics"]}
    assert metrics["sale_price_median_m2"]["has_series"] is True
    assert metrics["rent_price_median_m2"]["has_series"] is False
