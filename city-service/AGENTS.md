# AGENTS.md — city-service/

Read the root `AGENTS.md` first. This file adds what is specific to `city-service/`. Contract: `openapi.yaml`; change it first, in a pull request.

- **The model narrates, code computes.** Never let the model produce a score, a rank or a number. `app/guard.py` drops a text that holds a number outside the facts. Keep that test green.
- **Never store or log the typed text** of `/ai-report`, and never echo it in an error. Do not add an access log, a request-body log, or an analytics call.
- **Feedback is `unverified`** and is never published, never read by `backend/`, and never changes a score. Store no address, no account, no header.
- **Secrets** (`OPENROUTER_LLM_KEY`) come from the environment or `server/config/.env`. Never print or commit them. The database file is git-ignored.
- The service reads facts through the API over HTTP. It never opens the Postgres database.
- Tests are offline: the API and the model are faked. Run `ruff check .` and `pytest -q` from this folder before a pull request.
