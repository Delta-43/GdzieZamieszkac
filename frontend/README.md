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

**Tasks F1 to F6 are done.** The project builds, lints and tests, and the API types are generated from the contract.
The shared parts exist: skip link, header with the city name from `/meta`, a menu that opens from the left under the header (the pages, then the districts),
language toggle (Polish default), stale-data notice, loading and error states, and a footer with the pages and the credit line of every source, linked to where the data comes from.
The pages are home, districts (map and list), one district, find a district, and "page not found". The menu and the footer list only pages that exist (`src/lib/pages.ts`), so they grow with each task.
The other screens are tasks F7 and F8 in `TODO.md`.

On the districts page the user chooses what colours the map: the overall score, the score of one category, or one single measure.
The map is an SVG drawn from `/districts.geojson`, with no map tiles. It splits the districts into at most five classes of equal count,
from the lowest values (class 1) to the highest (class 5). Each district is a keyboard-reachable button named with its value and prints its name, with one even outline around it. A panel beside the map has two tabs: "Lista" is a short table (the overall score, and the value on the map), and "Szczegóły" shows the chosen district:
its value, its category profile and its area report with the AI label. A measure or a district without data is hatched and shows the API's reason.

The page of one district (`/districts/<code>`) shows the area, the livability score, the area report with its AI label, the price history, and every metric by category.
Each metric shows the API's display string, the data kind, the as-of date, the source, the rank, the sample size and the caveat; the method, the licence and the credit line open in a detail.
A metric without data shows its reason in a dashed frame. The price history is a line chart with a sentence that sums it up and a table with every value; a quarter with low confidence has a hollow marker and the word "low" in the table.
The chart formats no number: its two gridlines are labelled with the API's display strings of the lowest and the highest value.

On the find page (`/find`) the user picks a preset from `/personas` or sets a weight from 0 to 5 for each of the six scored categories, and presses a button.
The ranking, the score and the top drivers come from `POST /recommend`. With no weights the page sends none, so the first ranking equals the default livability score.
The page shows the API's note and names the measures that are left out because the city has no data for them. A new ranking is announced to screen readers.

A category score is asked from `POST /recommend` with that one category switched on and the others off. The answers are cached for five minutes, because that endpoint is rate limited.

## Theme

All colours, fonts and sizes are in `src/theme/tokens.ts`. Stylesheets and components use them as CSS custom properties and never write a colour.
`src/theme/theme.test.ts` checks every colour pair in use (4.5:1 for text, 3:1 for interface parts) and fails if a colour appears outside the theme folder.
To put a colour on a new background, add the pair to `CONTRAST_PAIRS` first.

The design is accepted (4 October 2026): `../docs/DESIGN.md`. It follows the look of the city's own website, krakow.pl:

- **Colours:** a white page, grey panels, one blue and dark navy text, taken from that site's stylesheet (blue `#0063af`, ink `#071f32`, grey `#f5f5f5`). Colours only: no logo, crest or photo of the city is used.
- **Font:** Lato, regular and bold, the typeface of that site. It is bundled from the `@fontsource/lato` package (SIL Open Font Licence 1.1) and served with the app, with the Latin Extended range for Polish. Nothing loads from a third party.
- **Layout of the districts page:** a map with category buttons and a tabbed panel beside it. The header is a white bar over a blue navigation band, and section headings carry a short dark bar.

Changing the look means changing the values in `tokens.ts`.

## The map

The map is the centre of the app. It is built from three layers, with no map library and no request to a map server:

- **Pixels** (`src/components/PixelLayer.tsx`): the colour of each district as small squares on a canvas, glided to the new colours in a wave when the measure changes. It is only a picture, hidden from assistive technology. With reduced motion the colours change at once.
- **Districts** (`src/components/DistrictMap.tsx`): the SVG above the pixels. Each district is a button with its value and class in its name, with an exact outline, the hatch for "no data", and the focus ring. This is what carries the meaning.
- **Context**: rivers, lakes, main roads, railways and a few landmarks from OpenStreetMap, thin and see-through over the districts, with the credit under the map. The file is made once by `scripts/build_basemap.py` (see `public/basemap/README.md`) and is not committed, because it is under the ODbL. Without it the map shows the districts alone.

Zoom and move are buttons above the map (never over it, never a drag), so they cannot cover a focused district. `?district=<code>` on the page Districts on the map selects a district and zooms to it. The home page has a search by district name that leads there.

## Commands

Run them from this folder. Tested with Node 26 and npm 11.

| Command | What it does |
|---|---|
| `npm install` | Installs the packages. |
| `npm run dev` | Starts the dev server on port 5173, on the network. It forwards `/v1` to `VITE_DEV_API`. |
| `npm run build` | Checks the types and builds the app into `dist/`. |
| `npm run lint` | Runs ESLint with the accessibility rules. A warning fails it. |
| `npm run typecheck` | Checks the types only. |
| `npm test` | Runs the tests once, with an automated accessibility check on each rendered page. |
| `npm run api:generate` | Writes `src/api/schema.d.ts` from `../backend/openapi.yaml` and `src/api/citySchema.d.ts` from `../city-service/openapi.yaml`. Run it after every contract change and commit the result. |
| `npm run api:check` | Fails when the committed types differ from a fresh run. |
| `npm run check` | Runs `api:check`, `lint`, `typecheck`, `test` and `build`. Run it before you open a pull request. |

Copy `.env.example` to `.env.local` and put the API address there. Git ignores `.env.local`, so the address stays private.

| File | What it covers |
|---|---|
| `AGENTS.md` | The hard rules. Read it first. |
| `TODO.md` | The tasks in order, with sizes and the condition for done. |
| `REVIEW_CHECKLIST.md` | What a reviewer checks. Run it yourself before you ask for a review. |
| `HANDOFF.md` | State of the work, the design session, what is undecided, and next steps. Read it after `AGENTS.md`. |
| `design/` | A clickable mock-up of the Districts screen and the proposed Kraków blue tokens. Mock-up values are samples. |
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

No API is deployed. For the hackathon, the coordinator (`Delta-43`) runs the Kraków backend on their own machine and shares it **only over the team Tailscale network**. It is plain HTTP, and it is not on the public internet.
The host name is private, because this repository is public. Never write it in a file that is committed, in an issue, or in a pull request.

1. Join the team Tailscale network and keep it connected.
2. Ask the coordinator for the API host name.
3. Put it in a local file that git ignores, such as `.env.local`, as `VITE_DEV_API=http://<host>:8000`. Do not add `/v1`. The client adds it.
4. Let the dev server forward `/v1` to that address. Your browser then makes same-origin requests, and you need no CORS setup.
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

The image contract for every module is fixed. Build it from this folder with `VITE_API_URL` as a build argument.
Serve the built files from a small static server on port 8080 as an unprivileged user. Read nothing at run time. Bake in no secret.
Add a health check. The reverse proxy handles TLS.

## Review and merge

`unicorn-alex` reviews frontend pull requests. The coordinator or Claude merges. See `AGENTS.md`.
