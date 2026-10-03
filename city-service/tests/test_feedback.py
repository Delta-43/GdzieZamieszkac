RENT = {"type": "rent_paid", "district": "alfa", "rent_pln": 3200, "size_band": "31_50", "month": "2026-09"}
PROBLEM = {"type": "data_problem", "district": "alfa", "metric_key": "m1", "message": "The price looks too high."}


def test_rent_is_stored_unverified(make_client):
    c, store = make_client()
    r = c.post("/v1/feedback", json=RENT)
    assert r.status_code == 201
    d = r.json()
    assert d["status"] == "unverified" and d["published"] is False and store.count() == 1


def test_data_problem(make_client):
    c, store = make_client()
    assert c.post("/v1/feedback", json=PROBLEM).status_code == 201 and store.count() == 1


def test_unknown_district_or_metric(make_client):
    c, store = make_client()
    assert c.post("/v1/feedback", json={**RENT, "district": "zzz"}).status_code == 422
    assert c.post("/v1/feedback", json={**PROBLEM, "metric_key": "zzz"}).status_code == 422
    assert store.count() == 0


def test_bad_values(make_client):
    c, _ = make_client()
    assert c.post("/v1/feedback", json={**RENT, "rent_pln": 5}).status_code == 422
    assert c.post("/v1/feedback", json={**RENT, "month": "2026-13"}).status_code == 422
    assert c.post("/v1/feedback", json={**RENT, "size_band": "huge"}).status_code == 422
    assert c.post("/v1/feedback", json={"type": "crime_sighting", "district": "alfa"}).status_code == 422


def test_status_says_it_is_not_used(make_client):
    d = make_client()[0].get("/v1/feedback/status").json()
    assert d["identity_check"] == "not_yet" and d["published"] is False and d["affects_scores"] is False


def test_nothing_identifying_is_stored(make_client):
    c, store = make_client()
    c.post("/v1/feedback", json=RENT, headers={"X-Forwarded-For": "1.2.3.4", "User-Agent": "x"})
    row = store._connect().execute("SELECT * FROM feedback").fetchone()
    assert "1.2.3.4" not in str(row)
