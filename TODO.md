# TODO and MVP priorities

Last updated 3 October 2026, the first evening of HackYeah. This is the one list for the team. Module files link here.

## How we work

- Work starts from the `develop` branch. Pull requests target `develop`. Only the coordinator merges `develop` into `main`.
- Bugs and requirements are GitHub issues (templates in `.github/`). The pinned issue #4, "Dev environment", has the state of the shared setup. Open an issue for a task before you start it, and write `Closes #n` in the pull request.
- The full rules, including who may merge what and how agents work, are in `REVIEW.md`.
- Status in the tables below: **Open** (not started), **In progress** (has an open issue and a branch), **Done** (merged into `develop`). Whoever changes the state edits this file in the same pull request.

## Key times

The organisers' times are not in this file yet. The coordinator fills them in.

| What | When |
|---|---|
| Demo slot | To be set by `Delta-43` |
| Submission deadline (project description, slides, declaration of earlier work) | To be set by `Delta-43` |
| Freeze: only fixes after this time | To be set by `Delta-43` |

Owners use GitHub handles. `Delta-43` is the coordinator. `unicorn-alex` builds the frontend from 3 October (evening), owns the Polish text and verifies the data. `Rysia` is on break; the handle stays trusted and can return to the frontend.

## The idea

GdzieZamieszkać helps people choose a district of Kraków before they search for a flat. The free tier is a public portal that needs no login.
We pitch it as a service a city could host. The city would hold the official data, publish official notices, and later collect verified feedback from residents.
The full idea, with what exists and what is only a concept, is in `docs/IDEA.md`.

## What the MVP is

A judge can follow one flow in under three minutes:

1. Choose a persona or set priorities.
2. See ranked districts on an accessible map.
3. Open a district: provenance on every number, an AI-labelled report, price history.
4. Compare two districts.

It runs against a live Kraków API, in Polish by default, and it meets the WCAG 2.2 AA basics.
The pitch features (personalised AI report, official notices, resident feedback) are shown as clearly labelled concepts. We do not build fake endpoints for them.

## How we are judged

These weights come from the two official task sheets (Smart City and Artificial Intelligence), which are identical.

| Criterion | Weight | Mostly decided by |
|---|---|---|
| Idea and innovation | 30% | The pitch |
| Relation to category | 20% | The pitch and what the app shows |
| Practical applicability and usability | 20% | The frontend |
| Design | 20% | The frontend |
| Completeness and implementation value | 10% | Everyone |

A few finished screens beat many half-working ones. Hide any feature whose endpoint answers `501`.

## P0: must be done for the demo

| ID | Task | Owner | Done when | Status |
|---|---|---|---|---|
| P0-1 | A live Kraków API the frontend can reach: the coordinator runs the backend and shares it over the team Tailscale network | `Delta-43` | The frontend developer's agent gets `{"status":"ok","database":"reachable"}` from `/v1/health` and `"city": "krakow"` from `/v1/meta`, from the frontend machine. Done so far: all 16 contract operations answer from the coordinator's machine. See `frontend/README.md`. | Live. Not yet checked from the frontend machine |
| P0-2 | Create the frontend project, generate the API types, and build the shared parts: layout, provenance badge, metric row, states, language toggle, theme tokens | `unicorn-alex` | `frontend/TODO.md` tasks F1 to F3 pass review | Open |
| P0-3 | Districts screen: accessible table and SVG map | `unicorn-alex` | Task F4 passes review | Open |
| P0-4 | District detail: every number with provenance, the AI-labelled report, the price history with its table | `unicorn-alex` | Task F5 passes review | Open |
| P0-5 | Find a district: personas and sliders to `POST /recommend` | `unicorn-alex` | Task F6 passes review | Open |
| P0-6 | Compare two to four districts | `unicorn-alex` | Task F7 passes review | Open |
| P0-7 | Sources and "how it works" page: where AI is used and where it is not, limits, credit lines | `unicorn-alex` | Task F8 passes review | Open |
| P0-8 | Accessibility baseline: keyboard, contrast test, automated checks, 320 pixel reflow | `unicorn-alex`, spot-checked by `Delta-43` | `frontend/REVIEW_CHECKLIST.md` passes for the main flow | Open |
| P0-9 | Apply the data verification feedback: fix a value, or add a caveat, for each "Fix" | `Delta-43`, with `unicorn-alex` | `docs/data-review/` records every finding and what changed | Open |
| P0-10 | Submission pack: project description, a PDF of at most 10 slides, the declaration of earlier work | `Delta-43` | Uploaded to the Challenge Rocket platform | Open |

## P1: if time allows, in this order

