# Backend server and contract

What you need to build the frontend against the running backend. Checked against the live server on 4 October 2026.
The contract is `../backend/openapi.yaml`. If this file and the contract disagree, the contract wins. How to use each endpoint is in `API.md`.

## The development server

| | |
|---|---|
| **Base URL** | `http://<dev-api-host>:8000/v1`. The host name is not written here, because this repository is public. The coordinator sends it to you privately. |
| **City** | Kraków (`CITY=krakow`). Read the name from `GET /meta`. Do not hard-code it. |
| **Access** | Tailscale only. You must be connected to the team tailnet. It is not on the public internet. |
| **Protocol** | Plain HTTP. There is no TLS on this server. |
| **Status** | A temporary development server on the coordinator's machine. It is down when that machine is off or asleep. |
| **Data** | The real audited Kraków data, 18 districts. `GET /meta` gives `data_version` and the time of the latest load. |
| **Writes** | None. The API is read-only and stores nothing about you. |

Check the connection:

```bash
curl http://<dev-api-host>:8000/v1/health
# {"status":"ok","database":"reachable"}
```

Use the host name. The bare tailnet IP answers `404`, because the tailnet proxy routes by name.

If the check fails, look at three things in order: Tailscale is connected on your machine, the coordinator's machine is awake, and the coordinator has not switched the server off.

### CORS

Each server allows only its listed origins, and nothing else. The data API allows two: `http://localhost:5173` (the Vite default) and the address of the frontend developer's dev app, so the reviewer can use that app too. Run your dev server on port 5173 and listen on the network (`vite --host`). To allow another origin, ask in the pinned issue "Dev environment".
Allowed methods are `GET`, `POST` and `OPTIONS`. No cookies or credentials are used. The browser can read `ETag`, `X-Data-Warning`, `X-Request-ID` and `Retry-After`.

Do not point the app at this host in a build. Put the base URL in one setting, so the real deployment replaces it.

### Limits

- About 600 requests a minute per client address, and 60 a minute for `POST /recommend`. Every user of the tailnet proxy shares one address, so a tight loop can lock out the team. Cache and debounce.
- A request body is at most 16 KB.

## The contract

- **Format:** OpenAPI 3.1, `../backend/openapi.yaml`. Version `1.0.0-draft`.
- **Paths** are relative to `/v1`.
- **Change rule:** the contract changes first, in a pull request, and then the code. Do not code against a field that is not in the contract.
- **Types:** generate them from the file and commit the result. See `API.md`.
- **Errors:** problem+json with `type`, `title`, `status` and `detail`. `404` is an unknown district or metric, `422` a bad parameter, `501` a feature without data.

### Endpoints

| Operation | Method and path | Notes |
|---|---|---|
| `getHealth` | `GET /health` | Not needed by the app. |
| `getMeta` | `GET /meta` | City, languages, staleness, and the credit line of every source (15 for Kraków). |
| `listDistricts` | `GET /districts` | Code, name, area, score, two highlights. |
| `getDistrictBoundaries` | `GET /districts.geojson` | Map polygons. The code is in `properties.code`. |
| `getDistrict` | `GET /districts/{code}` | All metrics by category, with rank. |
| `getDistrictReport` | `GET /districts/{code}/report` | The area report text. |
| `getSimilarDistricts` | `GET /districts/{code}/similar?limit=` | 1 to 10 results. |
| `getDistrictSeries` | `GET /districts/{code}/series/{key}` | Quarterly history. |
| `getDistrictOutlook` | `GET /districts/{code}/outlook` | Momentum and historical range. No forecast. |
| `getRentVsBuy` | `GET /districts/{code}/rent-vs-buy?area_m2=` | 15 to 250 square metres. |
| `listMetrics` | `GET /metrics` | The catalogue: 51 metrics, with availability and reasons. |
| `getMetricValues` | `GET /metrics/{key}/values` | One metric for all districts, with the numeric `value`. |
| `compareDistricts` | `GET /compare?codes=a,b,c` | Two to four districts. |
| `getCommute` | `GET /commute?from={code}` | Minutes by public transport. Estimated. |
| `listPersonas` | `GET /personas` | Nine presets: `student`, `family`, `remote_worker`, `senior`, `budget`, `city_life`, `quiet_green`, `couple`, `newly_married`. |
| `recommend` | `POST /recommend` | Body `{ "weights": {...}, "lang": "pl" }`. |

