# API contract: DRAFT for the next session

**Status:** a proposal to be formalised, not a decision. It is derived from the private plan Phase D, the rules in `AGENTS.md` and the data model in `docs/DATA_DICTIONARY.md`. The next session should
settle the open questions in section 8, then write `backend/openapi.yaml` (OpenAPI 3.1) and generate the frontend client from it. Every example below is a real row or a real engine result from the
`warsaw` schema on 2026-09-30 (Śródmieście, Warsaw).

## 1. Principles (from the project rules)

- **One deployment, one city.** `CITY=warsaw|krakow` picks the Postgres schema. There is no `/cities` endpoint, no city parameter and no cross-links between the two builds.
- **Read-only, no accounts, no personal data.** The only computation at request time is `/recommend`; everything else is a stored value.
- **Never translate or format live.** English and Polish display strings, labels, descriptions, reports and notes are stored. The API selects the language; it does not produce it.
- **Provenance is part of every value**: data kind, source, licence, attribution, as-of date, method and caveat travel with the number. Estimated and proxy values must be distinguishable.
- **Honest gaps.** A metric a city does not have is reported as unavailable with a reason, never as zero or null without explanation.
- **Scores compare districts of one city only.** Responses that carry a score say so.

## 2. Conventions

| Topic | Proposal |
|---|---|
| Base path and format | `/v1`, JSON, UTF-8. Errors as RFC 9457 `application/problem+json`. |
| Language | `?lang=en|pl` (default `en`); `Accept-Language` as fallback. Every response echoes `lang`. Polish notes come from `translation_cache`; if missing, fall back to English and set `lang_fallback: true`. |
| Values | Always `value` (number) plus `display` (the stored `value_en` or `value_pl`). Clients never format numbers. |
| Identifiers | District `code` (slug such as `srodmiescie`); metric `key` (such as `sale_price_median_m2`). |
| Latest value | Per district and metric the row with the newest `as_of_date` (SQL in the data dictionary, section 5). |
| Caching | `ETag` derived from a `data_version` (for example a hash of the latest `fetched_at` and report versions); `Cache-Control: public, max-age=300`. Data changes only after an ingestion run. |
| CORS | Allow the frontend origin of the same city build only. |
| Auth | None. The service-role database key stays on the server. |

## 3. Endpoints

| Method and path | Purpose | Source of truth |
|---|---|---|
| `GET /v1/health` | Liveness and database reachability. | n/a |
| `GET /v1/meta` | City name, locale defaults, district count, `data_version`, latest ingestion run, attribution notes to show in the footer. | `districts`, `ingestion_runs` |
| `GET /v1/districts` | List: code, names, area, default livability score, a few highlight values. | `districts`, `district_metrics` |
| `GET /v1/districts.geojson` | Simplified boundaries for the map, with `code` in `properties`. | `districts.boundary` |
| `GET /v1/districts/{code}` | Everything about one district, grouped by category, with rank within the city per metric. | `district_metrics`, `metric_definitions` |
| `GET /v1/districts/{code}/report` | The cached report in `lang` and the score. | `district_reports` |
| `GET /v1/metrics` | The catalogue: key, category, labels, description, unit, direction, data kind, availability in this city. | `metric_definitions` |
| `GET /v1/metrics/{key}/values` | One metric for all districts, for choropleth and sorting, with rank. | `district_metrics` |
| `GET /v1/compare?codes=a,b,c` | Side-by-side values of chosen districts (2 to 4), same shape as the detail. | `district_metrics` |
| `POST /v1/recommend` | Rank districts for user weights and explain the ranking. | `scoring.py` over `district_metrics` |

## 4. Shapes with real examples

### 4.1 A metric value (used everywhere)

`GET /v1/districts/srodmiescie` returns, for each metric, an object of this shape (here `crimes_per_10k`, `lang=en`; the Polish caveat is shown to illustrate `lang=pl`):

