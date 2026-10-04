# API guide for the frontend

The contract is `../backend/openapi.yaml`. This file explains how to use it and lists what the contract does not give you yet.
If this file and the contract disagree, the contract wins. Open a pull request to fix this file.

## Basics

- **Base path:** `/v1`. The paths in the contract are relative to it. The host is one deployment for one city.
- **Read-only, no login, no personal data.** The only calculation at request time is `POST /recommend` and the small `rent-vs-buy` sum.
- **Language:** add `lang=pl` or `lang=en` to every request. Without it the API uses `Accept-Language`, then English.
  `/meta` reports `default_lang: "en"`. The portal's default is Polish, so always send `lang` explicitly.
- **Stored text:** labels, notes, reasons and reports arrive in both languages. Never translate them in the browser.
- **Caching:** most answers send an `ETag` and `Cache-Control: public, max-age=300`. A query library with a five-minute stale time matches that.
- **Errors:** problem+json (`type`, `title`, `status`, `detail`). `404` means an unknown district or metric. `422` means a bad parameter. `501` means the feature has no data yet.
- **Rate limits:** about 600 requests a minute per client address in general, and 60 for `POST /recommend`.

## Endpoints

| Operation | Method and path | Use it for |
|---|---|---|
| `getHealth` | `GET /health` | Not needed by the app. |
| `getMeta` | `GET /meta` | City name, languages, staleness and the credit line of every source. |
| `listDistricts` | `GET /districts` | The list and table: code, name, area, score and two highlights. |
| `getDistrictBoundaries` | `GET /districts.geojson` | The map polygons. The district code is in `properties.code`. |
| `getDistrict` | `GET /districts/{code}` | The detail page: all metrics grouped by category, with rank. |
| `getDistrictReport` | `GET /districts/{code}/report` | The area report text. |
| `getSimilarDistricts` | `GET /districts/{code}/similar?limit=` | Similar districts, from 1 to 10. |
| `getDistrictSeries` | `GET /districts/{code}/series/{key}` | Quarterly history. Only `sale_price_median_m2` has history. |
| `getDistrictOutlook` | `GET /districts/{code}/outlook` | Momentum, the city's historical range and the backtest. No forecast. |
| `getRentVsBuy` | `GET /districts/{code}/rent-vs-buy?area_m2=` | Yield and payback for a flat from 15 to 250 square metres. |
| `listMetrics` | `GET /metrics` | The catalogue: labels, units, direction, availability and reasons. |
| `getMetricValues` | `GET /metrics/{key}/values` | One metric for all districts, with the numeric `value`. Use it for the map and for filters. |
| `compareDistricts` | `GET /compare?codes=a,b,c` | Two to four districts side by side. |
| `getCommute` | `GET /commute?from={code}` | Minutes by public transport from one district to the others. |
| `listPersonas` | `GET /personas` | Weight presets: `student`, `family`, `remote_worker`, `senior`, `budget`. |
| `recommend` | `POST /recommend` | Ranks the districts for the weights. Body: `{ "weights": {...}, "lang": "pl" }`. |

## Generate the types

Generate the types from the contract and commit the result. Add a check that fails when the committed file differs from a fresh run.
That way the client cannot drift from the contract.

## Example responses

These are real answers from the Warsaw deployment on 3 October 2026. Kraków answers have the same shape. Text is shortened.

District list item (`GET /districts?lang=pl`):

```json
{
  "code": "bemowo",
  "name": "Bemowo",
  "area_km2": 24.933,
  "livability_score": 51.4,
  "highlights": [
    { "key": "sale_price_median_m2", "display": "14 500 PLN/m²", "data_kind": "observed" },
    { "key": "rent_price_median_m2", "display": "73,9 PLN/m²", "data_kind": "observed" }
  ]
}
```

A metric with data (inside `categories[].metrics[]` of `GET /districts/{code}`):