Send `lang=pl` or `lang=en` on every request. The server default is English, and the portal default is Polish.

## What the Kraków data has

District codes (use them in paths):
`bienczyce`, `biezanow-prokocim`, `bronowice`, `czyzyny`, `debniki`, `grzegorzki`, `krowodrza`, `lagiewniki-borek-falecki`, `mistrzejowice`, `nowa-huta`, `podgorze`, `podgorze-duchackie`, `pradnik-bialy`, `pradnik-czerwony`, `stare-miasto`, `swoszowice`, `wzgorza-krzeslawickie`, `zwierzyniec`.

**Metrics with no data in Kraków** (four of 51; 47 have data). They come back with `available: false` and a `reason`. Show the reason. Never show a zero.

| Key | Why it matters |
|---|---|
| `crimes_per_10k` | Recorded crime is not part of the data for this city. Safety has road-accident, lighting and emergency-service metrics. |
| `crime_detection_rate` | Same reason. |
| `population_total` | Kraków publishes registered permanent residents, not total population. Use `residents_registered` and keep its label. |
| `transit_stops_rail_metro` | The Kraków feeds have no rail. |

**Shown but not scored:** `amenity_open_sports_grounds` (now school sports grounds) and `amenity_aed_public` have Kraków data since 4 October. They are listed and ranked, and they do not enter the score.

**History:** only `sale_price_median_m2` has a series (`has_series: true` in `/metrics`). Quarters with few deeds carry `low_confidence: true`, and the newest quarter can be partial. Stare Miasto has 22 quarters, 2021Q1 to 2026Q2. Do not draw a trend through a low-confidence point without marking it.

**Commute:** minutes are estimates. Long trips run about 9 to 19 minutes optimistic. Show the `caveat` and `method` text with the figures. `minutes` is `null` when no connection was found.

**Crime wording:** where crime data exists, write "recorded crimes per 10 000 residents". Never write "safe" or "dangerous".

## The city service

A second server, next to the data API, writes the personalised AI report and stores resident feedback. Contract: `../city-service/openapi.yaml`. It is the only place the model provider is called.

| Operation | Method and path | Notes |
|---|---|---|
| health | `GET /v1/health` | Whether the data API is reachable and the model key is set. |
| AI report | `POST /v1/ai-report` | The ranking is the API's. A model narrates the top three districts from a fixed fact list. Carries the AI label. `502` when the number guard drops the text, `503` without a key. |
| feedback | `POST /v1/feedback` | `rent_paid` or `data_problem`. Stored as `unverified`, never published, never in a score. |
| feedback status | `GET /v1/feedback/status` | What happens to a report. |

Same access as the data API (tailnet only, plain HTTP, port 8100). Limits: 10 AI reports and 30 feedback reports a minute for the whole team, so send an AI report only on the button, and put TEST in anything sent by hand. The typed text goes to the model provider and is stored and logged nowhere.

## Headers and caching

- Most answers send an `ETag` and `Cache-Control: public, max-age=300`. A five-minute stale time matches.
- `X-Data-Warning` appears on four endpoints only: `/districts`, `/districts/{code}`, `/districts/{code}/report` and `/metrics/{key}/values`. Show a notice when it is present, and also when `GET /meta` says `stale.is_stale`.
- `data_version` in `/meta` changes after a data load. The server picks up new data within a minute, with no restart.

## Known contract gaps

The list is in `API.md`, under "Contract gaps". The main ones: no `display` strings for scores, area and commute minutes; no label in `highlights`; the default language is English.
Raise each gap in a pull request that changes the contract.

## Report problems

Tell the coordinator, with the request path, the status code and the `X-Request-ID` response header. The server logs that ID, and it logs no addresses or bodies.
