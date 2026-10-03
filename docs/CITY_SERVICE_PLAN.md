# City service plan (notices, AI report, resident feedback)

Status: **proposal, waiting for the coordinator's decisions** (section "Decisions needed").
Replaces the "concept only" status of P2 in `TODO.md` for three features. Demand counts stay a concept.
Nothing here is built. The rules in `AGENTS.md` still apply; section "Rule changes" lists the ones that must change.

## Split

| Feature | Where | Why |
|---|---|---|
| Official notices | `backend/` (read-only API) | A reviewed, versioned data file. It needs no writes and no internet. |
| Personalised AI report | `city-service/` (new) | A language model call needs internet and an API key. The backend must keep neither. |
| Resident feedback | `city-service/` (new) | It needs writes and storage. The backend must stay read-only. |

`city-service/` is a separate FastAPI app with its own folder, container, secrets and database role. It never shares a database role with the backend. It reads the same public facts through the backend API (`GET /v1/...`), never through the database.

## Contracts (first pull requests, no code)

1. `backend/openapi.yaml`: add `GET /notices` and `GET /districts/{code}/notices` (read-only).
2. `city-service/openapi.yaml` (new file): add `POST /v1/ai-report`, `POST /v1/feedback`, `GET /v1/feedback/status`.
   `AGENTS.md` names only `backend/openapi.yaml` as the contract, so this file needs a root rule: each service has its own contract and the same contract-first rule.

## 1. Official notices

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

## Decisions needed

1. **Model provider and key.** Which model and which account? The key stays in the environment of `city-service/`, never in the repository.
2. **Notice sources.** Which public documents may we cite, and who checks the licences? Without real entries the endpoint ships empty.
3. **Feedback without identity.** Is a no-identity, never-published, unverified intake acceptable for the demo? The alternative is to show the feedback screen as a concept only.
4. **Database for feedback.** A new schema in the existing Supabase project with its own role, or a local SQLite file for the demo?
5. **Hosting.** `city-service/` runs on the coordinator's machine behind Tailscale like the API, with a second CORS origin entry.