```json
{
  "key": "crimes_per_10k",
  "label": "Recorded crimes per 10,000 residents",
  "display": "862 per 10,000 residents",
  "value": 862.5,
  "unit": "per 10,000",
  "data_kind": "observed",
  "n_obs": 8299,
  "as_of": "2024-12-31",
  "source": {
    "name": "Panorama dzielnic Warszawy w 2024 r.",
    "url": "https://warszawa.stat.gov.pl/publikacje-i-foldery/inne-opracowania/panorama-dzielnic-warszawy-w-2024-r-%2C5%2C26.html",
    "licence": "Public statistics of Urząd Statystyczny w Warszawie (source must be cited); crime data: Komenda Główna Policji",
    "attribution": "Urząd Statystyczny w Warszawie, Panorama dzielnic Warszawy w 2024 r.; crime data: Komenda Główna Policji"
  },
  "method": "Crimes ascertained by the Police in completed preparatory proceedings in 2024 (8299) over resident population at 31 Dec 2024, times 10,000.",
  "caveat": "Recorded crimes, not risk. Inflated in Śródmieście and other districts with many visitors and commuters; recorded where the offence occurred. District counts sum to 48,824 of 49,484 citywide; the publication does not allocate the rest.",
  "rank": {
    "position": 18,
    "of": 18,
    "direction": "lower is better"
  },
  "caveat_pl": "Przestępstwa stwierdzone, nie ryzyko. Zawyżone w Śródmieściu i innych dzielnicach z wieloma odwiedzającymi i osobami dojeżdżającymi; rejestrowane tam, gdzie doszło do przestępstwa. Liczby dla dzielnic sumują się do 48 824 z 49 484 w całym mieście; publikacja nie przypisuje reszty."
}
```

Notes: `rank.position` is 1 for the best district after applying the metric's direction (`lower is better` here), or omitted for `neutral` metrics. `n_obs` lets the client show a low-confidence badge; the caveat text already says so.

### 4.2 District list item (`GET /v1/districts`)

```json
{
  "code": "srodmiescie",
  "name": "Śródmieście",
  "area_km2": 15.591,
  "livability_score": 48.1,
  "highlights": [
    {
      "key": "sale_price_median_m2",
      "display": "21,117 PLN/m²",
      "data_kind": "observed"
    },
    {
      "key": "rent_price_median_m2",
      "display": "100 PLN/m²",
      "data_kind": "observed"
    }
  ]
}
```

### 4.3 One metric across districts (`GET /v1/metrics/sale_price_median_m2/values`, first three rows)

```json
[
  {
    "district": "zoliborz",
    "value": 22434.0,
    "display": "22,434 PLN/m²"
  },
  {
    "district": "srodmiescie",
    "value": 21117.0,
    "display": "21,117 PLN/m²"
  },
  {
    "district": "wola",
    "value": 20104.0,
    "display": "20,104 PLN/m²"
  }
]
```

### 4.4 Report (`GET /v1/districts/srodmiescie/report?lang=en`)

```json
{
  "district": "srodmiescie",
  "lang": "en",
  "livability_score": 48.1,
  "body": "Śródmieście ranks 14 of Warsaw's 18 districts, with a livability score of 48.1 out of 100. It ranks 1 for schools (6.3 per km²), shopping centres (0.6 per km²) and park share of district area. The population is 96,225, with a density of 6,180 per km². Weaknesses include the median asking rent of 100 PLN/m² and recorded crimes of 862 per 10,000 residents, both ranking 18 of 18; the crime figure is recorded where offences occur, which inflates counts in districts with many visitors and commuters. Estimated NO₂ (annual mean) is 28.7 µg/m³, also ranking 18 of 18; this value is calculated from other data, not measured. The median sale price is 21,117 PLN/m², and the average age of 46.5 years is also a proxy figure calculated from other data.",
  "model": "z-ai/glm-5.3-flash",
  "generated_at": "2026-09-30 11:28:17Z",
  "estimated_or_proxy_values_flagged": true
}
```

### 4.5 Recommendation (`POST /v1/recommend`)

Request and response computed with the real scoring engine for Warsaw (category weights 0 to 5; unknown categories rejected):

