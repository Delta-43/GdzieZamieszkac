# Working guidelines: frontend

This file says how the frontend work is done during HackYeah 2026 (3 and 4 October), and keeps a short history of it.
The hard product rules are in `AGENTS.md`. If this file and `AGENTS.md` (here or in the root) disagree, `AGENTS.md` wins.

## Who and what for

- The frontend developer is Aryna (GitHub: `Rysia`). She works with Claude Code (Anthropic) as an AI assistant.
- `unicorn-alex` reviews frontend pull requests. The coordinator or Claude merges after validation.
- We submit to two tracks: Smart City and Artificial Intelligence.

The jury's weights decide what we build first when time is short.

| Criterion | Weight | What it means for the frontend |
|---|---|---|
| Idea | 30% | The first screen says what the portal is: public district data with its source, not a listings site. |
| Relation to category | 20% | Smart City: open city data, shown honestly. AI: the labelled area report and the explained recommendation. |
| Usability | 20% | The main flow works on a phone, with the keyboard and with a screen reader. |
| Design | 20% | One clean theme kept as tokens, so it can change without touching components. |
| Completeness | 10% | A few finished screens are worth more than many half-built ones. |

## Working rules

1. **One outcome per prompt.** Each request to the assistant has one result. That keeps each change small enough to review and to explain.
2. **Plan first, then wait.** Before any implementation, the assistant writes a precise plan. Work starts only after Aryna approves it.
3. **Ask before a big change.** A big change is described first, with its reason, and needs a yes. Examples: a new dependency, a change of folder layout,
   a change of stack, deleting or rewriting a file someone else wrote.
4. **Work only in `frontend/`.** Do not touch `backend/`, `server/`, `data/` or `docs/`.
   The one exception outside this folder is the entry in the root `ON_SITE_CHANGELOG.md` (rule 7).
   If the frontend needs something from the API, raise it with the coordinator as a contract change. Do not edit `backend/openapi.yaml`.
5. **Never change database tables directly.** The frontend has no database access at all. It reads the API and nothing else.
6. **Work on a branch, never on `main`.** Name it `frontend/<short-description>`. If git refuses because a branch named `frontend` exists, use `ui/<short-description>`.
7. **Commit after each big step.** Run `git add` and `git commit` with a full message that says what changed and why.
   Add an entry to `ON_SITE_CHANGELOG.md` in the same commit, with the date and the reason.
8. **Aryna pushes and opens the pull request.** The assistant does not push and does not open pull requests.
9. **Explain every technical decision in plain words.** Aryna must be able to defend each one to the jury.
   A decision that cannot be explained simply is not ready to be made.

## Commit messages

- First line: what changed, in the imperative, in about 70 characters.
- Body: why it changed, what was decided, and what was left out on purpose.
- Say how it was checked (tests, keyboard pass, both languages), or say plainly that it was not checked.
- Commits made with the assistant carry its co-author line. The root `README.md` discloses the use of AI tools.

## Honesty about the work

- `ON_SITE_CHANGELOG.md` separates work done before the event from work done on site. Never describe earlier work as done on site.
- All app code in `frontend/` is written on site. The guide files in this folder were written by the coordinator on 3 October 2026.
- The history below records what was done and what was decided. Add to it, never rewrite it.

## Before a pull request

Use the checklist "Before you finish a task" in `AGENTS.md` and the definition of done in `REQUIREMENTS.md`. In short:

- Types come from the current `openapi.yaml`.
- Both languages render, and the page language attribute follows the toggle.
- Every value shows its provenance. A missing metric shows its reason.
- It works with the keyboard only, at 320 pixels wide and at 200 percent zoom.
- Automated accessibility checks pass.
- No request goes to a third party.
- The pull request is small.

## History

Newest entry last. Each entry has the date, the branch, what was done and any decision with its reason.

### 3 October 2026

- **Starting point.** The folder held the coordinator's guide files (`AGENTS.md`, `README.md`, `REQUIREMENTS.md`, `API.md`, `ACCESSIBILITY.md`) and empty folders. There was no app code and no `package.json`.
- **`frontend/guidelines`.** Wrote this file with the working rules and this history section. No app code was written.
