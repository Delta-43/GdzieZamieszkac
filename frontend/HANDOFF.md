# Frontend hand-off: state on 4 October 2026, after the map work

For the next session on `frontend/`, human or agent. Updated by the coordinator's agent after the second backend test. The earlier versions are in the git history (pull requests #15 and #41).

Read first: `../AGENTS.md`, `../REVIEW.md` section 7, `AGENTS.md`, then this file, then `TODO.md`. `GUIDELINES.md` has the working rules and the full history of decisions.

## Where things stand

- The app exists and runs. Everything in `TODO.md` for phase 1 is built: F1 to F8 and C4-0 to C4-3 (the last four arrive with the branch `frontend/map-home`, see below).
- Pages: home (`/`) with a search by district name and the map, districts with the map and the list (`/districts`), one district (`/districts/<code>`), find a district (`/find`) with the AI report card, compare (`/compare?codes=a,b`), feedback (`/feedback`), sources and how it works (`/sources`), and "page not found".
- **The map is the centre of the app** (issue #70). Layers: the district buttons as SVG, filled with their colour (`DistrictMap.tsx`), and context from OpenStreetMap. The canvas of small squares was removed on 4 October (it slowed the page down); the colours still change in a short wave. Read "The map" in `README.md` before you change any of it. The context file is not in git (ODbL): run `python3 frontend/scripts/build_basemap.py` while the data API runs, or the map shows districts alone. `?district=<code>` selects and zooms to a district.
- The design is decided in two parts: the look of krakow.pl (`../docs/DESIGN.md`, `src/theme/tokens.ts`, Lato) is in use; the **coordinator asked for the design language of the official Polish government sites** (gov.pl). That is the next design task: read the official design documentation first, check the app against it, and change `tokens.ts` and the styles. Do not guess its details.
- `npm run check` passes: both contracts in `api:check`, lint, type check, 150 tests, build. The same command runs in CI (`../.github/workflows/ci.yml`) on every pull request.

## What `frontend/map-home` holds

One branch with all the frontend work that was open on 4 October, cut from `develop` at `8ad6d60` and merging cleanly with it. It contains, in this order: C4-3 (notices label, #64), C4-2 (feedback page, #65), F8 (sources page, #66), and the map work (#70). The pull requests #67 and #68 were merged into `develop` separately, while this branch was being finished. #69 (F8) holds the third alone: it is redundant once this branch is merged and can then be closed.

## Next steps, in order

1. **Merge `frontend/map-home`** (pull request #71 into `develop`), then close #69 if GitHub has not.
2. **The government look.** Read the official Polish government design system documentation (gov.pl). Write down what applies (type, colour, components, header and footer, form patterns) in `../docs/DESIGN.md`, then change `tokens.ts` and the styles. Keep the contrast pairs in `theme.test.ts` honest. Polish text goes to `unicorn-alex`.
3. **Manual accessibility checks** that were never done: keyboard only, a screen reader (NVDA), 200 and 400 percent zoom, on every page. Update the draft statement in `src/pages/SourcesPage.tsx` and `en.json`/`pl.json` (`about.a11y`) when they are done.
4. **Small fixes** at the end of `TODO.md` (favicon, long district names on the map, `plainNumber.ts` after backend task B2).
5. **Phase 2** (F9 to F12) only after the above.

## Rules that stay

- `facts` and `score_display` of the AI report follow `lang`. Show the API's `label` as given, and `report` as plain text, never as HTML.
- The endpoint allows 10 reports a minute for the whole team, and each one costs the coordinator's model budget. Send only on the button. Use fixtures in tests.
- The city name comes from `GET /meta`, never from the code. The city service does the same.

## Contract gaps we work around

`/metrics` sends no category label; `/recommend` sends no data kind and no display string for a score; scores, areas and percentiles have no display string (`src/lib/plainNumber.ts`, delete it when backend task B2 lands); source names in `/meta` arrive in English for `lang=pl`. Raise each as a `contract` issue if it still matters.

## Decisions that stay with the coordinator

- Two rules bent on the developer's decision, flagged in pull request #35: the map outline is one hairline and does not reach 3:1 on the two darkest classes; the districts list shows only the overall score.
- A logo, a favicon or a crest: the city would provide them.

## How to run it

- The two servers run on the coordinator's machine, on the team Tailscale network. The host name is private. Ask `Delta-43` and never write it in a committed file, an issue or a pull request.
- `frontend/.env.local` (git-ignored) needs `VITE_DEV_API=http://<host>:8000` and `VITE_DEV_CITY=http://<host>:8100`. `.env.example` lists every variable.
- `npm run dev` listens on the network on port 5173 and forwards `/v1/ai-report` and `/v1/feedback` to the city service and every other `/v1` path to the data API.
- Check: `/v1/health` answers `{"status":"ok","database":"reachable"}`, and `/v1/feedback/status` answers with `"identity_check":"not_yet"`.

## Things that cost time

- **The dev server loses its settings when a branch without `frontend/vite.config.ts` is checked out.** It keeps running without the proxy, and every API call then returns the page itself. Restart it after such a switch.
- **Merging.** In an agent's session `gh pr merge` can be refused by the tool's permission check. Open the pull request, state that the section 7 conditions hold, and let the person merge.
- **Stacked branches.** Start each new task from a current `develop`.
- **Changelog.** Do not edit `ON_SITE_CHANGELOG.md`. Add one new file to `../changelog/` (`../changelog/README.md`).
- **Screenshots at 320 pixels.** A headless Chrome window will not go narrower than about 500 pixels. Set the width through the DevTools protocol (`Emulation.setDeviceMetricsOverride`).
