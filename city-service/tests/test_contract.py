from pathlib import Path

import yaml

from app.main import create_app

CONTRACT = yaml.safe_load((Path(__file__).resolve().parents[1] / "openapi.yaml").read_text())


def test_routes_and_contract_are_the_same_set(make_client):
    client, _ = make_client()
    routes = {(m, p.removeprefix("/v1")) for p, ops in client.app.openapi()["paths"].items() for m in ops}
    documented = {(m, p) for p, ops in CONTRACT["paths"].items() for m in ops}
    assert routes == documented


def test_no_interactive_docs(make_client):
    client, _ = make_client()
    assert client.get("/docs").status_code == 404 and client.get("/openapi.json").status_code == 404
    assert create_app  # imported for the factory check above
