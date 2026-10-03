# Frontend tasks

Do these in order. Each task is one small pull request. The priorities and owners for the whole project are in `../TODO.md`.
Tasks F1 to F8 are the MVP (P0). Tasks F9 to F12 are P1. Do not start a P1 task before the P0 tasks pass review.

The screen details and the acceptance criteria are in `REQUIREMENTS.md`. The API is in `API.md`. The accessibility rules are in `ACCESSIBILITY.md`.

## Before you write code

1. Read `AGENTS.md`, then `README.md`, then `REQUIREMENTS.md`.
2. Write a short plan: the stack, the screen order and the folder layout. Share it with the coordinator and wait for a yes.
3. Get an API to build against. Follow "Get an API" in `README.md`.
4. Create the project in this folder. Keep the empty folders as they are, or change them in a pull request that explains why.

## MVP tasks (P0)

| ID | Task | Size | Needs | Done when |
|---|---|---|---|---|
| F1 | Create the project, the lint and test setup, and the API types generated from `../backend/openapi.yaml` | S | An API URL | `npm run build`, lint and tests pass. A check fails when the committed types differ from a fresh run. |
| F2 | Layout and shared parts: skip link, header, navigation, language toggle (Polish default), footer with credit lines, stale-data notice, loading and error states | M | F1 | Both languages render. The page language attribute follows the toggle. The keyboard reaches everything. |
| F3 | Theme tokens in one file, with a test that checks the contrast of every pair | S | F1 | The test fails if a pair drops below 4.5:1 for text or 3:1 for interface parts |
| F4 | Districts screen: accessible table from `/districts`, then the SVG map from `/districts.geojson` coloured by a chosen metric | L | F2, F3 | Every district is reachable by keyboard. The table holds everything the map shows. No colour-only signal. |
| F5 | District detail: all categories with provenance, the report with its AI label, price history with a table and low-confidence marks | L | F2 | Every number shows its data kind, source, date and caveat. A missing metric shows its reason. |
| F6 | Find a district: persona presets and category sliders to `POST /recommend`, with the top drivers | M | F2 | With no weights the ranking equals the default score. The result is announced to screen readers. |
| F7 | Compare two to four districts from `/compare` | M | F2 | A table with real headers. It marks no safety winner. |
| F8 | Sources and "how it works" page, and the draft accessibility statement | S | F2 | It lists every source and credit line from `/meta`, says where AI is used, and says what it does not do |

## Phase 2 tasks (P1)

| ID | Task | Size | Needs | Done when |
|---|---|---|---|---|
| F9 | Household profile in the browser, mapped to weights, with a budget filter | M | F6, backend task B3 | Nothing is stored. The budget filter uses the numeric values from `/metrics/{key}/values`. The result is labelled an estimate. |
| F10 | Commute from a work district, from `/commute` | S | F4 | The API caveat is shown. Hidden when the endpoint answers `501`. |
| F11 | Outlook card: momentum, the city's historical range, the backtest | S | F5 | It never shows a forecast or ranks districts by growth |
| F12 | Rent versus buy with a flat size input, and similar districts | S | F5 | The result is labelled an estimate |

## Rules for every task

- Keep each pull request small, so a review takes minutes.
- Add or update tests. Include an automated accessibility check for each page.
- Run the checklist in `REVIEW_CHECKLIST.md` yourself before you ask for a review.
- If the API is missing something, do not invent it. Ask the coordinator to change the contract first. `API.md` lists the known gaps.
- Do not build any "later" feature: the personalised AI report, official notices, resident feedback, and demand counts.

## Later (not in the MVP)

These are concepts for the pitch. Leave room in the layout and build nothing.

- Personalised AI report.
- Official notices.
- Resident feedback with identity checks.
- Aggregate demand counts.
