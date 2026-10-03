# On-site changelog

This file lists work done during HackYeah 2026 (3 and 4 October). It is the record that separates on-site work from the earlier work imported in the first commit.
Add an entry for every change, with the date and the reason. Add a line for any change to imported code, even a small one.

## Imported before the event (first commit)

Built between 29 September and 2 October 2026, in a private repository:

- `backend/`: the FastAPI app, its contract `openapi.yaml`, and 153 offline tests plus live tests.
- `server/migrations/krakow/`: the SQL that created the `krakow` schema.
- `data/sources/derived/scoring.py`: the scoring code. The backend carries a tested copy.
- `docs/API_CONTRACT_DRAFT.md`, `docs/BACKEND_PLAN.md`, `docs/DATA_DICTIONARY.md`.

Changes made while copying, and nothing else: personal data and private file references were removed from comments and documents,
the Kraków example replaced the Warsaw one in the backend README, and a person's name in two SQL comments was replaced by the word "reviewer".
No code logic changed. The 153 offline backend tests pass on the copy.

## 3 October 2026

- Created this repository with a clean history.
- `frontend/README.md`, `TODO.md` and `PLAN.md`: corrected how to reach the dev API (Tailscale, not a public tunnel), added the issue and `develop` steps, and recorded who starts F1. No imported code changed.
- Added `docs/DESIGN.md` and `docs/design/field-journal.tokens.css`: a design proposal (the Field Journal system from the team design library, adapted for contrast, no theme toggle, and self-hosted fonts), accepted by the coordinator for now. Added `docs/design/fonts/` with Literata, IBM Plex Sans and JetBrains Mono (all SIL OFL). General Sans is not included, because its licence forbids distribution through a repository. No imported code changed.
- `TODO.md`: added the way of working (`develop`, issues, `REVIEW.md`), key times to fill in, a status column, and corrected the API access and rate-limit notes to match the Tailscale setup. No imported code changed.
- `TODO.md`: the owner of the frontend tasks (P0-2 to P0-8, P1-1 to P1-4) changed from `Rysia` to `unicorn-alex`, because `Rysia` is on break. No imported code changed.
- Added `.github/` issue templates (bug, requirement, contract change) and a pull request template, to track bugs and requirements between backend, frontend and review. No imported code changed. (This line was lost in a merge and is restored here.)
- Created the `develop` branch. `REVIEW.md` and `AGENTS.md`: work starts from `develop`; agents may merge pull requests of trusted authors into `develop` in their own person's folders, after resolving conflicts, with rollback by revert pull request; only the coordinator merges `develop` into `main`. Folder lock: the coordinator owns `backend/`, `data/`, `server/`, `docs/` and the root; `unicorn-alex` and `Rysia` own `frontend/`. No imported code changed.
- Added `frontend/BACKEND_CONTRACT.md`: how to reach the development API (the host name is shared privately), CORS, limits, Kraków data gaps and a contract summary. No imported code changed.
- Added `REVIEW.md` (review procedure and agent routine) and pointers to it in the three `AGENTS.md` files, so reviewers and agents follow one process. No imported code changed. The pointers add lines to `backend/AGENTS.md`, which is imported.
- Wrote the frontend guide files: `frontend/AGENTS.md`, `README.md`, `REQUIREMENTS.md`, `API.md`, `ACCESSIBILITY.md`, plus empty folders for the app.
- Wrote this changelog, the root `README.md` and `AGENTS.md`, and `docs/DATA_SOURCES.md`.
- Added the proprietary `LICENSE`, `CODEOWNERS`, and enabled protection on `main`.
- Removed the pointers in `frontend/` to two note files that are not part of this repository.
- Added `presentation.html`, the pitch deck for HackYeah (Kraków only), adapted from the team briefing deck of the earlier stage. Reason: the submission needs a presentation that matches the final idea.
- Rewrote `presentation.html` along evidence-based slide design rules: one idea per slide, at most four short items, diagrams instead of text, items that build in and dim once discussed, no decorative images, alt text on every diagram, and the narration in the speaker notes and the printed handout. Reason: the earlier version was text-heavy.
- Changed the headline font of `presentation.html` from Chewy to Reddit Sans Condensed. Reason: team request.
- Added `presentation.html`, the HackYeah pitch deck for the Kraków edition. It is based on the team briefing deck from before the event, rewritten for the final idea: Kraków only, the offer to the city, what was built when, and the disclosure of AI use. It changes no imported code.
- Added `TODO.md` with the MVP priorities, `docs/IDEA.md`, `docs/README.md` and `docs/data-review/`.
- Added `frontend/TODO.md` and `frontend/REVIEW_CHECKLIST.md`, and updated the frontend README, AGENTS and REQUIREMENTS with the start steps, the API access plan and the priority order.
- Added the next steps for the MVP to `backend/README.md`. No backend code changed.
- 2026-10-03: added `frontend/PLAN.md`, a proposed stack, screen order and open questions for tasks F1 to F3, for the coordinator to approve before code starts. No imported code changed.
- 2026-10-03: added `frontend/HANDOFF.md` and `frontend/design/` (a clickable mock-up of the Districts screen with sample values, its screenshot, and proposed Kraków blue colour tokens), and listed them in `frontend/README.md`. Reason: hand the frontend to `Rysia` with the design session recorded. The palette conflicts with the accepted `docs/DESIGN.md` until `Delta-43` decides. No imported code changed.
- 2026-10-03: added `docs/CITY_SERVICE_PLAN.md`, a proposal for official notices, the personalised AI report and resident feedback as real features in a separate `city-service/`. Nothing is built. No imported code changed.
