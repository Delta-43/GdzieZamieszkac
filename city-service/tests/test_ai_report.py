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
