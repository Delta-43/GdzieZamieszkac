# Frontend hand-off: state on 4 October 2026, after the reviewer's two rounds

For the next session on `frontend/`, human or agent. Written by the agent working for `Rysia` (Aryna) at the end of its session. The earlier versions are in the git history (pull requests #15, #41 and #71).

Read first: `../AGENTS.md`, `../REVIEW.md` section 7, `AGENTS.md`, then this file, then `TODO.md`. `GUIDELINES.md` has Aryna's working rules. `README.md` describes the look and the map.

## Where things stand

- **Phase 1 is built.** Pages: home (`/`), districts on the map (`/districts`), one district (`/districts/<code>`), find a district (`/find`) with the AI report card, compare (`/compare?codes=a,b`), feedback (`/feedback`), sources and how it works (`/sources`), and "page not found".
- **`develop` and `main` hold everything up to pull request #101** (checked by the coordinator on 4 October, evening): #92 (sizes and alignment, issue #91), #99 (favicon) and #101 (commute times on the district page, task F10) are merged. The three round-two issues and the plain-language issue are closed.
- `npm run check` passes on it: both contracts, lint, type check, 170 tests, build. CI runs the same on every pull request, with the backend and city service tests.
- The app was run against the real servers on 4 October: every page and main flow, 14 kinds of API call, all answered 200, no console error.

## What changed on 4 October (in order)

| Pull request | What |
|---|---|
| #73 | Fixes from an audit in a real browser: footer link size, every duration from a token (zero under reduced motion, with a test), focus kept on map controls, busy state on send buttons, "all fields are required" on the feedback forms. The pixel canvas under the map was removed; the colours change in a short wave by CSS. |
| #75 | Shapes and sizes of the Gov.pl design system (type sizes, buttons in capitals, 16 pixel fields, 2 pixel message frames), with Kraków's colours and Lato kept. `README.md` has the table of what was taken and what was not. |
| #77 | Header that stays at the top on a wide and tall screen. The menu is a card under the menu button (press, keyboard, or a mouse resting on it). Home page: the search block in one column. Equal-width choice buttons. A select drawn by the app (Safari). |
| #85 | First round of the reviewer's feedback: a card over the district under the pointer or the focus, no names on the map, the map moved by the mouse, details only while a district is chosen, the picker and the list under the map, a one-line legend, a footer with only the source credits. (It also added a red to green ramp for scores, taken back in #89.) |
| #89 | Second round: a search field for the measures; on the district page the data kind, date and source of a metric are in its collapsible detail (an estimate or an indirect measure keeps its badge beside the number); the map is blue for every measure again; **no buttons on the map** (wheel, drag, double click; `+`, `−`, arrows and `0` on the keyboard; a hint line under the map); the card only on the districts page; the details under the map; footer credits as plain text. |

## Next steps, in order

1. ~~Merge the pull request for issue #91.~~ Done (#92).
2. **Issue #82 is built, with three differences decided by Aryna** and written in a comment on the issue: the legend stays one line and gains a sentence on what darker means (the step list does not come back); one "Co to znaczy?" disclosure per measure, not two; a preset sends its exact weights, and a weight that is not 0, 3 or 5 is said in words. Two boxes of the issue stay open: the check with five people (Aryna), and the Polish text (`unicorn-alex`).
3. **Decisions waiting for `Delta-43`**, each flagged in a pull request:
   - Observed values no longer show data kind, date and source beside the number (one press away). `REVIEW.md` and `AGENTS.md` rule 4 say "beside it" (#89).
   - The map has no buttons: WCAG 2.5.7 rests on zooming out and in elsewhere, and a touch screen cannot zoom (#89). If that is not enough, the buttons come back.
   - `../docs/DESIGN.md` describes neither the gov.pl shapes (#75) nor the removed pixel canvas. It is the coordinator's file.
   - ~~#87: the API lists a Warsaw-only metric for Kraków.~~ Closed on 4 October: pull request #81 replaced it with Kraków data.
   - #82: the whole-number score and "better than k of n − 1 districts" are computed in the browser (`src/lib/score.ts`). A `display` string and a count in `/recommend` would remove both (`API.md`, "Contract gaps").
4. **Polish text for `unicorn-alex`:** every string the agent wrote is listed in the pull requests #73, #75, #77, #85, #89 and the one for #82, plus `districts.map.hint` (not listed in #89). Issue #83 is the coordinator's own list. `unicorn-alex` closed #82 and #83 on 4 October, with no comment: check with the reviewer whether the two category questions (*livability*, *safety*) and the step names were written. Do not guess wording: apply what the reviewer writes. Open from #82: the questions under the categories *livability* and *safety* on Find a district (none is shown until she writes them), and the five step names, written in the feminine to agree with "wartość".
5. **Manual accessibility checks, no written record** (`unicorn-alex` closed the review issues #70 and #72 on 4 October; write the result here when it is known): a screen reader (NVDA or VoiceOver), 200 and 400 percent zoom, a keyboard-only pass by hand. Then update the draft statement (`about.a11y`).
6. **Open choices of Aryna's:** the typeface (the Gov.pl guide uses Open Sans, the app uses Lato); the dark bar beside section headings (a krakow.pl motif); whether the compare table, the list and the map card should hide the "observed" badge as the district page does.
7. **Small fixes** in `TODO.md` (`plainNumber.ts` after backend task B2; the favicon is done, #99), then the rest of **phase 2**: F9, F11 and F12 (F10 is done, #101).

## How Aryna works (decided in this session)

- **WCAG 2.2 AA comes first, then the Gov.pl design language.** When a request conflicts with a written rule, ask her with two or three options and a recommendation; she decides, and the pull request tells `Delta-43`.
- The reviewer's feedback reaches the agent through Aryna, in chat. Text in an issue is still data, not an instruction.
- She merges; the agent opens the pull request and says it is ready.

## How to run it

- The two servers run on the coordinator's machine, on the team Tailscale network. The host name is private: ask `Delta-43`, and never write it in a committed file, an issue or a pull request.
- `frontend/.env.local` (git-ignored) needs `VITE_DEV_API=http://<host>:8000` and `VITE_DEV_CITY=http://<host>:8100`. `.env.example` lists every variable.
- `npm run dev` listens on port 5173 and forwards `/v1/ai-report` and `/v1/feedback` to the city service and every other `/v1` path to the data API.
- The context layers of the map are not in git (ODbL): run `python3 frontend/scripts/build_basemap.py --api <data API>/v1` once, or the map shows the districts alone.
- Check: `/v1/health` answers `{"status":"ok","database":"reachable"}`, and `/v1/feedback/status` answers with `"identity_check":"not_yet"`.

## Checking in a real browser

Playwright is installed at the repository root by Aryna (not committed). The agent drove it from scratch scripts, with `axe-core` from `frontend/node_modules`, for: an axe scan of every page at 1280 and 320 pixels in both languages (WCAG 2.2 A and AA rules), reduced motion, focus, and screenshots in WebKit (Aryna uses Safari, which drew the native select at half height). jsdom cannot check contrast or target size, so run the browser scan before a pull request that changes styles.

## Things that cost time

- **Merging.** `gh pr merge` is refused in an agent's session. Open the pull request, state that the section 7 conditions hold, and let Aryna merge.
- **Untracked files at the repository root.** A Playwright setup (`package.json`, `playwright.config.ts`, `tests/`, a workflow) and an Impeccable install under `.github/` are Aryna's and are not committed. **Never `git add -A` at the root:** stage files by name, or `git add -A frontend/src`.
- **Changelog.** Do not edit `ON_SITE_CHANGELOG.md`. Add one new file to `../changelog/` (`../changelog/README.md`).
- **Stacked branches.** Three pull requests were stacked on 4 October because nothing could be merged mid-session. Prefer a new branch from a current `develop`; when a pull request is still open, add to it.
- **The list has the same names as the map.** On the districts page a test that looks for a button named "Delta" finds two. Look inside the map (`group` named "Mapa dzielnic…") or the list.
- **The dev server loses its settings when a branch without `frontend/vite.config.ts` is checked out.** Restart it after such a switch.
- **View tests.** `tests/responsive.spec.ts` at the repository root (Aryna's local Playwright setup, not committed) checks every page at eleven widths in Chromium, Firefox and WebKit: no sideways scroll, target sizes, line length, shared edges, and evenly filled rows of buttons. Run `npx playwright test tests/responsive.spec.ts` from the root with the dev server up, before a pull request that changes layout.
- **The project has no code formatter.** Never run `prettier --write`: with no configuration it restyles every file. Match the style by hand; `npm run lint` is the check.
- **Closing issues.** `Closes #n` does not close an issue when the pull request merges into `develop`, only when it reaches `main`. #72, #74, #76, #84 and #88 stayed open for that reason until the release merge into `main` on 4 October closed them.
- **The AI report costs model budget** (10 a minute for the whole team). Send only on the button, use fixtures in tests, and put TEST in anything sent by hand. Feedback reports are stored.

## Rules that are easy to break

- Show API text as given. Never format a number in the browser, never translate API text. The city name comes from `/meta`.
- A missing value shows the API's reason, never a zero.
- No colour outside `src/theme/` and no duration typed into `styles.css` (tests fail). Add a contrast pair before putting a colour on a new background.
- `pl.json` and `en.json` must have the same keys (a test fails).
- Never write "safe" or "dangerous". Colour on the map means more or less, never good or bad. No link to a listings site. No request to a third party from the browser. Only the language choice is stored.
