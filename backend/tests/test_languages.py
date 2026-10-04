"""English and Polish answers have the same structure everywhere, differ in their text, and say which language they are in (synthetic data)."""
import pytest

from tests.contract import check
from tests.lang import displays, format_problems, metrics_of, shape, walk

PATHS = ["/v1/meta", "/v1/districts", "/v1/metrics", "/v1/metrics/sale_price_median_m2/values", "/v1/metrics/crime_detection_rate/values", "/v1/personas",
         "/v1/districts/alpha", "/v1/districts/alpha/similar", "/v1/districts/alpha/rent-vs-buy?area_m2=50", "/v1/compare?codes=alpha,beta,gamma",
         "/v1/districts/alpha/series/sale_price_median_m2", "/v1/commute?from=alpha", "/v1/districts/alpha/outlook"]


def both(client, path, **kw):
    sep = "&" if "?" in path else "?"
    return [check(client, f"{path}{sep}lang={lang}", **kw).json() for lang in ("en", "pl")]


@pytest.mark.parametrize("path", PATHS)
def test_same_structure_in_both_languages(client, path):
    en, pl = both(client, path)
    assert shape(en) == shape(pl)


@pytest.mark.parametrize("path", PATHS)
def test_the_answer_says_which_language_it_is(client, path):
    en, pl = both(client, path)
    if "lang" in en:
        assert (en["lang"], pl["lang"]) == ("en", "pl")


def test_report_has_the_same_structure_and_its_own_text(client):
    en, pl = both(client, "/v1/districts/alpha/report")
    assert shape(en) == shape(pl) and (en["lang"], pl["lang"]) == ("en", "pl") and en["body"] != pl["body"]


def test_recommend_has_the_same_structure_in_both_languages(client):
    body = {"weights": {"category": {"cost": 4}}}
    en, pl = (check(client, "/v1/recommend", "POST", {**body, "lang": lang}).json() for lang in ("en", "pl"))
    assert shape(en) == shape(pl) and (en["lang"], pl["lang"]) == ("en", "pl") and en["note"] != pl["note"]
    assert [r["code"] for r in en["ranking"]] == [r["code"] for r in pl["ranking"]]  # the language never changes the result


def test_numbers_and_codes_are_identical_only_text_differs(client):
    en, pl = both(client, "/v1/districts/alpha")
    numbers = lambda body: [(p, v) for p, v in walk(body) if isinstance(v, (int, float)) and not isinstance(v, bool)]  # noqa: E731
    assert numbers(en) == numbers(pl)
    assert [m["key"] for m in metrics_of(en).values()] == [m["key"] for m in metrics_of(pl).values()]


def test_labels_reasons_and_notes_are_in_the_requested_language(client):
    en, pl = (metrics_of(client.get(f"/v1/districts/delta?lang={lang}").json()) for lang in ("en", "pl"))
    assert en["transit_stops_total"]["label"] == "transit_stops_total label" and pl["transit_stops_total"]["label"] == "transit_stops_total etykieta"
    assert pl["residents_registered"]["reason"] != en["residents_registered"]["reason"]
    assert pl["sale_price_median_m2"]["caveat"].startswith("Niska") and en["sale_price_median_m2"]["caveat"].startswith("Low")


def test_number_formats_follow_the_language(client):
    en, pl = both(client, "/v1/districts/alpha")
    assert format_problems(displays(en), displays(pl)) == []
    assert any(" " in d for d in displays(pl))  # Polish thousands use a no-break space
    assert format_problems([], ["12.5%", "1,234 PLN"]) and format_problems(["1 234"], [])  # the checker itself catches mistakes


def test_accept_language_gives_the_same_answer_as_the_query(client):
    via_query = client.get("/v1/districts?lang=pl").json()
    via_header = client.get("/v1/districts", headers={"Accept-Language": "pl-PL,pl;q=0.9,en;q=0.4"}).json()
    assert via_query == via_header


def test_source_licence_and_unit_have_a_stored_polish_version_and_fall_back_to_english(client):
    en, pl = client.get("/v1/districts/alpha?lang=en").json(), client.get("/v1/districts/alpha?lang=pl").json()

    def metric(body, key):
        return next(m for c in body["categories"] for m in c["metrics"] if m["key"] == key)

    stops_en, stops_pl = metric(en, "transit_stops_total"), metric(pl, "transit_stops_total")
    assert (stops_en["unit"], stops_pl["unit"]) == ("stops", "przystanki")
    assert (stops_en["source"]["licence"], stops_pl["source"]["licence"]) == ("Test licence", "Licencja testowa")
    assert (stops_en["source"]["name"], stops_pl["source"]["name"]) == ("Test source", "Źródło testowe")
    # A text with no stored Polish version stays as it is (never translated live), here a unit and a credit line.
    assert metric(pl, "sale_price_median_m2")["unit"] == "PLN/m²"
    assert metric(pl, "transit_stops_total")["source"]["attribution"] in ("", "Podpis testowy")


def test_meta_catalogue_and_series_use_the_polish_texts_too(client):
    sources = client.get("/v1/meta?lang=pl").json()["sources"]
    assert {s["licence"] for s in sources} == {"Licencja testowa"} and {s["name"] for s in sources} == {"Źródło testowe"}
    assert {s["licence"] for s in client.get("/v1/meta?lang=en").json()["sources"]} == {"Test licence"}
    units = {m["key"]: m["unit"] for m in client.get("/v1/metrics?lang=pl").json()["metrics"]}
    assert units["transit_stops_total"] == "przystanki" and units["crime_detection_rate"] == "%"
    series = client.get("/v1/districts/alpha/series/sale_price_median_m2?lang=pl")
    if series.status_code == 200:
        assert series.json()["source"]["licence"] == "Licencja testowa"


def test_outlook_method_names_follow_the_language(client):
    for lang, expected in (("en", {"History range", "Damped momentum"}), ("pl", {"Zakres historyczny", "Wygaszone tempo zmian"})):
        r = client.get(f"/v1/districts/alpha/outlook?lang={lang}")
        if r.status_code == 200:
            methods = {x["method"] for x in r.json()["scenario"]["backtest"]["results"]}
            assert methods <= expected and methods
