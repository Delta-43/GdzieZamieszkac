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
- Added `REVIEW.md` (review procedure and agent routine) and pointers to it in the three `AGENTS.md` files, so reviewers and agents follow one process. No imported code changed. The pointers add lines to `backend/AGENTS.md`, which is imported.
- Wrote the frontend guide files: `frontend/AGENTS.md`, `README.md`, `REQUIREMENTS.md`, `API.md`, `ACCESSIBILITY.md`, plus empty folders for the app.
- Wrote this changelog, the root `README.md` and `AGENTS.md`, and `docs/DATA_SOURCES.md`.
- Added the proprietary `LICENSE`, `CODEOWNERS`, and enabled protection on `main`.
- Removed the pointers in `frontend/` to two note files that are not part of this repository.
- Added `TODO.md` with the MVP priorities, `docs/IDEA.md`, `docs/README.md` and `docs/data-review/`.
- Added `frontend/TODO.md` and `frontend/REVIEW_CHECKLIST.md`, and updated the frontend README, AGENTS and REQUIREMENTS with the start steps, the API access plan and the priority order.
- Added the next steps for the MVP to `backend/README.md`. No backend code changed.
