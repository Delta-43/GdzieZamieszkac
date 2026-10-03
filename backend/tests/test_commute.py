"""Commute matrix: shape, nulls, language and the service day (synthetic data, see fixtures.py)."""
from tests.contract import check


def test_one_row_per_district_in_a_stable_order_with_null_for_no_connection(client):
    body = check(client, "/v1/commute?from=gamma").json()
    assert [x["code"] for x in body["destinations"]] == ["alpha", "beta", "delta", "gamma"]
    by = {x["code"]: x["minutes"] for x in body["destinations"]}
    assert by["gamma"] == 0 and by["delta"] is None and by["alpha"] == 30.0


def test_service_day_and_estimated_label(client):
    body = check(client, "/v1/commute?from=alpha").json()
    assert body["as_of"] == "2026-10-07" and body["data_kind"] == "estimated" and body["from"] == "alpha"


def test_text_comes_from_stored_values_in_both_languages(client):
    en = check(client, "/v1/commute?from=alpha&lang=en").json()
    pl = check(client, "/v1/commute?from=alpha&lang=pl").json()
    assert en["method"].startswith("Estimated minutes") and en["caveat"] != pl["caveat"]
    assert [x["minutes"] for x in en["destinations"]] == [x["minutes"] for x in pl["destinations"]]
