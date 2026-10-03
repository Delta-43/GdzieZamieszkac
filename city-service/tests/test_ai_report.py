import httpx

from app.config import Settings
from tests.conftest import FakeLlm


def post(c, **kw):
    return c.post("/v1/ai-report", json={"requirements": "cheap and near trams", "lang": "en", **kw})


def test_report_has_label_and_facts(make_client):
    llm = FakeLlm()
    c, _ = make_client(llm)
    r = post(c, persona="student")
    assert r.status_code == 200
    d = r.json()
    assert d["ai_generated"] is True and "artificial intelligence" in d["label"]
    assert [x["code"] for x in d["districts"]] == ["alfa", "beta", "gamma"]  # top three only, the ranking is the API's
    assert d["basis"]["persona"] == "student" and d["report"] and d["facts"]
    assert llm.seen and llm.seen[0][2] == "en"


def test_polish_label(make_client):
    c, _ = make_client()
    assert "sztuczną inteligencję" in post(c, lang="pl").json()["label"]


def test_invented_number_is_dropped(make_client):
    c, _ = make_client(FakeLlm("Alfa has a score of 99."))
    r = post(c)
    assert r.status_code == 502 and r.headers["content-type"].startswith("application/problem+json")
    assert "99" not in r.text


def test_not_configured(make_client):
    c, _ = make_client(FakeLlm(key=""))
    assert post(c).status_code == 503


def test_persona_and_weights_together(make_client):
    c, _ = make_client()
    assert post(c, persona="student", weights={"category": {"cost": 1}}).status_code == 422


def test_unknown_persona(make_client):
    c, _ = make_client()
    assert post(c, persona="nobody").status_code == 422


def test_short_requirements(make_client):
    c, _ = make_client()
    assert c.post("/v1/ai-report", json={"requirements": "x"}).status_code == 422


def test_validation_error_does_not_echo_the_text(make_client):
    c, _ = make_client()
    r = c.post("/v1/ai-report", json={"requirements": "SECRET TEXT " * 200})
    assert r.status_code == 422 and "SECRET" not in r.text


def test_api_down_is_503(make_client):
    def down(request):
        raise httpx.ConnectError("x")
    c, _ = make_client(api=down)
    assert post(c).status_code == 503


def test_rate_limit(make_client):
    c, _ = make_client(settings=Settings(feedback_db_path=":memory:", ai_rate_limit_per_minute=2))
    assert [post(c).status_code for _ in range(3)] == [200, 200, 429]


def test_body_limit(make_client):
    c, _ = make_client(settings=Settings(feedback_db_path=":memory:", max_body_bytes=100))
    assert c.post("/v1/ai-report", json={"requirements": "x" * 500}).status_code == 413


def test_facts_follow_the_language(make_client):
    llm = FakeLlm("Alfa ma wynik 64,0.")
    c, _ = make_client(llm)
    d = post(c, lang="pl").json()
    assert d["facts"][0].startswith("Miejsce 1: Alfa, wynik 64,0 na 100")
    assert all("Rank " not in f and "percentile " not in f for f in d["facts"])
    assert d["districts"][0]["score_display"] == "64,0 pkt (0-100)"
    en = post(c, lang="en").json()
    assert en["facts"][0].startswith("Rank 1: Alfa, score 64.0 out of 100") and en["districts"][0]["score_display"] == "64.0 pts (0-100)"


def test_polish_decimal_comma_passes_the_guard(make_client):
    c, _ = make_client(FakeLlm("Alfa ma wynik 64,0, a Beta 55,5."))
    assert post(c, lang="pl").status_code == 200
    c, _ = make_client(FakeLlm("Alfa ma wynik 64,1."))
    assert post(c, lang="pl").status_code == 502


def test_unknown_field_is_rejected(make_client):
    c, _ = make_client()
    assert post(c, address="x").status_code == 422
