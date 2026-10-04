# frontend

React app for the Kraków hackathon edition of GdzieZamieszkać. It helps people compare Kraków's 18 districts using public data.
This is not a listings site. It shows data about districts, not offers.

## Start here

1. Read `REQUIREMENTS.md`: the screens, their states and the definition of done.
2. Get an API. See "Get an API" below.
3. Run `npm ci` and `npm run check` before you change anything.

The rules, the hand-off and the task list for people and agents working on this module are on the `develop` branch.

`unicorn-alex` reviews each pull request with `REVIEW_CHECKLIST.md`. Run that list yourself first.

## Status

State on 4 October 2026. **Phase 1 is built**, and so is the commute step of phase 2 (task F10). `npm run check` passes: both contracts, lint, type check, tests and build. CI runs the same on every pull request.

| Page | Route | What it does |
|---|---|---|
| Home | `/` | What the app is and is not, a search by district name, and the map |
| Districts | `/districts` | The map first, a picker for the measure (overall score, one category, or one measure), a list under the map, a card over the district under the pointer, and the details of the chosen district. `?district=<code>` selects one. |
| District | `/districts/<code>` | The area report with its AI label, the price history with a table and low-confidence marks, every measure by category, and commute times |
| Find a district | `/find` | Nine presets and six category weights (0 to 5) to `POST /recommend`, the ranking where place 1 is best, and the AI report card from the city service |
| Compare | `/compare?codes=a,b` | Two to four districts side by side, with real table headers |
| Feedback | `/feedback` | Two forms to the city service: rent paid and a data problem. The page says first that a report is unverified and not published. |
| Sources | `/sources` | Every source with credit line, licence and date, the three data kinds, where AI is used, and the draft accessibility statement |
| Not found | `*` | A clear message and a way back |

Shared parts: skip link, a header with the city name from `/meta`, a menu card, the language toggle (Polish default), a stale-data notice, loading and error states, and a footer with the credit line of every source as plain text.
The menu and the footer list only pages that exist (`src/lib/pages.ts`).

How the app shows data, in short:

- **Provenance.** A measure shows the API's display string. The data kind, date and source of an `observed` value open in its detail; an estimate or an indirect measure keeps its badge beside the number. The method, licence and credit line open in the same detail. A measure without data shows its reason in a dashed frame.
- **The score.** A place first ("Miejsce 3 z 18, 1 = najlepsze"), then a whole number with "pkt" and a bar. One sentence under every ranking says the score compares the districts of one city only. A driver reads "better than k of the other n − 1 districts"; the browser computes the whole number and the count (`src/lib/score.ts`) until the contract adds fields for them (`API.md`, "Contract gaps").
- **Dates** are shown in words in the page language ("30 września 2026"), inside `<time dateTime="…">` (`src/lib/dates.ts`). That is formatting, not translation.
- **Plain language.** Each measure has a "Co to znaczy?" disclosure with the catalogue's description. The data kinds read *zmierzone*, *oszacowane* and *przybliżone*.
- **The price history** is a line chart with a sentence that sums it up and a table with every value. A quarter with low confidence has a hollow marker and the word "low" in the table. The chart formats no number.
- **A category score** is asked from `POST /recommend` with that one category switched on. The answers are cached for five minutes, because that endpoint is rate limited.

## Theme

All colours, fonts and sizes are in `src/theme/tokens.ts`. Stylesheets and components use them as CSS custom properties and never write a colour.
`src/theme/theme.test.ts` checks every colour pair in use (4.5:1 for text, 3:1 for interface parts) and fails if a colour appears outside the theme folder.
To put a colour on a new background, add the pair to `CONTRAST_PAIRS` first.

The design is accepted (4 October 2026): `../docs/DESIGN.md`. It follows the look of the city's own website, krakow.pl:

- **Colours:** a white page, grey panels, one blue and dark navy text, taken from that site's stylesheet (blue `#0063af`, ink `#071f32`, grey `#f5f5f5`). Colours only: no logo, crest or photo of the city is used.
- **Font:** Lato, regular and bold, the typeface of that site. It is bundled from the `@fontsource/lato` package (SIL Open Font Licence 1.1) and served with the app, with the Latin Extended range for Polish. Nothing loads from a third party.
- **Layout of the districts page:** the map first, the picker and the list under it, and the details of the chosen district under the map. The header is a white bar with a menu button, and section headings carry a short dark bar.

**Shapes and sizes follow the Gov.pl design system** (the official guide "Przewodnik Gov UI", version 1.0 beta, read on 4 October 2026). The colours stay Kraków's (decision of the frontend developer).

