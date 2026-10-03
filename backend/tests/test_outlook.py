"""Price outlook: momentum, the city's historical range, and the honest absence of a forward scenario (synthetic data, see fixtures.py)."""
import pytest

from tests.contract import check

URL = "/v1/districts/{}/outlook"


def test_momentum_is_computed_from_the_stored_quarters(client):
    body = check(client, URL.format("alpha")).json()
    g12, since = body["momentum"]["growth_12m"], body["momentum"]["growth_since_start"]
    # alpha rows (fixtures): 20,000 / 20,100 / 20,200 over three quarters, so there is no quarter a year before the newest one
    assert g12 is None
    assert since["value"] == pytest.approx(20200 / 20000 - 1) and since["annualised"] is not None and since["low_confidence"] is False


def test_low_confidence_looks_only_at_the_two_quarters_compared(client):
    # beta has a thin middle quarter (12 deeds) but 90 and 80 deeds at the two ends, so the comparison is not low confidence
    since = check(client, URL.format("beta")).json()["momentum"]["growth_since_start"]
    assert since["n_obs_from"] == 90 and since["n_obs_to"] == 80 and since["low_confidence"] is False


def test_city_history_gives_one_and_two_year_ranges(client):
    h = check(client, URL.format("alpha")).json()["city_history"]
    assert h["available"] is True and [w["quarters"] for w in h["windows"]] == [4, 8]
    one, two = h["windows"]
    assert one["median"] == pytest.approx(1.01 ** 4 - 1, abs=1e-3) and two["median"] == pytest.approx(1.01 ** 8 - 1, abs=1e-3)
    assert one["low"] <= one["median"] <= one["high"] and one["n_windows"] == 36 and two["n_windows"] == 32
    assert h["source"]["attribution"] == "Test attribution"


def test_no_forward_scenario_is_published_and_the_backtest_is_shown(client):
    s = check(client, URL.format("alpha")).json()["scenario"]
    assert s["published"] is False and s["ranges"] == [] and s["reason"]
    assert s["backtest"]["results"] and all(r["passes"] is False for r in s["backtest"]["results"])


def test_the_backtest_file_agrees_with_the_decision():
    """If a method ever passes, someone must also change the endpoint, so this fails until they do."""
    from app.core.present import OUTLOOK_BACKTEST
    assert OUTLOOK_BACKTEST["any_horizon_passes"] is False


def test_english_and_polish_text_and_percent_format(client):
    en = check(client, URL.format("alpha") + "?lang=en").json()
    pl = check(client, URL.format("alpha") + "?lang=pl").json()
    assert en["momentum"]["growth_since_start"]["display"].startswith("+1.0") and pl["momentum"]["growth_since_start"]["display"].startswith("+1,0")
    assert en["caveat"] != pl["caveat"] and en["scenario"]["reason"] != pl["scenario"]["reason"]
