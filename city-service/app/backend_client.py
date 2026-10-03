"""Reads facts from the read-only API over HTTP. This service never touches the database."""
from __future__ import annotations

import contextlib

import httpx


class BackendError(Exception):
    """The API could not answer, or answered with a problem."""

    def __init__(self, status: int, detail: str | None = None):
        super().__init__(detail or str(status))
        self.status, self.detail = status, detail


class BackendClient:
    def __init__(self, base_url: str, client: httpx.AsyncClient | None = None):
        self.base_url = base_url
        self.client = client or httpx.AsyncClient(timeout=10.0)

    async def _call(self, method: str, path: str, **kw) -> dict:
        try:
            r = await self.client.request(method, f"{self.base_url}{path}", **kw)
        except httpx.HTTPError as e:
            raise BackendError(503, f"The data API is not reachable ({type(e).__name__}).") from e
        if r.status_code >= 400:
            detail = None
            with contextlib.suppress(ValueError):
                detail = r.json().get("detail")
            raise BackendError(r.status_code, detail)
        return r.json()

    async def personas(self, lang: str) -> dict:
        return await self._call("GET", "/personas", params={"lang": lang})

    async def recommend(self, weights: dict | None, lang: str) -> dict:
        return await self._call("POST", "/recommend", json={"weights": weights or {}, "lang": lang})

    async def districts(self, lang: str) -> dict:
        return await self._call("GET", "/districts", params={"lang": lang})

    async def metrics(self, lang: str) -> dict:
        return await self._call("GET", "/metrics", params={"lang": lang})

    async def health(self) -> bool:
        try:
            await self._call("GET", "/health")
        except BackendError:
            return False
        return True
