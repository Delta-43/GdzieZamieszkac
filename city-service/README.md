# city-service/ — the AI report and resident feedback

A separate FastAPI service next to the read-only API (`backend/`). Contract: `openapi.yaml`. Plan and decisions: `../docs/CITY_SERVICE_PLAN.md`. Rules: `../AGENTS.md`.

| Endpoint | What it does |
|---|---|
| `GET /v1/health` | Liveness, whether the data API is reachable, whether the model key is set |
| `POST /v1/ai-report` | Ranks with the API's `/recommend`, then a model narrates the top three districts from a fixed fact list |
| `POST /v1/feedback` | Stores one report (`rent_paid` or `data_problem`) as `unverified` in local SQLite |
| `GET /v1/feedback/status` | Says what happens to a report: not published, changes no score, no identity check yet |

## Guarantees

- **The score is computed in code.** The model only writes text. The ranking is the API's. `requirements` never changes it.
- **Number guard.** Every number in the generated text must be in the facts. Otherwise the text is dropped and the answer is `502`.
- **AI label** (`ai_generated`, `label`) on every report, in Polish or English.
- **The typed text is not stored or logged.** It goes to OpenRouter. Validation errors name fields, never values. There is no access log.
- **Feedback** is `unverified`, never published, never used in a score, and stores no address and no account. Gov ID gating comes later.
- The frontend may call this service. It is the only place the model provider is called.

## Configuration

Environment variables, or `../server/config/.env` for local work (real variables win). Values are never printed.

| Variable | Default | Meaning |
|---|---|---|
| `OPENROUTER_LLM_KEY` (or `_FILE`) | none | The key. Without it the AI report answers `503`. |
| `OPENROUTER_MODEL` | `z-ai/glm-5.3-flash` | The model. It always reasons, so the call asks for low effort and hides the reasoning. |
| `API_BASE_URL` | `http://localhost:8000/v1` | The read-only API |
| `FEEDBACK_DB_PATH` | `city-service/data/feedback.sqlite` (`/data/feedback.sqlite` in Docker) | The SQLite file. Git-ignored. |
| `CITY_SERVICE_CORS_ORIGINS` | `http://localhost:5173` | Comma-separated origins. Explicit in production. |
| `AI_RATE_LIMIT_PER_MINUTE` / `FEEDBACK_RATE_LIMIT_PER_MINUTE` | `10` / `30` | One shared bucket per endpoint (the tailnet proxy hides client addresses) |
| `MAX_BODY_BYTES` | `8192` | |

## Run

```bash
cd city-service
../backend/.venv/bin/pip install -r requirements-dev.txt     # or a venv of your own
../backend/.venv/bin/uvicorn app.main:app_from_env --factory --host 127.0.0.1 --port 8100 --no-access-log
curl localhost:8100/v1/health
```

## Test

```bash
../backend/.venv/bin/ruff check .
../backend/.venv/bin/python -m pytest -q        # offline: the API and the model are faked
```

## Container

```bash
docker build -t gdziezamieszkac-city-service city-service
docker run -d -p 8100:8100 -v gz-feedback:/data -e OPENROUTER_LLM_KEY -e API_BASE_URL=http://<api-host>:8000/v1 \
  -e CITY_SERVICE_CORS_ORIGINS=https://<frontend-origin> gdziezamieszkac-city-service
```
