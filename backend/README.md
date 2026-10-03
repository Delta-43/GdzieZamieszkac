# backend/ — FastAPI application

Owned by the **backend team**. One shared codebase, deployed once per city: `CITY=warsaw|krakow` picks the Postgres schema (see `../AGENTS.md`; no `/cities` endpoint, no city parameter).
The API is **read-only**, has no accounts, stores nothing about its users, and never translates or generates text at request time. Worker rules: `AGENTS.md` in this folder.

The contract is `openapi.yaml` (OpenAPI 3.1). Tests check every route and response against it, so change the contract first (PR), then the code.
Decisions behind it: `../docs/BACKEND_PLAN.md` and `../docs/API_CONTRACT_DRAFT.md`.

## How it works

- `app/core/store.py` loads the audited data of one city (about 900 rows) into memory at startup and reloads it when the data version changes (checked every `REFRESH_SECONDS`).
  Requests never wait for the database; if it goes away the API keeps serving the last snapshot and `/v1/health` reports `degraded`. The session is read-only with a statement timeout.
- `app/core/present.py` builds the response shapes. `app/core/scoring.py` is a **copy** of `data/sources/derived/scoring.py` so the backend deploys alone;
  `tests/test_scoring_sync.py` fails if the two differ. Change both together, or `/recommend` stops matching the stored `livability_score_default`.
- `app/core/middleware.py` holds the production protections (request ids, JSON logs, security headers, rate limits, body limit, gzip, weak ETags, CORS). `app/core/config.py` validates the settings.
- Stale data (failed run, reports out of step with the score, weekly data older than 14 days) is **served with an `X-Data-Warning` header** and flagged in `/v1/meta`; it never blocks startup.
- Reasons for metrics a city lacks are data: `app/data/unavailable_metrics.json`. Persona weight presets are data too: `app/data/personas.json`. Review them like data (the Polish text needs a native-speaker check).

## Configuration

Environment variables (or `server/config/.env` for local work; real environment variables win). Values are never printed or logged.

| Variable | Default | Meaning |
|---|---|---|
| `CITY` | required | `warsaw` or `krakow`: the schema this deployment serves |
| `API_DB_URL` | none | **Read-only** database URL (role `api_reader`; create it with the operations script in the private repository). Preferred. |
| `SUPABASE_DB_URL` | none | Fallback if `API_DB_URL` is unset. It can write, so do not use it in production. Session-pooler string, password percent-encoded. |
| `ENVIRONMENT` | `development` | `production` (set by the Docker image) refuses unsafe settings, sends HSTS, and requires `CORS_ORIGINS` |
| `CORS_ORIGINS` | `http://localhost:5173` in development; required in production | Comma-separated origins of this city's frontend. In production: explicit `https://` origins only, never `*`. |
| `RATE_LIMIT_PER_MINUTE` | `600` | Per client address, all `/v1` except `/health`; `0` turns it off. Blunt by design: many users can share an address. |
| `RECOMMEND_RATE_LIMIT_PER_MINUTE` | `60` | Per client address for `POST /v1/recommend`, the one computation |
| `TRUSTED_PROXY_HOPS` | `0` | Reverse proxies in front of the service. With `1`, the client address is the last entry of `X-Forwarded-For`. Leave `0` if nothing trusted sets it (the header can be forged). |
| `MAX_BODY_BYTES` | `16384` | Largest request body; above it the answer is 413 |
| `CACHE_MAX_AGE` / `REFRESH_SECONDS` | `300` / `60` | Cache lifetime of responses; how often the data version is checked |
| `LOG_LEVEL` | `INFO` | |
| `WEB_CONCURRENCY` | `2` | Worker processes in the Docker image. Each has its own snapshot and its own rate-limit counters. |

## Run for development

```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
CITY=krakow .venv/bin/uvicorn app.main:app_from_env --factory --port 8000    # reads the environment, or a local server/config/.env
curl localhost:8000/v1/meta
```

## Test

```bash
.venv/bin/ruff check .                        # lint (run it before a pull request; there is no CI yet)
.venv/bin/python -m pytest -q -m "not live"   # offline: synthetic snapshot, contract, behaviour, languages, hardening, store
.venv/bin/python -m pytest -q -m live         # read-only, real schemas of both cities: golden score test, contract, EN and PL structure, formats, read-only session
```