| From the Gov.pl design system | In the app |
|---|---|
| Sizes 12, 14, 16, 20, 24, 28, 32 and 40 pixels; headings at 1:1.25, running text at 1:1.5 | The `text-*` and `line-*` tokens. The page heading grows from 28 to 40 pixels with the screen. |
| Button: 44 pixels high, 2 pixel border, 4 pixel corners, bold label in capitals at 16 pixels | `.button-primary`, `.button-secondary` and the retry button. The choices of a group (presets, categories, languages) keep their own case. |
| Input, select, text area: 44 pixels high, 8 by 12 pixels of padding, 16 pixel text, 4 pixel corners | `.field` controls. |
| Message: a 2 pixel frame in the colour of its kind, 4 pixel corners | `.notice`, `.error-message`, `.stale-notice`. |

Where the guide and WCAG 2.2 AA disagree, WCAG wins: the border of a field is darker than the guide's light grey (3:1, criterion 1.4.11), and links stay underlined (1.4.1).

Not taken from the guide, on purpose: the top bar "gov.pl, Serwis Rzeczypospolitej Polskiej", the eagle and the Gov.pl footer. They mark an official government site, and this app is not one. Not applied yet: the typeface (the guide uses Open Sans; the app uses Lato, the typeface of krakow.pl) and the spacing steps of 20, 28, 40, 56 and 72 pixels.

Changing the look means changing the values in `tokens.ts`.

## The map

The map is the centre of the app. It is built from two layers, with no map library and no request to a map server:

- **Districts** (`src/components/DistrictMap.tsx`): an SVG. Each district is a button, filled with its step of a colour ramp, with an exact outline, the hatch for "no data", and the focus ring. Its accessible name is "{name}: {value}, miejsce {rank} of {of}" where the API sends a rank, and "{name}: {value}, {step in words} value" where it does not. The five steps are named in words (very low to very high); class numbers are never shown. The ramp is five steps of one blue, for every measure: a darker step is a higher value, never a verdict, and the one-line legend says in words what darker means and whether more is better for that measure (a red to green ramp for scores was tried and taken back on 4 October). No names are printed on the map: a card with the name, the value and its position, and the two prices appears over the district under the pointer or the keyboard focus (Escape puts it away). When the measure changes, the new colours spread from the middle of the city to its edge in about half a second (a CSS transition with a delay per district). With reduced motion the colours change at once. An earlier version drew the colours as small squares on a canvas; it was removed on 4 October because it slowed the page down.
- **Context**: rivers, lakes, main roads, railways and a few landmarks from OpenStreetMap, thin and see-through over the districts, with the credit under the map. The file is made once by `scripts/build_basemap.py` (see `public/basemap/README.md`) and is not committed, because it is under the ODbL. Without it the map shows the districts alone.

The map has no buttons. The mouse wheel over the map zooms it at the pointer (turned "out" at the whole city it scrolls the page), a zoomed map can be dragged, and a double click zooms in. The keyboard does the same from a focused district: `+` and `−` zoom, the arrow keys move a zoomed map, `0` shows the whole city; a line under the map says so, and it is tied to the map for screen readers. A touch screen shows the whole city and has no zoom, so it needs no gesture. Reaching another part of the city never needs a drag: zoom out and zoom in at another place (WCAG 2.5.7). The card of a district appears only on the page Districts on the map (`card` prop), not on the home page. `?district=<code>` on the page Districts on the map selects a district and zooms to it. The home page has a search by district name that leads there.

## Commands

Run them from this folder. Tested with Node 26 and npm 11. CI uses Node 26.

| Command | What it does |
|---|---|
| `npm ci` | Installs the packages from the lock file. |
| `npm run dev` | Starts the dev server on port 5173, on the network. It forwards `/v1` to `VITE_DEV_API`. |
| `npm run build` | Checks the types and builds the app into `dist/`. |
| `npm run lint` | Runs ESLint with the accessibility rules. A warning fails it. |
| `npm run typecheck` | Checks the types only. |
| `npm test` | Runs the tests once, with an automated accessibility check on each rendered page. |
| `npm run api:generate` | Writes `src/api/schema.d.ts` from `../backend/openapi.yaml` and `src/api/citySchema.d.ts` from `../city-service/openapi.yaml`. Run it after every contract change and commit the result. |
| `npm run api:check` | Fails when the committed types differ from a fresh run. |
| `npm run check` | Runs `api:check`, `lint`, `typecheck`, `test` and `build`. Run it before you open a pull request. |

Copy `.env.example` to `.env.local` and put the API addresses there. Git ignores `.env.local`, so the address stays private.

