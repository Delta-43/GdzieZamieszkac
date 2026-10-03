# Frontend hand-off: state on 3 October 2026, late evening

For the next session on `frontend/`, human or agent. Written at the end of the first building day by the agent working for `Rysia` (Aryna).
It replaces the design-session hand-off that `unicorn-alex` wrote earlier the same day (that text is in the git history, pull request #15).

Read first: `../AGENTS.md`, `../REVIEW.md` section 7, `AGENTS.md`, then this file, then `TODO.md`. `GUIDELINES.md` has Aryna's working rules and the full history of decisions.

## Where things stand

- The app exists and runs. Tasks F1 to F6 are merged into `develop`. `TODO.md` has the status of every task.
- Pages: home (`/`), districts with the map and the list (`/districts`), one district (`/districts/<code>`), find a district (`/find`), and "page not found".
- Shared parts: skip link, header with a menu button, a menu that opens from the left, language toggle (Polish default), stale-data notice, loading and error states, footer with every source linked to its origin.
- `npm run check` passes: both contracts in `api:check`, lint, type check, 91 tests, build (about 127 KB of JavaScript compressed).
- The branch `frontend/c4-city-service` holds the groundwork for the city service (types, client, dev proxy), the updated `TODO.md` and this file.

## Next steps, in order

1. **C4-1, the AI report card** on the find page. Decided by Aryna: build it first.
   - Call `POST /v1/ai-report` of the city service with `requirements`, `lang`, and the weights on the sliders (or nothing for the default ranking). Use `src/api/cityClient.ts`.
   - Before the first request, say that the typed text goes to a model provider and is not stored (`../docs/CITY_SERVICE_PLAN.md`, section 2).
   - Show the API's `label` as given: it is the AI label. Show `report` as plain text in paragraphs, never as HTML. Show the three `districts` and `basis.note`.
   - `facts`: the service sends them in English even for Polish (issue #38). The coordinator is fixing this in the backend. Until it is fixed, show the facts list only in the English view.
   - A report takes 3 to 6 seconds: show a loading state. `502` and `503` get a message and the page keeps working. `429` carries `Retry-After`.
   - The endpoint allows 10 reports a minute for the whole team, and each one costs the coordinator's model budget. Send only on the button. Use fixtures in tests.
2. **C4-2, the feedback page**: two forms (`rent_paid`, `data_problem`). Show the note from `GET /v1/feedback/status` before sending. Put the word TEST in any message you send by hand, because reports are stored.
3. **C4-3, the notices label**: "to be implemented after city approval". No endpoint.
4. **F7 compare**, then **F8 sources, "how it works" and the draft accessibility statement**.
5. The small fixes at the end of `TODO.md`.

## Decisions that are still open (not ours to make)

- **The look.** The app follows krakow.pl: Lato, a white page, blue `#0063af`. The coordinator's accepted design is `../docs/DESIGN.md` (Field Journal). `Delta-43` has not said which stays. Changing it means `src/theme/tokens.ts` and the font import in `src/main.tsx`.
- **Two rules bent on the developer's decision**, both flagged to `Delta-43` in pull request #35: the map outline is one hairline and does not reach 3:1 on the two darkest classes; the districts list shows only the overall score, not area and the two prices.
- **`../TODO.md`** still lists `unicorn-alex` as the owner of the frontend tasks and marks them open. It is the coordinator's file.

## Open issues to know

| Issue | What | Whose |
|---|---|---|
| #36 | Feedback accepts an unknown extra field | `Delta-43` |
| #37 | The Content-Security-Policy header arrives rewritten by an ad filter on the server machine | `Delta-43` |
| #38 | AI report facts are in English for `lang=pl` | `Delta-43`, in progress |
| #39 | The Polish AI report writes decimals with a point | `Delta-43` |
| #21, #23, #25, #27, #29, #34 | Our tasks. Their pull requests are merged into `develop`; GitHub closes the issues when `develop` reaches `main`. | Closed by the merge |

Contract gaps we work around (raise as `contract` issues if they still matter): `/metrics` sends no category label; `/recommend` sends no data kind and no display string for a score; scores, areas and percentiles have no display string (`src/lib/plainNumber.ts`); source names in `/meta` arrive in English for `lang=pl`.

## How to run it

- The two servers run on the coordinator's machine, on the team Tailscale network. The host name is private. Ask `Delta-43` or `Rysia` for it and never write it in a committed file, an issue or a pull request.
- `frontend/.env.local` (git-ignored) needs `VITE_DEV_API=http://<host>:8000` and `VITE_DEV_CITY=http://<host>:8100`. `.env.example` lists every variable.
- `npm run dev` listens on the network on port 5173 and forwards `/v1/ai-report` and `/v1/feedback` to the city service and every other `/v1` path to the data API.
- Check: `/v1/health` answers `{"status":"ok","database":"reachable"}`, and `/v1/feedback/status` answers with `"identity_check":"not_yet"`.

## Things that cost time today

- **The dev server loses its settings when a branch without `frontend/vite.config.ts` is checked out** (an old `main` or `develop`). It keeps running without the proxy, and every API call then returns the page itself. Restart it after such a switch. Update a local branch with `git fetch origin develop:develop` to avoid the checkout.
- **Merging.** In the agent's session `gh pr merge` was refused by the tool's permission check. Open the pull request, state that the section 7 conditions hold, and let the person merge with `gh pr merge <n> --merge`.
- **Stacked branches.** Several tasks were built on top of each other before the first was merged. Start each new task from a current `develop`.
- **Screenshots.** Headless Chrome will not render narrower than about 500 pixels, so 320 pixels was never checked. Check it by hand.
- **React runs effects twice in development.** An effect that acts "after navigation" must compare the address with the last one (see `components/Layout.tsx`).

## Rules that are easy to break

- Show API text as given. Never format a number in the browser, never translate API text.
- Every value needs its data kind, source and date beside it or one click away. A missing value shows the API's reason, never a zero.
- No colour outside `src/theme/` (a test fails). Add a contrast pair before putting a colour on a new background.
- `pl.json` and `en.json` must have the same keys (a test fails). `unicorn-alex` reviews the Polish.
- Never write "safe" or "dangerous". No link to a listings site. No request to a third party from the browser.
- Only the language choice is stored in the browser.