## Deploy (one container per city)

```bash
docker build -t gdziezamieszkac-backend backend
docker run -d --name gz-warsaw -p 8000:8000 \
  -e CITY=warsaw -e API_DB_URL -e CORS_ORIGINS=https://warsaw.example.org \
  gdziezamieszkac-backend          # API_DB_URL is taken from the calling environment, so it never appears in a file or the process list
```

- Run **two containers**, one per city, each with its own `CITY`, `CORS_ORIGINS` and subdomain. They share the image and the database, nothing else.
- Put a **TLS-terminating reverse proxy** in front (the app sends HSTS in production but does not serve TLS), set `TRUSTED_PROXY_HOPS=1`, and, if you like, add rate limiting at the proxy too.
- The image runs as an unprivileged user, writes nothing to disk, and has a health check on `/v1/health`. Logs are one JSON line per request on stdout (no addresses, no bodies, no headers, no secrets).
- Environment: `CITY`, `API_DB_URL` or `API_DB_URL_FILE` (a path to a file holding the URL; **required in production**, and `SUPABASE_DB_URL` is refused there), `ENVIRONMENT`, `CORS_ORIGINS`, `TRUSTED_PROXY_HOPS`,
  `REFRESH_SECONDS`, `CACHE_MAX_AGE`, `RATE_LIMIT_PER_MINUTE`, `RECOMMEND_RATE_LIMIT_PER_MINUTE`, `MAX_BODY_BYTES`, `LOG_LEVEL`. Multi-architecture build: `docker buildx build --platform linux/amd64,linux/arm64 -t <registry>/gdziezamieszkac-backend:<tag> backend`.
- Pass only the variables the app needs. Never mount or forward `server/config/.env`: it holds keys the backend must never have.
- After a data load the API notices the new version within `REFRESH_SECONDS` without a restart. A restart is only needed to change configuration or rotate `API_DB_URL`.

## Security in place

Least-privilege read-only database role, plus a read-only session and statement timeout; fixed SQL with bound parameters (no request input reaches SQL); input limits and validation on every parameter and on the body;
per-client rate limits and a body size limit; security headers (`nosniff`, `frame-ancestors 'none'`, a locked-down CSP, `no-referrer`, HSTS in production); CORS limited to the city's frontend, no credentials;
no interactive docs or generated schema; errors as problem+json without internals (a request id links a 500 to its log line); no personal data stored or logged; dependencies pinned and checked with `pip-audit`.
Not in the service by design: TLS, authentication (the data is public), a web application firewall. Those belong to the proxy or platform.

## Next steps for the MVP

The task list for the whole project is in `../TODO.md`. These tasks belong to this module.

| ID | Task | Priority |
|---|---|---|
| B1 | Run for Kraków behind a tunnel for the frontend developers. Set `TRUSTED_PROXY_HOPS=1` so rate limits count real clients. | P0 |
| B2 | Add `*_display` fields for the district score, area, commute minutes, recommend score and percentile, and similarity. Change the contract first. | P1 |
| B3 | Add couple and newly married presets to `app/data/personas.json`. `unicorn-alex` reviews the Polish text. | P1 |
| B4 | Keep the offline tests green. Record any change to imported code in `../ON_SITE_CHANGELOG.md`. | Always |
| B5 | Design the services for the later features (personalised AI report, official notices, resident feedback, demand counts). This backend stays read-only with no internet access. Build nothing before a contract change. | After the event |

## Status (2026-10-02)

Implemented: `/health`, `/meta`, `/districts`, `/districts.geojson`, `/districts/{code}` (+ `/report`, `/similar`, `/rent-vs-buy`, `/series/{key}`), `/metrics`, `/metrics/{key}/values`, `/compare`, `/personas`, `/recommend`.
`/districts/{code}/series/{key}` serves the quarterly sale-price history from `district_series` (only `sale_price_median_m2` has history; other metrics answer `404`).
`/commute?from=` serves the stored district-to-district minutes. `/districts/{code}/outlook` serves momentum, the city's historical range and the backtest, and no forward scenario (it failed the gate, see `docs/BACKEND_PLAN.md` section 5).
Both cities' matrices are loaded (checked against a journey planner on 2026-10-02; Kraków's long trips run optimistic, see the private decision log).
Not in the contract yet: the price outlook (only after a passing backtest).