| File | What it covers |
|---|---|
| `REVIEW_CHECKLIST.md` | What a reviewer checks. Run it yourself before you ask for a review. |
| `BACKEND_CONTRACT.md` | The servers, CORS, limits and the Kraków data gaps. |
| `REQUIREMENTS.md` | Screens, elements, states, phases and the definition of done. |
| `API.md` | How to use the contract, with real example responses and the known gaps. |
| `ACCESSIBILITY.md` | What WCAG 2.2 level AA means for this app, and how to test it. |

## Folder layout

```
frontend/
  public/            static files: logo, favicons, and basemap/ (the OpenStreetMap context layer, not committed)
  scripts/           build_basemap.py, which builds that layer once
  src/
    api/             generated types for both contracts, two clients and one hook per endpoint
    components/      shared pieces: provenance badge, metric row, map, legend, layout, states
    pages/           one file per screen
    i18n/locales/    pl.json and en.json (static interface text only; the same keys, a test checks)
    lib/             small helpers: dates, score, map view, classes. None formats an API text.
    theme/           the colours, fonts, sizes and durations as tokens, and the contrast test
    test/            test helpers and fixtures
```

## Stack

The stack in use. Change it in a pull request that says why.

| Need | Suggestion | Why |
|---|---|---|
| Build | Vite, React and TypeScript | Fast, and the type checker catches contract drift. |
| API types | `openapi-typescript` and `openapi-fetch` | Types come from `../backend/openapi.yaml`. |
| Server state | TanStack Query | Caching, retries and loading states. |
| Routing | React Router | Plain and well known. |
| Interface text | `i18next` and `react-i18next` | Hand-written `pl.json` and `en.json`. |
| Map | SVG drawn from `/districts.geojson`, plus an OpenStreetMap context layer | No map tiles, so no third-party requests. Each district is a keyboard-reachable button. |
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

No API is deployed. For the hackathon, the coordinator (`Delta-43`) runs the Kraków backend on their own machine and shares it **only over the team Tailscale network**. It is plain HTTP, and it is not on the public internet.
The host name is private, because this repository is public. Never write it in a file that is committed, in an issue, or in a pull request.

1. Join the team Tailscale network and keep it connected.
2. Ask the coordinator for the API host name.
3. Put it in a local file that git ignores, such as `.env.local`, as `VITE_DEV_API=http://<host>:8000`. Do not add `/v1`. The client adds it.
4. Let the dev server forward `/v1` to that address (and `/v1/ai-report` and `/v1/feedback` to the city service, `VITE_DEV_CITY`). Your browser then makes same-origin requests, and you need no CORS setup.
5. Check it: open `/v1/health` (it answers `{"status":"ok","database":"reachable"}`) and `/v1/meta` (it shows `"city": "krakow"` and `"district_count": 18`).

Use the host name. The bare Tailscale IP answers `404`, because the proxy routes by name.
If the API stops answering, check that Tailscale is connected, then that the coordinator's machine is awake, then comment on the pinned issue #4. Do not copy data into the repository as a work-around.

Run your dev server on port 5173 and listen on the network (`--host`) if the reviewer opens it from another machine. The API allows the origins `http://localhost:5173` and the developers' dev addresses, and no others. Ask in #4 to allow another origin.

Every user shares one rate limit, about 600 requests a minute, so cache (the answers carry an `ETag`, with a five-minute stale time) and avoid bursts. `BACKEND_CONTRACT.md` has the details of the server, and `API.md` the endpoints.

| Variable | Meaning |
|---|---|
| `VITE_DEV_API` | Development only. The address the dev server forwards `/v1` to. Defaults to `http://localhost:8000`. Never shipped. |
| `VITE_DEV_CITY` | Development only. The address the dev server forwards `/v1/ai-report` and `/v1/feedback` to (the city service). Defaults to `http://localhost:8100`. Never shipped. |
| `VITE_CITY_API_URL` | Build argument. Origin of the city service. Empty means the same origin as the page. |
| `DEV_ALLOWED_HOSTS` | Development only. Extra host names the dev server answers to, comma separated. Names ending in `.ts.net` are always allowed. |
| `VITE_API_URL` | Build argument. Origin of the API. Empty means the same origin as the page. The client adds the `/v1` prefix. |

Every `VITE_` variable is public. Never put a secret in one.

## Run in Docker

There is no frontend `Dockerfile` yet, and nothing is deployed. The image contract for every module is fixed: build from this folder with `VITE_API_URL` and `VITE_CITY_API_URL` as build arguments, serve the built files from a small static server on port 8080 as an unprivileged user, read nothing at run time, bake in no secret, add a health check, and leave TLS to the reverse proxy.

## Review and merge

`unicorn-alex` reviews frontend pull requests. They target `develop`. A trusted owner of `frontend/` merges them under the review rules on the `develop` branch, and only the coordinator merges `develop` into `main`.
