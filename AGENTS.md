# AGENTS.md

Operating rules for anyone, human or agent, who changes this repository. Module files (`backend/AGENTS.md`, `frontend/AGENTS.md`) add detail and never override this file.

Start with `TODO.md`. It has the priorities and the owner of each task. `docs/IDEA.md` explains the idea.

## Provenance of the work

HackYeah requires that earlier work and on-site work are clearly separated. This repository's first commit is the import of the earlier work.

1. Never rewrite history or squash the first commit.
2. Record every change to imported code in `ON_SITE_CHANGELOG.md`, with the date and the reason.
3. Never describe earlier work as done on site. Never hide a significant earlier part.
4. Disclose any significant use of AI tools, models, APIs, datasets and libraries in `README.md`.

## Data rules

- **Real data only.** The product never shows invented numbers. Test fixtures are the only fake data, and they stay in tests.
- **Provenance travels with every value:** data kind (`observed`, `estimated`, `proxy`), source, licence, credit line, as-of date, method and caveat.
- **Honest gaps.** A metric without data shows its reason, never a zero.
- **The score is computed in code.** A language model may narrate it and never computes it.
- **Safety wording.** Say "recorded crimes per 10 000 residents". Never write "safe" or "dangerous".
- **Respect the licences** in `docs/DATA_SOURCES.md`, including the credit lines.

## Security and privacy

- Never commit a secret, a token, a database URL, a personal email address or a personal data file.
- The backend is read-only and stores nothing about its users. Keep it that way.
- The frontend makes no request to a third party and stores only the language choice in the browser.

## Product rules

- The app shows one city, Kraków. Read the city name from `/meta`. Do not hard-code it in logic.
- Polish is the default language. English is a toggle. Text from the API is never translated in the browser.
- The target is WCAG 2.2 level AA.
- The API contract is `backend/openapi.yaml`. Change the contract first, in a pull request, then the code.

## Workflow

- Work on a branch named `<area>/<short-description>`. Open a pull request. Do not push to `main`.
- `unicorn-alex` reviews frontend pull requests and checks the contract, the licences and the Polish text.
- Run the backend tests before you open a pull request: `cd backend && .venv/bin/python -m pytest -q -m "not live"`.