```json
{
  "request": {
    "weights": {
      "category": {
        "transport": 3,
        "cost": 3,
        "safety": 2,
        "environment": 1,
        "amenities": 1,
        "livability": 1
      }
    }
  },
  "response": {
    "weights_normalised": true,
    "ranking": [
      {
        "rank": 1,
        "code": "praga-poludnie",
        "name": "Praga-Południe",
        "score": 59.5,
        "top_drivers": [
          {
            "key": "sale_price_median_m2",
            "percentile": 52.9
          },
          {
            "key": "rent_price_median_m2",
            "percentile": 47.1
          }
        ]
      },
      {
        "rank": 2,
        "code": "targowek",
        "name": "Targówek",
        "score": 57.4,
        "top_drivers": [
          {
            "key": "rent_price_median_m2",
            "percentile": 76.5
          },
          {
            "key": "sale_price_median_m2",
            "percentile": 70.6
          }
        ]
      },
      {
        "rank": 3,
        "code": "ursynow",
        "name": "Ursynów",
        "score": 56.5,
        "top_drivers": [
          {
            "key": "rent_price_median_m2",
            "percentile": 88.2
          },
          {
            "key": "noise_share_above_55db",
            "percentile": 76.5
          }
        ]
      }
    ],
    "note": "Scores compare districts of this city only.",
    "metrics_used": 28,
    "missing_metrics": []
  }
}
```

`top_drivers` are the metrics that contribute most to that district's score under the given weights. The response must also list `missing_metrics` (metrics with no value for this city) so the client can explain gaps.

## 5. Unavailable metrics

A metric that exists in the catalogue but has no data in this city is returned in the catalogue and in the district detail as:

```json
{"key": "crimes_per_10k", "available": false, "reason": "Recorded crime is not part of the data for this city."}
```

Reasons for the known gaps are in `docs/DATA_DICTIONARY.md` ("Known gaps") and should be stored as text, not hard-coded in the backend (see open question 6).

## 6. Scoring

- The default score is stored (`livability_score_default`) and must equal what `/recommend` returns when no weights are sent. Reuse `data/sources/derived/scoring.py` (percentile ranks within the city, 100 = best, count metrics per km², category-balanced weights).
- Neutral metrics (nightlife density, restaurants, nursery fee, counts of sales and listings, demographics) are never scored. Composite indices (walkability, safety, ...) are not inputs to the score, to avoid double counting.
- User weights are set per category (0 to 5) and optionally per metric; the backend renormalises them and ignores metrics without data for the city.

## 7. Testing and quality gate

- Contract tests generated from `openapi.yaml` against a test database (or recorded fixtures of both schemas).
- The data gate stays `python -m pipeline.audit <city>`: zero errors before a deployment reads the data.
- Golden tests: `/recommend` with no weights reproduces `livability_score_default` for every district in both cities.

## 8. Open questions to settle first

1. **Boundaries for the map:** send simplified GeoJSON (how much tolerance?) or vector tiles? Proposal: one simplified GeoJSON per city (18 polygons), cached.
2. **Weights schema:** category-level sliders only, or also per-metric overrides? Are negative weights allowed ("I want a busy area")? Proposal: 0 to 5 per category, per-metric overrides optional, direction fixed by the catalogue.
3. **Rank in the detail:** computed on the fly per request (cheap for 18 districts) or stored? Proposal: computed with `scoring.py`, so it always matches the catalogue direction.
4. **What `/districts` carries:** which highlight metrics belong in the list item (price, rent, score, a data-kind badge)? Keep it small so the map loads fast.
5. **Language negotiation:** query parameter only, or `Accept-Language` too? What is the frontend's toggle behaviour (the deck says English default with a Polish switch)?
6. **Reasons for unavailable metrics:** store them in the database (a `reason` field per metric and city) or in a small config file in the backend? Proposal: a tiny table or JSON in `server/`, reviewed like data.
7. **Data version and freshness:** how is `data_version` computed, and does `/meta` expose per-source as-of dates for the footer attribution (the licences require credit lines, e.g. the road-accident credit)?
8. **Stale-data behaviour:** if the audit fails or reports are stale, does the API refuse to start or serve with a warning header?
9. **Weekly-refresh metrics** (air quality index): do clients get an `updated_at` and a shorter cache lifetime for those keys?
10. **Versioning and deprecation:** `/v1` prefix now; how are metric additions announced (the catalogue is data, so new keys appear without a new API version)?

## 9. Out of scope for the first contract

Accounts, saved searches, writes, live listings, live transit, address-level answers, and any live translation or generation. A personalised live report can be added later with the cached one as fallback (`AGENTS.md`).
