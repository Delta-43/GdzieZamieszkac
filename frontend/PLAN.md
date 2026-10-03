# Frontend plan (F1 to F3)

Status: **approved and built** (3 and 4 October 2026). The stack below is the one in use. The pull request checks in `.github/workflows/ci.yml` run `npm run check`, so the generated types are checked there too.

## Stack

| Need | Choice | Note |
|---|---|---|
| Build | Vite, React, TypeScript | TypeScript pinned to 5.9, ESLint to 9 (see "Known pitfalls" in `README.md`) |
| API types | `openapi-typescript` from `../backend/openapi.yaml`, with `openapi-fetch` | Generated file is committed. `npm run api:check` (run by CI) fails when it differs from a fresh run. |
| Server state | TanStack Query | One hook per endpoint in `src/api/` |
| Routing | React Router | Focus moves to the main region after navigation |
| Interface text | `i18next`, hand-written `pl.json` and `en.json` | Polish default. `?lang=` sent on every API call. |
| Map | SVG drawn from `/districts.geojson` | No tiles, no third-party request |
| Tests | Vitest, Testing Library, `vitest-axe` | One accessibility check per page |
| Lint | ESLint with `eslint-plugin-jsx-a11y` | |

No web fonts from a CDN. Theme colours are set through the CSS object model, not inline styles, so a strict content security policy works.

## Screen order

1. **F1** project, scripts, generated types, lint and test setup.
2. **F2** layout: skip link, header, language toggle, footer with credit lines from `/meta`, stale and fallback notices, loading and error states.
3. **F3** theme tokens in `src/theme/` with a contrast test (4.5:1 text, 3:1 interface parts).
4. **F4 to F8** Districts, District detail, Find a district, Compare, Sources and the accessibility statement draft. Each is one small pull request.

Phase 2 (F9 to F12) starts only after phase 1 passes review.

## Folder layout

Unchanged from `README.md`: `src/api`, `src/components`, `src/pages`, `src/i18n/locales`, `src/lib`, `src/theme`, `src/test`, `public`.

## Needs before F1 can start

- The current dev API address, shared privately by `Delta-43`. It goes in `.env.local` (git-ignored) as `VITE_DEV_API`.
- A yes on this plan, or changes to it.

## Questions for the coordinator

1. Is the placeholder theme acceptable until the design requirements arrive?
2. Is the 5.9 TypeScript pin acceptable, or should we try the newest versions first?
3. Who starts F1: `Rysia`, or an agent working for `unicorn-alex`? Both own `frontend/`, so two people must not start it in parallel.
   **Answered 3 October:** `unicorn-alex` (the frontend is hers while `Rysia` is on break). Questions 1 and 2 are still open.

## Rules that every pull request keeps

One issue per pull request, reviewable in minutes. Real data only, provenance beside every value, gaps show their reason. Both languages, keyboard only, 320 pixels. No third-party request, and only the language choice stored in the browser.
