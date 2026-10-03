"""Golden and contract checks on the real schemas (read-only). Skipped without SUPABASE_DB_URL. Run: pytest -m live"""
import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from tests.conftest import have_db, live_settings
from tests.contract import check

pytestmark = [pytest.mark.live, pytest.mark.skipif(not have_db(), reason="SUPABASE_DB_URL is not set")]


@pytest.fixture(scope="module", params=["warsaw", "krakow"])
def live(request):
    with TestClient(create_app(live_settings(request.param))) as c:
        yield request.param, c


def test_recommend_without_weights_reproduces_livability_score_default(live):
    """The quality gate from the backend plan: for every district, in both cities."""
    city, c = live
    stored = {d["code"]: d["livability_score"] for d in c.get("/v1/districts").json()["districts"]}
    got = {r["code"]: r["score"] for r in c.post("/v1/recommend").json()["ranking"]}
    assert len(stored) == 18 and got == pytest.approx(stored, abs=0.051), city


def test_live_responses_match_the_contract(live):
    city, c = live
    code = c.get("/v1/districts").json()["districts"][0]["code"]
    for path in ("/v1/meta", "/v1/districts", "/v1/districts.geojson", f"/v1/districts/{code}", f"/v1/districts/{code}/report?lang=pl",
                 f"/v1/districts/{code}/similar", f"/v1/districts/{code}/rent-vs-buy?area_m2=55&lang=pl", "/v1/metrics", "/v1/metrics/sale_price_median_m2/values",
                 "/v1/compare?codes=" + ",".join(d["code"] for d in c.get("/v1/districts").json()["districts"][:3]), "/v1/personas?lang=pl"):
        check(c, path)
    check(c, "/v1/recommend", "POST", {"weights": {"category": {"transport": 4, "cost": 4}}})


def test_every_district_and_language_answers(live):
    city, c = live
    for d in c.get("/v1/districts").json()["districts"]:
        for lang in ("en", "pl"):
            assert c.get(f"/v1/districts/{d['code']}?lang={lang}").status_code == 200
            assert c.get(f"/v1/districts/{d['code']}/report?lang={lang}").status_code == 200


# ---------------------------------------------------------------- English and Polish on the real data

from tests.lang import MARKDOWN, POLISH_LETTERS, TECHNICAL_NOTE, displays, format_problems, metrics_of, shape  # noqa: E402

KNOWN_MARKDOWN: set[tuple[str, str, str]] = set()  # fixed 2026-10-02 (a heading with ** in one Kraków report); add a (city, code, lang) here only for a known, tracked defect


def both_languages(c, path):
    sep = "&" if "?" in path else "?"
    return [c.get(f"{path}{sep}lang={lang}").json() for lang in ("en", "pl")]


def test_both_languages_have_the_same_structure_and_validate(live):
    city, c = live
    codes = [d["code"] for d in c.get("/v1/districts").json()["districts"]]
    paths = ["/v1/meta", "/v1/districts", "/v1/metrics", "/v1/metrics/sale_price_median_m2/values", "/v1/personas"]
    paths += [p for code in codes for p in (f"/v1/districts/{code}", f"/v1/districts/{code}/report", f"/v1/districts/{code}/similar", f"/v1/districts/{code}/rent-vs-buy?area_m2=55")]
    for path in paths:
        for lang in ("en", "pl"):
            check(c, f"{path}{'&' if '?' in path else '?'}lang={lang}")  # validates the contract for each language
        en, pl = both_languages(c, path)
        assert shape(en) == shape(pl), (city, path)
        if "lang" in en:
            assert (en["lang"], pl["lang"]) == ("en", "pl"), (city, path)


def test_polish_responses_are_really_polish(live):
    city, c = live
    for d in c.get("/v1/districts").json()["districts"]:
        code = d["code"]
        en, pl = (metrics_of(c.get(f"/v1/districts/{code}?lang={lang}").json()) for lang in ("en", "pl"))
        for key, m in pl.items():
            e = en[key]
            assert m["label"] != e["label"], (city, code, key, "label not translated")
            if not m.get("available", True):
                assert m["reason"] != e["reason"], (city, key, "gap reason not translated")
                continue
            for field in ("method", "caveat"):
                if e.get(field) and m[field] == e[field]:
                    assert TECHNICAL_NOTE.match(e[field]), (city, code, key, field, "note not translated", e[field][:80])
        report = c.get(f"/v1/districts/{code}/report?lang=pl").json()
        assert (report["lang"], report["lang_fallback"]) == ("pl", False), (city, code)
        assert POLISH_LETTERS.search(report["body"]), (city, code, "Polish report has no Polish letters")


