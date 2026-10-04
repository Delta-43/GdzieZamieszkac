# Frontend tasks

Do these in order. Each task is one small pull request, opened with `--base develop`. Open a GitHub issue for the task first, and write `Closes #n` in the pull request. `../REVIEW.md` has the full rules, and `../TODO.md` has the status of every task.

`Rysia` is back on the frontend since the evening of 3 October and builds these tasks, with `unicorn-alex` as reviewer (agreed between them; `../TODO.md` still lists the earlier owner).
The state of the work, the open decisions and the next steps for a new session are in `HANDOFF.md`. The priorities for the whole project are in `../TODO.md`.
Tasks F1 to F8 are the MVP (P0). Tasks F9 to F12 are P1. Do not start a P1 task before the P0 tasks pass review.

The screen details and the acceptance criteria are in `REQUIREMENTS.md`. The API is in `API.md`. The accessibility rules are in `ACCESSIBILITY.md`.

## Before you write code

1. Read `AGENTS.md`, then `README.md`, then `REQUIREMENTS.md`.
2. Read `HANDOFF.md`: what is built, what is decided, and what comes next.
3. Get an API to build against. Follow "Get an API" in `README.md`.
4. Run `npm install` and `npm run check` in this folder before you change anything.

## MVP tasks (P0)

Status on 4 October 2026. "Done" means merged into `develop`.

| ID | Task | Size | Done when | Status |
|---|---|---|---|---|
| F1 | Create the project, the lint and test setup, and the API types generated from `../backend/openapi.yaml` | S | `npm run build`, lint and tests pass. A check fails when the committed types differ from a fresh run. | Done (#20) |
| F2 | Layout and shared parts: skip link, header, navigation, language toggle (Polish default), footer with credit lines, stale-data notice, loading and error states | M | Both languages render. The page language attribute follows the toggle. The keyboard reaches everything. | Done (#20, #28, #35) |
| F3 | Theme tokens in one file, with a test that checks the contrast of every pair | S | The test fails if a pair drops below 4.5:1 for text or 3:1 for interface parts | Done (#20, #26). The palette is still the coordinator's open decision. |
| F4 | Districts screen: accessible table from `/districts`, then the SVG map from `/districts.geojson` coloured by a chosen metric | L | Every district is reachable by keyboard. The table holds everything the map shows. No colour-only signal. | Done (#20, #22, #35). The list was shortened on the developer's decision. |
| F5 | District detail: all categories with provenance, the report with its AI label, price history with a table and low-confidence marks | L | Every number shows its data kind, source, date and caveat. A missing metric shows its reason. | Done (#24) |
| F6 | Find a district: persona presets and category sliders to `POST /recommend`, with the top drivers | M | With no weights the ranking equals the default score. The result is announced to screen readers. | Done (#30) |
| F7 | Compare two to four districts from `/compare` | M | A table with real headers. It marks no safety winner. | Done (#51, #62) |
| F8 | Sources and "how it works" page, and the draft accessibility statement | S | It lists every source and credit line from `/meta`, says where AI is used, and says what it does not do | Done (PR for issue #66) |

## City service tasks (C4 in `../TODO.md`)

The city service (`../city-service/`, contract `../city-service/openapi.yaml`) writes the personalised AI report and stores resident feedback. Build in this order (developer's decision, 3 October).

| ID | Task | Done when | Status |
|---|---|---|---|
| C4-0 | Types from the city service contract, a second API client, the dev proxy | `npm run api:check` covers both contracts | Done (#41) |
| C4-1 | AI report card on the find page: a text field, a notice that the text goes to a model provider and is not stored, a button; then the API's label, the text, the three districts and the facts as the basis | The AI label from the API is visible. A `502` or `503` shows a message and the page still works. The ranking shown is the API's. | Done (#47) |
| C4-2 | Feedback page with two forms: rent paid, and a data problem | The API's "unverified, not published" note is shown before sending. Field errors are named in text. Nothing is stored in the browser. | Done (#68) |
| C4-3 | Notices label: "to be implemented after city approval" | A short, clearly marked section. No endpoint is called and no notice is invented. | Done (#67) |

## Small fixes waiting

- Add a favicon: the browser logs a 404 for `/favicon.ico`.
- Manual checks that were never done on any page: a keyboard pass, 320 pixels, 200 and 400 percent zoom, a screen reader. `REVIEW_CHECKLIST.md` section 5.
- Delete `src/lib/plainNumber.ts` when the contract adds the `*_display` fields (backend task B2).

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
- The personalised AI report and resident feedback are built against the city service (tasks C4 above). Official notices and demand counts stay concepts: build no endpoint and no data for them.

## Later (not in the MVP)

Concepts for the pitch. Build nothing beyond the label in C4-3.

- Official notices, published by the city.
- Identity checks for feedback (the national login node).
- Aggregate demand counts.
