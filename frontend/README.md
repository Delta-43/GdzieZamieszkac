# frontend

React app for the Kraków hackathon edition of GdzieZamieszkać. It helps people compare Kraków's 18 districts using public data.
This is not a listings site. It shows data about districts, not offers.

## Start here

1. Read `AGENTS.md`. It is short.
2. Open `TODO.md`. It lists the tasks in order, with sizes and the condition for done.
3. Write a short plan and share it with the coordinator.
4. Get an API. See "Get an API" below.
5. Do task F1. Then work down the list, one small pull request at a time.

`unicorn-alex` reviews each pull request with `REVIEW_CHECKLIST.md`. Run that list yourself first.

## Status

**Not started.** This folder holds guide files and empty folders. There is no `package.json` yet.
You create the project yourself. The guide files tell you what to build and what to avoid.

| File | What it covers |
|---|---|
| `AGENTS.md` | The hard rules. Read it first. |
| `TODO.md` | The tasks in order, with sizes and the condition for done. |
| `REVIEW_CHECKLIST.md` | What a reviewer checks. Run it yourself before you ask for a review. |
| `REQUIREMENTS.md` | Screens, elements, states, phases and the definition of done. |
| `API.md` | How to use the contract, with real example responses and the known gaps. |
| `ACCESSIBILITY.md` | What WCAG 2.2 level AA means for this app, and how to test it. |

## Folder layout

The empty folders mark where things go. Keep this layout, or change it in a pull request that explains why.

```
frontend/
  public/            static files that need no processing
  src/
    api/             generated types, the API client and one hook per endpoint
    components/      shared pieces: provenance badge, metric row, layout, states
    pages/           one file per screen
    i18n/locales/    pl.json and en.json (static interface text only)
    lib/             small helpers, none of which format API numbers
    theme/           the Kraków colours and favicon as tokens
    test/            test helpers and fixtures
```

## Suggested stack

You can choose another stack. Pick it in your first pull request and say why.

| Need | Suggestion | Why |
|---|---|---|
| Build | Vite, React and TypeScript | Fast, and the type checker catches contract drift. |
| API types | `openapi-typescript` and `openapi-fetch` | Types come from `../backend/openapi.yaml`. |
| Server state | TanStack Query | Caching, retries and loading states. |
| Routing | React Router | Plain and well known. |
| Interface text | `i18next` and `react-i18next` | Hand-written `pl.json` and `en.json`. |
| Map | SVG drawn from `/districts.geojson` | No map tiles, so no third-party requests. The SVG can be keyboard accessible. |
| Tests | Vitest, Testing Library and `vitest-axe` | Component tests with accessibility checks. |
| Lint | ESLint with `eslint-plugin-jsx-a11y` | Catches many accessibility mistakes while you type. |

## Known pitfalls

These came up in a trial run on 2026-10-03. They save you an afternoon.

- **Package versions.** `openapi-typescript` 7 needs TypeScript 5. `typescript-eslint` needs TypeScript below 6.1.
  `eslint-plugin-jsx-a11y` supports ESLint up to version 9. Pin TypeScript to 5.9 and ESLint to 9 if `npm install` reports a conflict.
- **Test setup.** `openapi-fetch` captures the global `fetch` when you create the client. Install your fetch mock before the client module loads.
  The jsdom test environment cannot build a request from a relative URL. Give the client an absolute origin in tests.
- **Staleness header.** Only four endpoints send `X-Data-Warning`. A response from any other endpoint says nothing about staleness.
  Do not clear the warning when such a response arrives. Details are in `API.md`.
- **District list labels.** `/districts` returns the highlight values with a metric key only. Get the labels from `/metrics`.
- **Content security.** The theme colours must be set through the CSS object model, not inline `style` attributes.
  A strict content security policy blocks inline styles.
- **Fonts and tiles.** Self-host any font. Do not load fonts or map tiles from a third party.

## Get an API

No API is deployed. For the hackathon, the coordinator (`Delta-43`) runs the Kraków backend on their own machine and shares a temporary public address through a tunnel.
The address changes each time the tunnel restarts, so ask for the current one.

1. Ask the coordinator for the API address. It looks like `https://something.example`.
2. Put it in a local file that git ignores, such as `.env.local`, as `VITE_DEV_API=https://something.example`.
3. Let the dev server forward `/v1` to that address. Your browser then makes same-origin requests, and you need no CORS setup.
4. Check it: open `/v1/meta` in the browser. You should see `"city": "krakow"` and `"district_count": 18`.

If the address stops working, the tunnel is down. Ask the coordinator to restart it. Do not copy data into the repository as a work-around.

The coordinator starts the API like this. The tunnel shows all clients as one address, so set `TRUSTED_PROXY_HOPS=1` to keep the rate limits fair.

```bash
cd backend
API_DB_URL=... CITY=krakow TRUSTED_PROXY_HOPS=1 .venv/bin/uvicorn app.main:app_from_env --factory --port 8000
cloudflared tunnel --url http://localhost:8000      # or another tunnel tool
```

| Variable | Meaning |
|---|---|
| `VITE_DEV_API` | Development only. The address the dev server forwards `/v1` to. Defaults to `http://localhost:8000`. Never shipped. |
| `VITE_API_URL` | Build argument. Origin of the API. Empty means the same origin as the page. The client adds the `/v1` prefix. |

Every `VITE_` variable is public. Never put a secret in one.

## Run in Docker

The image contract for every module is fixed. Build it from this folder with `VITE_API_URL` as a build argument.
Serve the built files from a small static server on port 8080 as an unprivileged user. Read nothing at run time. Bake in no secret.
Add a health check. The reverse proxy handles TLS.

## Review and merge

`unicorn-alex` reviews frontend pull requests. The coordinator or Claude merges. See `AGENTS.md`.