```json
{
  "key": "transit_stops_total",
  "available": true,
  "label": "Przystanki komunikacji miejskiej",
  "display": "111",
  "value": 111.0,
  "unit": "stops",
  "data_kind": "observed",
  "n_obs": null,
  "as_of": "2026-09-30",
  "source": { "name": "Public transport GTFS feeds", "licence": "…", "attribution": "ZTM Warszawa (GTFS), mirror by mkuran.pl", "url": "…" },
  "method": "Unikalne nazwy przystanków …",
  "caveat": null,
  "rank": { "position": 1, "of": 18, "direction": "higher is better" }
}
```

A metric without data:

```json
{
  "key": "residents_registered",
  "available": false,
  "label": "Zameldowani na pobyt stały",
  "reason": "Źródło dla Warszawy (Panorama dzielnic) nie zawiera liczby zameldowanych mieszkańców; …"
}
```

A point of the price series (`GET /districts/{code}/series/sale_price_median_m2`):

```json
{ "period_start": "2022-10-01", "period_end": "2022-12-31", "value": 16233.0, "display": "16 233 PLN/m²", "n_obs": 96, "low_confidence": false }
```

A commute answer (`GET /commute?from=srodmiescie`): `{ "from": "srodmiescie", "destinations": [{ "code": "bemowo", "minutes": 32.2 }, …], "caveat": "…" }`.
`minutes` is `null` when no connection was found.

A recommend answer (`POST /recommend`): `ranking[]` with `rank`, `code`, `name`, `score` and `top_drivers[]` (`key`, `label`, `percentile`), plus `metrics_used`, `missing_metrics` and `note`.

## Rules the API follows

- **Provenance travels with every value:** `data_kind`, `source` (name, licence, credit line), `as_of`, `method` and `caveat`.
- **Honest gaps:** a metric without data has `available: false` and a `reason`. Check `available` before you read `display`.
- **Ranks** run from 1 (best) after the direction is applied. Neutral metrics have no rank.
- **Scores** are percentile ranks within the city, from 0 to 100. They compare districts of one city only.
- **Weights** run from 0 to 5 per category, with optional per-metric overrides. Negative weights are rejected. No weights gives the default score.

## Where `X-Data-Warning` appears

Only four endpoints send it: `GET /districts`, `GET /districts/{code}`, `GET /districts/{code}/report` and `GET /metrics/{key}/values`.
A response from any other endpoint says nothing about staleness. Do not clear the warning when one arrives.
`/meta` also reports staleness in its body, under `stale`. Show the notice when either source says the data is stale.

## Contract gaps

These are known. Raise each one in a pull request that changes the contract. Until then, work around it as described.

| Gap | Effect | Work-around |
|---|---|---|
| No `display` string for `area_km2`, commute `minutes` and similar `similarity` | You cannot show these in the language's number format | Show the number as the API sends it. In Polish, replace the decimal point with a comma, and do no rounding. Keep this in one small helper that you delete later (`src/lib/plainNumber.ts`). |
| No `display` string for `livability_score` and recommend `score`, and no "better than k districts" count for a driver's `percentile` | A list of scores with decimals, and a percentile, say nothing to a resident (issue #82, the coordinator's decision) | Lists show the score as a whole number with "pkt", and a driver as "better than k of the other n − 1 districts", k = round(percentile / 100 × (n − 1)). Both are computed in one place, `src/lib/score.ts`. Delete it when the API sends them. |
| `highlights` in `/districts` carry the key and the display string only | No label and no numeric value | Get the label from `/metrics`. Get the numeric value from `/metrics/{key}/values`. |
| Dates such as `as_of` are ISO strings with no display form | The date format is not localised | Show the date in words in the page language, inside `<time dateTime="…">` (`src/lib/dates.ts`, issue #82). This is formatting, not translation. |
| The default language is English | The portal default is Polish | Send `lang` on every request. |
| `/recommend` takes weights only | No budget range, tenure or work place | Do the budget filter and the commute step in the browser. See phase 2 in `REQUIREMENTS.md`. |

## Not in the contract

These features have no endpoint. Do not invent one in the client.

- The personalised AI report.
- Official notices (shown as "to be implemented after city approval").
- Aggregate demand counts.

The personalised AI report and resident feedback are moving to a separate city service with its own contract (`../city-service/openapi.yaml`, not written yet). Do not code against them before it exists.

Each will need a contract change first, and some need a separate backend service. The backend today is read-only and has no internet access by design.
