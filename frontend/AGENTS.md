# AGENTS.md: frontend

Read this file first. Then read `README.md`, `REQUIREMENTS.md`, `API.md` and `ACCESSIBILITY.md` in this folder.
If `HACKATHON_TRACKS.md` and `HANDOFF.md` exist here, read them too. They hold `Rysia`'s working agreement and the hackathon's judging rules.
The API contract is `../backend/openapi.yaml`. If a rule here conflicts with the root `../AGENTS.md`, ask the coordinator.

## What this module is

The React app for the **Kraków hackathon edition** of GdzieZamieszkać. It shows one city, Kraków, and talks to one read-only backend (`CITY=krakow`).
The app has no code yet. This folder holds the guide files and empty folders only. The frontend developer creates the project from them.

## Hard rules

1. **The contract is `backend/openapi.yaml`.** Generate the API types from it. Do not write response shapes by hand.
   To change the API, open a pull request that changes the contract first.
2. **One city, no hard-coded name.** Read the city name from `/meta` (`city_name`). Do not add a city switcher.
   This keeps the code ready for a second city later.
3. **Show what the API gives, as given.** Show every `display` string as it is. Never format a number in the browser.
   A few numbers have no `display` string yet. `API.md` lists them under "Contract gaps".
4. **Show provenance beside every value.** That means the data kind badge (`observed`, `estimated`, `proxy`), the source, the as-of date and the caveat.
   A metric without data shows its `reason`. It never shows a zero or an empty cell.
5. **Wording.** Crime is "recorded crimes per 10 000 residents". Never write "safe" or "dangerous".
   Say that a score compares the districts of one city only.
6. **Language.** Polish is the default. English is a toggle. Send `?lang=pl` or `?lang=en` on every API call, because the API default is English.
   Text from the API is never translated in the browser. No translation service is called from the client.
   Static interface text lives in hand-written `pl.json` and `en.json` files. `unicorn-alex` reviews the Polish.
7. **Accessibility is a legal requirement.** The target is WCAG 2.2 level AA. `ACCESSIBILITY.md` says what that means for this app.
8. **Privacy.** Make no request to a third party. That rules out web fonts from a CDN, map tiles, analytics and trackers.
   The only thing the app stores in the browser is the language choice. Add anything else only after a recorded decision.
9. **No secrets.** Every `VITE_` variable is public. The database URL and keys must never appear in this module.
10. **AI text carries a label.** Every area report shows that it was written by artificial intelligence from the data (EU AI Act, Article 50).
11. **Scores are relative to one city.** Never combine or compare scores from two cities.
12. **Real data only.** The product never shows invented numbers. Test fixtures are the only fake data, and they stay in tests.

## Handle the API's states

- Show a problem+json error with what happened and what to do next. No blame, no "Oops!".
- Show a small notice when the API sends `X-Data-Warning`, or when `/meta` says `stale.is_stale`.
- Show a note when `lang_fallback` is true, because the text is then in English.
- Hide a feature when its endpoint answers `501`. Do not show an error page.

## Do not build these without a contract change

Accounts, saved searches, any request that writes data, the personalised AI report, official notices, resident feedback, and demand counts.
`REQUIREMENTS.md` describes them as later phases. Do not build against an endpoint that is not in `openapi.yaml`.

## Workflow

- Work on a branch and open a pull request. Do not push to `main`.
  Name it `frontend/<short-description>`. If git refuses because a branch named `frontend` exists, use `ui/<short-description>`.
- `unicorn-alex` reviews frontend pull requests and checks the contract, the licences, the provenance labels and the Polish text.
- The coordinator or Claude merges after validation.
- Keep each pull request small, so a review takes minutes.

## Before you finish a task

- [ ] Types come from the current `openapi.yaml`.
- [ ] Both languages render, and the page language attribute follows the toggle.
- [ ] Provenance badges, reasons, caveats and attribution are visible.
- [ ] You tested with the keyboard only and checked the contrast.
- [ ] Automated accessibility checks pass.
- [ ] The run, build and test commands are in `README.md`.
