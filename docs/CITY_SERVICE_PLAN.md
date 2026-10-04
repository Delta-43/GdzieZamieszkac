# City service plan (notices, AI report, resident feedback)

Status (4 October 2026): **the AI report (section 2) and resident feedback (section 3) are built** in `city-service/` (tasks C1 to C3, contract `city-service/openapi.yaml`) and used by the frontend. **Official notices (section 1) and demand counts are not built** and stay concepts. The decisions below were taken on 3 October; the text is kept as the record of the design.
Replaces the "concept only" status of P2 in `TODO.md` for two features: the AI report and resident feedback. **Official notices and demand counts stay concepts.** Notices are shown as "to be implemented after city approval" (coordinator, 3 October).
The rules in `AGENTS.md` apply; section "Rule changes" lists the ones that changed for the city service.

## Split

| Feature | Where | Why |
|---|---|---|
| Official notices | Not built | Waits for the city. Concept label only. The section below is the design for later. |
| Personalised AI report | `city-service/` (built) | A language model call needs internet and an API key. The backend must keep neither. |
| Resident feedback | `city-service/` (built) | It needs writes and storage. The backend must stay read-only. |

`city-service/` is a separate FastAPI app with its own folder, container, secrets and database role. It never shares a database role with the backend. It reads the same public facts through the backend API (`GET /v1/...`), never through the database.

## Contracts (first pull requests, no code)

1. `city-service/openapi.yaml` (new file): add `POST /v1/ai-report`, `POST /v1/feedback`, `GET /v1/feedback/status`.
   `AGENTS.md` names only `backend/openapi.yaml` as the contract, so this file needs a root rule: each service has its own contract and the same contract-first rule.

## 1. Official notices (not built, design for later)

- Fields: `id`, `district` (a code, or `null` for the whole city), `title`, `summary`, `kind` (`planned_project`, `infrastructure`, `closure`), `status` (`planned`, `in_progress`, `done`), `valid_from`, `published_at`, `source_name`, `source_url`, `licence`, `attribution`, `caveat`.
- `data_kind` is `official`. This is a new kind next to `observed`, `estimated` and `proxy`, and it needs a contract change.
- Wording rule: a notice is never a price forecast. The caveat says so on every notice.
- Data lives in `backend/app/data/notices.json`, one file, reviewed like `personas.json`. Polish text needs `unicorn-alex`.
- **Content must be real.** Each entry cites a public city document (for example the investment plan or a public transport decision). No entry without a source URL and a licence. If there is no real entry for a district, the endpoint answers an empty list with the reason, never a made-up item.
- Whether the city may publish into this file directly is a later question. For now the coordinator curates it.

## 2. Personalised AI report

- Input: the typed requirements (at most 1 000 characters), the weights or persona, optional household fields, `lang`.
- The score and every number come from code (`/recommend`, `/districts/{code}`). The model only writes the narration over a fixed, supplied fact list. It never computes or ranks.
- Guards, copied from the existing report rules: cite only supplied numbers; mark estimates and proxies; no "safe" or "dangerous"; no steering by who lives in a district. A check after generation drops the report if it contains a number that is not in the supplied facts.
- Every response carries `ai_generated: true`, the model name, the date and a Polish and English label text. The frontend shows the label.
- Privacy: the typed text goes to the model provider. The service logs and stores nothing of it. The interface tells the user before the first request. A rate limit applies per client.
- Failure: if the model is unavailable the endpoint answers `503` with a reason, and the stored area report (`/districts/{code}/report`) stays available.

## 3. Resident feedback

- Two types only: `rent_paid` (district, flat size band, rent, month) and `data_problem` (district, metric key, text). No crime sightings.
- Storage: a table in a separate schema with a write-only role for the service. The public API never reads it.
- Status of a report: `received`, `verified`, `rejected`. Only `verified` reports can ever be used, and none is used in the score. A verified count may be shown after a minimum count per district, never single values.
- **Identity:** the national login node is not available. Until it is, there is no identity check, so the service stores reports as `unverified` and `GET /feedback/status` says so. Nothing from feedback reaches a public number.
- Personal data: store no address and no account. No free text goes public. Retention and deletion rules need the legal opinion (P3).

## Rule changes (coordinator only)

| File | Change |
|---|---|
| `AGENTS.md` | "The backend is read-only and stores nothing" stays for `backend/`. Add: `city-service/` may store feedback, in its own database role. The frontend may call two origins, the API and the city service, both ours. Each service has its own contract. |
| `TODO.md` | Move the three features from P2 to P1, with owners. Keep demand counts in P2. |
| `docs/DATA_SOURCES.md` | One row per notice source, with the licence and credit line. |
| `README.md` | Disclose the language model and provider. |
| `ON_SITE_CHANGELOG.md` | One line per merged change. |

## Order of work

1. Decisions below.
2. Rules and contract pull requests (no code).
3. Notices: data file, endpoint, tests, then the frontend card.
4. City service skeleton: config, health, rate limit, tests.
5. AI report, then feedback.

## Decisions (3 October 2026, coordinator)

1. **Model:** OpenRouter, model `z-ai/glm-5.3-flash`. The coordinator provides the key. It goes in the environment of `city-service/` (`OPENROUTER_LLM_KEY`), never in the repository. OpenRouter is a third party, so this is a backend call only. The frontend still calls no third party.
2. **Notice source:** the Kraków open data portal (`otwartedane.um.krakow.pl`). **Finding:** on 3 October its 45 datasets hold no planned-project, road-works or investment dataset. The portal links the city API portal (`api.um.krakow.pl/devportal`), not checked yet. Open question below.
3. **Feedback identity:** Gov ID gating comes later. Today reports are stored as `unverified`, nothing is published, and the interface says so.
4. **Feedback storage:** a local SQLite file, outside the repository (`FEEDBACK_DB_PATH`), created by the service. It is git-ignored and never committed.
5. **Hosting:** as the API: the coordinator's machine, on Tailscale, with a second CORS entry. Containers later; each service gets its own `Dockerfile`, configured by environment only, like `backend/`.

## Still open

- **Where the real notices come from.** Options: (a) the city API portal if it has a suitable feed; (b) one dataset from `dane.gov.pl` or the BIP of Kraków, with its licence checked; (c) ship the endpoint and the model empty, so the frontend shows "no notices published" until the city publishes. Until one is chosen, no notice entry is written.

## Update, 3 October 2026

- Notices: the coordinator decided they come later, from the city. The Kraków open data portal has no planned-project dataset. The ten culture and sport datasets (categories 5 and 15) are statistics of past editions, not notices, and are not used for this feature. Reuse of that portal needs the credit line "Gmina Miejska Kraków, otwartedane.um.krakow.pl" and the dates of creation and acquisition.
- The model key is read from `OPENROUTER_LLM_KEY`.