def test_number_formats_follow_the_language(live):
    city, c = live
    problems = []
    for d in c.get("/v1/districts").json()["districts"]:
        en, pl = both_languages(c, f"/v1/districts/{d['code']}")
        problems += format_problems(displays(en), displays(pl))
    assert problems == [], (city, problems[:5])


def test_reports_contain_no_markdown(live):
    city, c = live
    found = set()
    for d in c.get("/v1/districts").json()["districts"]:
        for lang in ("en", "pl"):
            if MARKDOWN.search(c.get(f"/v1/districts/{d['code']}/report?lang={lang}").json()["body"]):
                found.add((city, d["code"], lang))
    assert found <= KNOWN_MARKDOWN, f"new markdown in reports: {sorted(found - KNOWN_MARKDOWN)}"


def test_the_database_session_is_read_only(live):
    """Even with write-capable credentials the backend's session refuses writes (a zero-row update, so nothing could change if it were allowed)."""
    from app.core.store import _connect
    city, _ = live
    with _connect(live_settings(city)) as conn:
        assert conn.execute("show default_transaction_read_only").fetchone()["default_transaction_read_only"] == "on"
        with pytest.raises(Exception, match="read-only"):
            conn.execute(f"update {city}.glossary set note = note where false")


def test_every_district_has_price_history_in_both_languages(live):
    """The quarterly sale-price history answers for all 18 districts, matches the contract, and agrees with the stored median."""
    city, c = live
    stored = {d["code"]: d for d in c.get("/v1/districts").json()["districts"]}
    assert len(stored) == 18
    for code in stored:
        for lang in ("en", "pl"):
            body = check(c, f"/v1/districts/{code}/series/sale_price_median_m2?lang={lang}").json()
            pts = body["points"]
            assert len(pts) >= 10 and body["lang"] == lang
            assert [p["period_start"] for p in pts] == sorted(p["period_start"] for p in pts)
            assert all(p["low_confidence"] == (p["n_obs"] < body["min_obs"]) for p in pts)
        last4 = sorted(p["value"] for p in pts[-4:])
        now = next(h for h in c.get(f"/v1/districts/{code}").json()["categories"] if h["category"] == "cost")
        sale = next(m for m in now["metrics"] if m["key"] == "sale_price_median_m2")["value"]
        assert abs((last4[1] + last4[2]) / 2 / sale - 1) < 0.3, (city, code)
    metrics = {m["key"]: m for m in c.get("/v1/metrics").json()["metrics"]}
    assert metrics["sale_price_median_m2"]["has_series"] is True


def test_commute_matrix_is_served_for_every_district(live):
    """Both cities' matrices are loaded and checked against a journey planner (2026-10-02)."""
    city, c = live
    codes = [d["code"] for d in c.get("/v1/districts").json()["districts"]]
    for code in codes:
        for lang in ("en", "pl"):
            body = check(c, f"/v1/commute?from={code}&lang={lang}").json()
            by = {x["code"]: x["minutes"] for x in body["destinations"]}
            assert len(by) == 18 and by[code] == 0, city
            assert sum(v is not None for v in by.values()) - 1 >= 12 and all(v is None or 0 <= v <= 120 for v in by.values()), (city, code)


def test_outlook_for_every_district_in_both_languages(live):
    """Momentum and the city's historical range come from the real tables; no forward scenario is published."""
    city, c = live
    for d in c.get("/v1/districts").json()["districts"]:
        for lang in ("en", "pl"):
            body = check(c, f"/v1/districts/{d['code']}/outlook?lang={lang}").json()
            assert body["momentum"]["growth_12m"] is not None and body["momentum"]["growth_since_start"] is not None, (city, d["code"])
            assert -0.5 < body["momentum"]["growth_12m"]["value"] < 0.8
            assert body["city_history"]["available"] and len(body["city_history"]["windows"]) == 2
            assert body["scenario"]["published"] is False and body["scenario"]["ranges"] == []