| ID | Task | Owner | Notes | Status |
|---|---|---|---|---|
| P1-1 | Household profile, kept in the browser, mapped to weights | `unicorn-alex` | `frontend/TODO.md` task F9. Needs couple and newly married presets (B3). | Open |
| P1-2 | Commute from a work district | `unicorn-alex` | Task F10. Show the API's caveat. Long trips run fast. | Open |
| P1-3 | Outlook card: momentum, the city's historical range, the backtest. No forecast | `unicorn-alex` | Task F11 | Open |
| P1-4 | Rent versus buy and similar districts | `unicorn-alex` | Task F12 | Open |
| P1-5 | `*_display` strings for the numbers that lack one (contract B2) | `Delta-43` | Removes a temporary helper in the frontend | Open |
| P1-6 | Polish text review of the interface strings | `unicorn-alex` | Review `pl.json` in each frontend pull request | Open |
| P1-7 | Personas for couple and newly married (B3) | `Delta-43`, text by `unicorn-alex` | A data file change | Open |

## P2: concept only, for the pitch (and the city service, below)

Show these in the slides, or as screens that are clearly marked "concept". Build no endpoint and no fake data.

- Official notices of planned projects and infrastructure, set by the city. **Not implemented. Shown in the app as "to be implemented after city approval".** The Kraków open data portal has no such dataset (checked 3 October 2026). No endpoint, no data.
- Aggregate, anonymous demand counts by district for the city.

Each needs a contract change and a separate service first. `docs/IDEA.md` has the rules for each.

## City service (`city-service/`), decided 3 October 2026

Two features move from concept to real work. Plan: `docs/CITY_SERVICE_PLAN.md`. Each starts with a contract pull request.

| ID | Task | Owner | Status |
|---|---|---|---|
| C1 | `city-service/openapi.yaml` and the service skeleton: config, health, rate limit, tests, `Dockerfile` | `Delta-43` | Open |
| C2 | Personalised AI report (OpenRouter, `z-ai/glm-5.3-flash`). Numbers come from code; AI label on every answer | `Delta-43` | Open |
| C3 | Resident feedback in local SQLite, stored `unverified`, never published | `Delta-43` | Open |
| C4 | Frontend screens for C2 and C3, and the "after city approval" label for notices | `unicorn-alex` | Open, after C1 |

## P3: after the event

- Deploy the stack on a server, with a pipeline for builds and releases, and off-server backups.
- A Polish legal opinion on fees, municipal activity, the reward for feedback, and AI transparency.
- The national login node for identity checks.
- Confirm the reuse terms of the sources that say "check before redistribution": the city noise map, the city open data and the timetable feed.
- A second city.
- Replace the one-time rent snapshot with data-sharing agreements or verified resident reports.

## Backend tasks (module `backend/`)

| ID | Task | Priority |
|---|---|---|
| B1 | Kraków runs behind Tailscale serve, which is tailnet only, with `TRUSTED_PROXY_HOPS=0`. All clients share one rate-limit bucket (about 600 requests a minute, and 60 for `POST /recommend`). Check whether the proxy sets `X-Forwarded-For`. If it does, set `TRUSTED_PROXY_HOPS=1` so limits count real clients. If not, keep `0`. | P0, open |
| B2 | Add `*_display` fields for district score, area, commute minutes, recommend score and percentile, similarity. Contract first | P1 |
| B3 | Add couple and newly married presets to `app/data/personas.json`, with Polish text reviewed by `unicorn-alex` | P1 |
| B4 | Keep the offline tests green. Record any change to imported code in `ON_SITE_CHANGELOG.md` | Always |
| B5 | Services for the P2 features. Notices and demand counts stay concepts. The AI report and feedback are tasks C1 to C3 | P3 |

## Open decisions

- Whether one project may be entered in both tasks. Ask the organisers.
- How the AI task sees a meaningful, checkable role for AI. Today it narrates reports and translates, and it never computes the score.
- The visual design. The coordinator accepted `docs/DESIGN.md` for now (3 October): the Field Journal system with our changes. Build task F3 from `docs/design/field-journal.tokens.css`. The placeholder theme is only a fallback.
- Which licence terms apply if the project ever becomes commercial: the road accident data needs written approval.

## Risks

- **No deployed API.** The demo depends on the coordinator's machine staying awake and on Tailscale. Record a backup screen capture of the main flow.
- **Time.** The frontend starts from nothing. Keep to P0.
- **Rent figures** are asking rents from a one-time snapshot. Show the caveat, and show the low-confidence marks.
- **Accessibility** is a legal requirement for a public service. Test the main flow with a keyboard and a screen reader before the demo.
