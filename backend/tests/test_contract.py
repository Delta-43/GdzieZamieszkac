"""Every implemented operation answers in the shape the contract promises, and the routes match the contract."""
import pytest

from tests.contract import check

GET_PATHS = ["/v1/health", "/v1/meta", "/v1/districts", "/v1/districts.geojson", "/v1/districts/alpha", "/v1/districts/alpha/report",
             "/v1/districts/alpha/similar", "/v1/districts/alpha/rent-vs-buy?area_m2=50", "/v1/metrics", "/v1/metrics/sale_price_median_m2/values",
             "/v1/metrics/crime_detection_rate/values", "/v1/compare?codes=alpha,beta", "/v1/personas",
             "/v1/districts/alpha/series/sale_price_median_m2", "/v1/commute?from=alpha", "/v1/commute?from=gamma",
             "/v1/districts/alpha/outlook"]


@pytest.mark.parametrize("path", GET_PATHS)
@pytest.mark.parametrize("lang", ["en", "pl"])
def test_get_matches_contract(client, path, lang):
    if path == "/v1/health" or path.endswith("geojson"):
        check(client, path)
    else:
        check(client, path + ("&" if "?" in path else "?") + f"lang={lang}")


def test_recommend_matches_contract(client):
    check(client, "/v1/recommend", "POST")
    check(client, "/v1/recommend", "POST", {"weights": {"category": {"transport": 5, "cost": 1}, "metric": {"crimes_per_10k": 2}}, "lang": "pl"})


@pytest.mark.parametrize("path,expect", [("/v1/districts/nowhere", 404), ("/v1/districts?lang=de", 422), ("/v1/compare?codes=alpha", 422),
                                         ("/v1/districts/alpha/rent-vs-buy?area_m2=5", 422), ("/v1/metrics/nothing/values", 404),
                                         ("/v1/districts/nowhere/series/sale_price_median_m2", 404), ("/v1/districts/alpha/series/nothing", 404), ("/v1/commute?from=nowhere", 404), ("/v1/districts/nowhere/outlook", 404), ("/v1/districts/gamma/outlook", 404), ("/v1/commute", 422),
                                         ("/v1/districts/alpha/series/rent_price_median_m2", 404), ("/v1/districts/gamma/series/sale_price_median_m2", 404)])
def test_errors_are_problem_json(client, path, expect):
    r = check(client, path, expect=expect)
    assert r.headers["content-type"].startswith("application/problem+json")
    assert r.json()["status"] == expect


def test_commute_answers_501_while_the_matrix_is_not_loaded(snap):
    from fastapi.testclient import TestClient

    from app.core.store import DataStore
    from app.main import create_app
    from tests.conftest import settings
    snap.commute = []
    with TestClient(create_app(settings(), DataStore(lambda: snap, lambda: snap.version, refresh_seconds=60))) as c:
        r = check(c, "/v1/commute?from=alpha", expect=501)
    assert r.json()["title"] == "Not implemented"


def test_routes_match_the_contract(spec_dict):
    """No route without a contract entry and no contract operation without a route."""
    from app.api.routes import router
    in_spec = {(m.upper(), p) for p, item in spec_dict["paths"].items() for m in item if m in ("get", "post")}
    in_app = {(m, r.path) for r in router.routes for m in r.methods if m in ("GET", "POST")}
    assert in_app == in_spec


def test_the_contract_itself_is_valid_openapi_3_1(spec_dict):
    from openapi_spec_validator import validate
    validate(spec_dict)
    assert spec_dict["openapi"].startswith("3.1")
