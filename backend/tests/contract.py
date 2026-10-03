"""Validate real responses against backend/openapi.yaml (the contract), path by path."""
from __future__ import annotations

import json
from urllib.parse import urlsplit

from openapi_core import Config, OpenAPI
from openapi_core.testing import MockRequest, MockResponse

from tests.conftest import SPEC_PATH

_openapi = OpenAPI.from_file_path(str(SPEC_PATH), config=Config(extra_media_type_deserializers={"application/geo+json": json.loads, "application/problem+json": json.loads}))
HOST = "http://testserver"
UNDECLARED_OK = {304, 501, 503}  # not described per operation in the contract


def check(client, path: str, method: str = "GET", body: dict | None = None, expect: int = 200, headers: dict | None = None):
    """Send a request through the app and validate the response against the contract. Returns the response."""
    r = client.request(method, path, json=body, headers=headers)
    assert r.status_code == expect, f"{method} {path} -> {r.status_code}: {r.text[:300]}"
    if r.status_code in UNDECLARED_OK:
        return r
    parts = urlsplit(path)
    request = MockRequest(HOST, method.lower(), parts.path, args=dict(x.split("=", 1) for x in parts.query.split("&") if x) if parts.query else None,
                          headers=headers or {}, data=json.dumps(body) if body is not None else None, content_type="application/json" if body is not None else "")
    response = MockResponse(r.content, status_code=r.status_code, headers=dict(r.headers), content_type=r.headers["content-type"].split(";")[0])
    _openapi.validate_response(request, response)
    return r
