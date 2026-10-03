# Frontend hand-off: state on 4 October 2026

For the next session on `frontend/`, human or agent. Updated by the coordinator's agent after the second backend test. The earlier versions are in the git history (pull requests #15 and #41).

Read first: `../AGENTS.md`, `../REVIEW.md` section 7, `AGENTS.md`, then this file, then `TODO.md`. `GUIDELINES.md` has the working rules and the full history of decisions.

## Where things stand

- The app exists and runs. Tasks F1 to F7 and C4-0, C4-1 are merged into `develop`. `TODO.md` has the status of every task.
- Pages: home (`/`), districts with the map and the list (`/districts`), one district (`/districts/<code>`), find a district (`/find`) with the AI report card, compare (`/compare?codes=a,b`), and "page not found".
- Shared parts: skip link, header with a menu button, a menu that opens from the left, language toggle (Polish default), stale-data notice, loading and error states, footer with every source linked to its origin.
- The design is decided: the look of krakow.pl (`../docs/DESIGN.md`, `src/theme/tokens.ts`, Lato from `src/main.tsx`). The Field Journal proposal was removed.
- `npm run check` passes: both contracts in `api:check`, lint, type check, tests, build. The same command runs in CI (`../.github/workflows/ci.yml`) on every pull request.
- The header no longer scrolls sideways at 320 pixels (#45, merged in #50).

## Next steps, in order

1. **Open bugs:** #56 (two ticks a few milliseconds apart keep only the second district on Compare) and #57 (Compare at 320 pixels: the measure column fills the screen).
2. **C4-2, the feedback page**: two forms (`rent_paid`, `data_problem`). The generated types now carry the discriminator values (`rent_paid`, `data_problem`) since issue #54. Show the note from `GET /v1/feedback/status` before sending. Put the word TEST in any message you send by hand, because reports are stored. The service rejects unknown fields (422) and answers `413` above 8 KB and `429` with `Retry-After`.
3. **C4-3, the notices label**: "to be implemented after city approval". No endpoint.
4. **F8 sources, "how it works" and the draft accessibility statement.**
5. The small fixes at the end of `TODO.md`.

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
