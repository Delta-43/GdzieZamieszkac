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
- Wrote the frontend guide files: `frontend/AGENTS.md`, `README.md`, `REQUIREMENTS.md`, `API.md`, `ACCESSIBILITY.md`, plus empty folders for the app.
- Wrote this changelog, the root `README.md` and `AGENTS.md`, and `docs/DATA_SOURCES.md`.
- Added the proprietary `LICENSE`, `CODEOWNERS`, and enabled protection on `main`.
- Removed the pointers in `frontend/` to two note files that are not part of this repository.
- Added `presentation.html`, the HackYeah pitch deck for the Kraków edition. It is based on the team briefing deck from before the event, rewritten for the final idea: Kraków only, the offer to the city, what was built when, and the disclosure of AI use. It changes no imported code.
