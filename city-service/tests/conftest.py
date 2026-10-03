import httpx
import pytest
from fastapi.testclient import TestClient

from app.backend_client import BackendClient
from app.config import Settings
from app.feedback import FeedbackStore
from app.llm import OpenRouterClient
from app.main import create_app

RANKING = [
    {"rank": 1, "code": "alfa", "name": "Alfa", "score": 64.0, "top_drivers": [{"key": "m1", "label": "Stops", "percentile": 100.0}]},
    {"rank": 2, "code": "beta", "name": "Beta", "score": 55.5, "top_drivers": []},
    {"rank": 3, "code": "gamma", "name": "Gamma", "score": 40.0, "top_drivers": []},
    {"rank": 4, "code": "delta", "name": "Delta", "score": 10.0, "top_drivers": []},
]
DISTRICTS = [{"code": r["code"], "name": r["name"], "highlights": [{"key": "m1", "display": "13,036 PLN/m²", "data_kind": "observed"}]} for r in RANKING]
PERSONAS = [{"key": "student", "weights": {"category": {"cost": 5}}}]


def fake_api(request: httpx.Request) -> httpx.Response:
    p = request.url.path
    if p.endswith("/health"):
        return httpx.Response(200, json={"status": "ok"})
    if p.endswith("/recommend"):
        return httpx.Response(200, json={"ranking": RANKING, "note": "Scores compare districts of this city only."})
    if p.endswith("/districts"):
        return httpx.Response(200, json={"districts": DISTRICTS})
    if p.endswith("/metrics"):
        return httpx.Response(200, json={"metrics": [{"key": "m1", "label": "Median sale price per m²"}]})
    if p.endswith("/meta"):
        return httpx.Response(200, json={"city": "krakow", "city_name": "Kraków"})
    if p.endswith("/personas"):
        return httpx.Response(200, json={"personas": PERSONAS})
    return httpx.Response(404, json={"detail": "no"})


class FakeLlm(OpenRouterClient):
    def __init__(self, text="Alfa is first with a score of 64.0.", key="k"):
        super().__init__("http://x", key, "m", 1.0)
        self.text, self.seen = text, []

    async def narrate(self, requirements, facts, lang):
        self.seen.append((requirements, facts, lang))
        return self.text


@pytest.fixture
def make_client():
    def make(llm=None, settings=None, api=fake_api):
        settings = settings or Settings(feedback_db_path=":memory:")
        backend = BackendClient("http://api/v1", httpx.AsyncClient(transport=httpx.MockTransport(api)))
        store = FeedbackStore(":memory:")
        app = create_app(settings, backend, llm or FakeLlm(), store)
        return TestClient(app), store
    return make
