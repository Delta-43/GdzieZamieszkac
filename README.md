# GdzieZamieszkać (Kraków edition)

GdzieZamieszkać means "where to live". This project helps people choose a district of Kraków before they start looking for a flat.
It compares all 18 districts using public data: transport, amenities, air, noise, green space, safety indicators, and sale and rent prices.

It is not a listings site. It shows data about districts, not offers.

We pitch it as a public service that a city could host. The free tier needs no login. Every number shows where it comes from, when, and how reliable it is.

## What was built when

HackYeah asks teams to separate work done during the event from work that existed before. This section does that.

| Part | When | Status |
|---|---|---|
| Data collection and the Supabase database (`krakow` schema) | Before the event, 29 September to 2 October 2026, for research | Reused as it is |
| Backend API (16 operations), its contract, tests and the database migrations | Before the event, same dates | Reused. Changes made on site are listed in `ON_SITE_CHANGELOG.md` |
| Frontend | On site, 3 and 4 October 2026 | In progress. Today `frontend/` holds guide files and empty folders. |
| Guide files, this README, the sources document and the changelog | On site, 3 October 2026 | Done |

The first commit of this repository is the import of the earlier work. Every later commit is work done on site.
The earlier work lived in a private repository. It was copied here with personal data removed, and with no other change to the code.

The data pipeline and the data itself stay private. This repository holds the backend that serves the stored data, and the documents that describe it.

## What the backend serves today

- Compares 18 districts on 45 metrics. Each metric is labelled `observed`, `estimated` or `proxy`.
- Computes a livability score in code from percentile ranks. It compares districts of one city only.
- Lets a user weight what matters to them, with preset personas, and ranks the districts.
- Serves quarterly sale price history, price momentum, public transport time between districts, and a rent-versus-buy estimate.
- Serves a plain-language report per district in Polish and in English.

The price outlook does not forecast. We tested two methods and neither beat the naive baseline, so the API publishes history and the backtest only.

## How we use artificial intelligence

We disclose all significant use, as the event rules require.

- **The score is not AI.** It is computed in code and tested.
- **District reports.** A language model (`z-ai/glm-5.3-flash`, through OpenRouter) writes each report from a structured list of facts. A guard rejects any text that contains a number that is not in the facts. Reports are generated ahead of time and stored. The frontend must label every report as AI-written.
- **Personalised AI report (new on site, `city-service/`).** The same model (`z-ai/glm-5.3-flash`, through OpenRouter) narrates the top three districts for a person's priorities, at request time. The ranking is computed in code and the model only writes text from a fixed fact list. The same number guard drops any text with a number outside the facts. Every answer carries an AI label. The typed text goes to OpenRouter and is neither stored nor logged by us.
- **Translation.** A language model (`deepseek/deepseek-v4.1-flash`, through OpenRouter) translates stored text between English and Polish. A glossary and a number check come first. Nothing is translated at request time.
- **Development.** We used Claude Code (Anthropic) to help write and review code and documents. We review and can explain all of it.

## Data sources and licences

`docs/DATA_SOURCES.md` lists every source with its licence and credit line. Three things to know:

- The sale prices come from the national register of real estate prices (RCN), which is open data.
- The rent figures are medians of asking rents from Otodom and OLX listings, taken once on 30 September 2026. The listings are not redistributed. Only district medians are shown.
- The road accident data is free for non-commercial use with a credit line. Commercial use needs written approval.

## Run the backend

The backend is read-only. It needs a read-only database URL. The database is a private Supabase project, so no credentials are in this repository. Ask the team for a read-only `API_DB_URL`.

```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
API_DB_URL=... CITY=krakow .venv/bin/uvicorn app.main:app_from_env --factory --port 8000
curl localhost:8000/v1/meta
.venv/bin/python -m pytest -q -m "not live"
```

`backend/README.md` explains the settings, the security measures and the Docker build.

## Status and priorities

The data and the backend are done. The frontend is the work of this event. `TODO.md` lists the MVP priorities for every module.
`docs/IDEA.md` describes the full idea, including the city-service concepts that are not built.

## Frontend

The frontend starts from the guide files in `frontend/`. Read `frontend/AGENTS.md` first.
It targets WCAG 2.2 level AA, with Polish as the default language and an English toggle.

## Layout

```
backend/                  FastAPI app, the API contract (openapi.yaml) and tests
frontend/                 guide files and empty folders; the app is built on site
docs/                     API contract notes, backend plan, data dictionary, data sources
server/migrations/krakow/ SQL that created the krakow schema
data/sources/derived/     scoring.py, the scoring code the backend copies
TODO.md                   priorities and tasks for every module
ON_SITE_CHANGELOG.md      what changed during the event
LICENSE                   proprietary copyright notice
CODEOWNERS                who reviews what
presentation.html         the HackYeah pitch deck; open it in a browser
```

## Team

`Delta-43` (coordinator and backend), `Rysia` (frontend), `unicorn-alex` (Polish text and contract review).

## Licence

Proprietary. Copyright (c) 2026 the GdzieZamieszkać team. All rights reserved. The repository is public so that readers can look at the work.
Publishing it does not grant a licence to copy, modify or use it. See `LICENSE`.
Third-party data and components keep their own licences. See `docs/DATA_SOURCES.md`.
