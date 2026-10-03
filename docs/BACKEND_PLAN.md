# Backend plan: scope, data serving and modelling

**Status:** agreed scope and API answers (coordinator, 2026-09-30); a few proposals stand until someone objects (section 6). **Implemented 2026-10-02:** every item below is built (16 operations), including price history (section 2 and 4), the commute matrix (both cities) and the price outlook, which ships without a forward scenario (section 5). Read with `docs/API_CONTRACT_DRAFT.md`
(endpoints and shapes), `docs/DATA_DICTIONARY.md` (what is stored) and the private plan Phase D and E.

## 1. Decisions taken (2026-09-30, coordinator)

| Topic | Decision |
|---|---|
| Price prediction | Observed history and momentum first. A 5-year **scenario range** ships only if it beats a naive baseline in backtests; otherwise the app shows the historical range only. No point forecast per district. |
| First-release extras | Yield and rent-vs-buy, persona presets and similar districts, commute-time matrix, price history charts. |
| Finer areas, "check an address" | **Not planned.** District level for the whole project. No PostGIS point-lookup capability is needed. |
| Primary audience | Renters and newcomers. Yield and outlook are secondary views, not the lead of the pitch. |

## 2. What the data can and cannot support

- `district_metrics` holds **one `as_of_date` per metric and district**. It has no history.
- The raw RCN snapshot (`data/snapshots/<city>/rcn/lokale_*.parquet`) holds dated deeds. Usable deeds (free market, residential, 15-250 m2, 3,000-60,000 PLN/m2,
  not future-dated), checked 2026-09-30:
  - Warsaw 155,110; 26-35k a year from 2021, but only 250-650 a year in 2016-2019.
  - Kraków 101,464; 14-18k a year from 2021, 5k in 2020, under 1.5k a year before.
  - The years before 2021 reflect what the register had loaded, not the market. Their medians (4.8k-7.7k PLN/m2 in Warsaw before 2020) must not be plotted as a trend.
- **Usable district history starts in 2021 for Kraków (22 quarters kept) and in 2022Q4 for Warsaw (14 quarters kept; measured 2026-10-02).** Warsaw holds only 150 to 280 deeds
  a quarter citywide before 2022Q4 and 8 in 2026Q2, because the register was not loaded for those quarters, so they are left out (a quarter is kept only if its citywide count is at least
  25% of the city's median). The older Warsaw records mostly have a blank ownership share, which the `1/1` filter drops; loosening it was not tried. Cells under 30 deeds are stored and flagged
  (`low_confidence`): 16 of 396 in Kraków, 9 of 252 in Warsaw. Built as `district_series` (migration 0016) and `data/sources/price/rcn_series.py`.
- NBP publishes a city-level quarterly price file back to 2006 (`static.nbp.pl/dane/rynek-nieruchomosci/ceny_mieszkan.xlsx`, see the private research notes section 6). City level only. It is
  the source for long-run context and for the scenario range.
- Rent has one snapshot (2026-09-30 listing scrape). There is no rent history and none can be created honestly, so **yield is a current-day figure**, not a trend.

## 3. Features for the first release

### 3.1 Must exist (from the API draft)
`/health`, `/meta`, `/districts`, `/districts.geojson`, `/districts/{code}`, `/districts/{code}/report`, `/metrics`, `/metrics/{key}/values`, `/compare`, `/recommend`.
Quality gate: contract tests from `openapi.yaml`; a golden test that `/recommend` without weights reproduces `livability_score_default` in both cities.

### 3.2 Added by the decisions above

| Feature | How it is computed | Kind | New endpoint or field |
|---|---|---|---|
| **Gross rental yield** and years to pay back | `rent_price_median_m2 * 12 / sale_price_median_m2`; years = inverse. Both inputs already stored. Show `rent_listings_count` and `sale_transactions_count` next to it. | `estimated` (asking rent over transaction price; caveat says so) | `yield_gross`, `payback_years` on the district detail; also a metric in `/metrics/{key}/values` |
| **Rent versus buy** | Same inputs, plus a user-set price size in m2 and a deposit-free comparison of monthly rent to the price paid back over N years. No mortgage model in the first release (no rate data source chosen). | `estimated` | `GET /v1/districts/{code}/rent-vs-buy?area_m2=` (stateless calculation) |
| **Persona presets** | Named weight sets (student, family, remote worker, senior, investor) stored as data, not code, and applied through `/recommend`. | n/a | `GET /v1/personas` |
| **Similar districts** | Cosine similarity of the percentile vectors that `scoring.py` already builds, over scored metrics only. | derived | `GET /v1/districts/{code}/similar` |
| **Commute-time matrix** | District-to-district median public-transport time, precomputed offline from the GTFS feeds we already load (weekday morning departures, walk to and from stops). Stored as data. | `estimated` | `GET /v1/commute?from={code}` returning all 18 destinations |
| **Price history charts** | Quarterly median PLN/m2 per district from RCN, 2021 onward, with `n_obs` per quarter. | `observed` | `GET /v1/districts/{code}/series/{key}`; new table (section 4) |

The commute matrix is the largest piece of work in this list. Method decided (section 6, question A).

## 4. Data and schema changes (needs `data/` and `server/` review)

New table in both schemas (identical), migration `0016`:

```
district_series(
  district_id, metric_key, period_start, period_end,   -- e.g. a quarter
  value, n_obs, data_kind, method, source, fetched_at,
  primary key (district_id, metric_key, period_start))
```

It is separate from `district_metrics` on purpose: the score and the audit read the latest value per metric from `district_metrics`, and quarterly rows there would blur that.
New metric keys for derived values (`yield_gross`, `payback_years`, `price_growth_12m`, `price_growth_since_2021`) go in the catalogue with `data_kind`, `method` and caveat like any other.
Commute times are 18 x 18 per city; a small `commute_matrix(from_district, to_district, minutes, method, computed_at)` table is enough. Both new tables get comments, RLS, and
the delete/truncate guards from migration 0011 (extend `guard_no_delete` and `guard_no_truncate` to them).

Pipeline additions (in `data/`, run after any RCN load): `rcn_series.py` (quarterly medians from the parquet snapshot, same filters as `rcn_load.py`), `yield.py`, `commute.py`, and
`pipeline.audit` rules for the new tables (no quarter with fewer than the threshold shown without a flag; series must end at the same date as `sale_price_median_m2`).

## 5. Price outlook: how it is built and when it ships

1. **Momentum (ships).** Trailing 12-month growth and growth since 2021, per district, from `district_series`. Every value shows `n_obs`; districts under the deed threshold are marked low confidence.
2. **Scenario range (ships only if it passes).**
   - City path: empirical distribution of historical 5-year growth in the NBP city series (2006 onward, nominal and, if a deflator is added, real); low, base and high are chosen quantiles, stated in the method text.
   - District path: the district's price relative to its city (premium ratio, from RCN 2021 onward), shrunk toward the city figure in proportion to its `n_obs`, and assumed to mean-revert.
   - **Backtest gate:** rolling-origin tests on the NBP series (forecast 4 to 8 quarters ahead, many origins) and on the RCN premium ratios. Compare to two baselines: "no change" and "last year's
     growth continues". If the method does not beat both on median absolute error and interval coverage, the app shows the historical range only and no forward numbers.
   - Wording: "estimated scenario range, not a forecast or financial advice". No single number, no ranking of districts by predicted growth.
3. **Growth-potential index (not in the first release).** Candidate proxies: census population change (Warsaw), share and growth of primary-market (new-build) sales in RCN, OSM point-of-interest change over time via the ohsome API.
   None is verified; each needs a check of coverage and bias before it is used. Labelled `proxy`.

### Result of the backtest (2026-10-02)

`data/sources/derived/outlook_backtest.py` ran two methods on the NBP city series (17 cities, 2006Q3 to 2026Q2, 80 quarters), rolling origin, horizons 4 and 8 quarters. The result is stored in
`backend/app/data/outlook_backtest.json`. Median absolute error in log growth, pooled over all cities (the gate also needs an 80% interval that holds 70 to 90% of outcomes):

| Horizon | Method | Error | No change | Last year continues | Coverage |
|---|---|---|---|---|---|
| 4 quarters | history range | 0.062 | 0.071 | **0.042** | 69% |
| 4 quarters | damped momentum | 0.063 | 0.071 | **0.042** | 53% |
| 8 quarters | history range | 0.156 | 0.177 | **0.065** | 54% |
| 8 quarters | damped momentum | 0.169 | 0.177 | **0.065** | 41% |

**No method passes**, so no forward numbers ship. "Last year's growth continues" wins everywhere, but that is one market cycle (2013 to 2026): it would have failed in a turn, and the 5-year horizon in the plan cannot be
tested (about five independent windows). The district path (premium ratio) cannot be backtested with 14 to 22 quarters. What ships is `GET /districts/{code}/outlook`: momentum per district, the city's past one- and
two-year change range (NBP, shown as history), and the backtest. Momentum uses only quarters with at least half the city's usual deed count, because Warsaw's first (2022Q4) and newest (2026Q1) quarters are partly loaded and
would overstate growth (the district median since 2022Q4 was +43% against +30% in the NBP city series). To revisit when a new method or a longer history exists: re-run the script, and `test_the_backtest_file_agrees_with_the_decision` fails until the endpoint is changed.

## 6. Questions and their answers

Answered by the coordinator on 2026-09-30:

| Question | Answer |
|---|---|
| A. Commute method | Simple routing over the GTFS we hold: one representative weekday morning, district centroids, walking to and from stops. Not r5py or OpenTripPlanner. |
| C2. Weights schema | Category weights 0 to 5, optional per-metric overrides. Direction is fixed by the catalogue, so **no negative weights**. |
| C5. Language | `?lang=en|pl` first, `Accept-Language` as fallback, English by default. A missing Polish note falls back to English and sets `lang_fallback: true`. |
| C8. Stale data | The API **serves** and warns: a warning header on responses and a `stale` flag with reasons in `/meta`. It does not refuse to start. |

Not asked, so **proposals stand until the coordinator objects** (they go into the OpenAPI file as written; each is easy to change in review):

| Question | Proposal used |
|---|---|
| B. Rent versus buy inputs | Simple payback comparison, no mortgage model in the first release. |
| C1. Map boundaries | One simplified GeoJSON per city (18 polygons), cached. |
| C3. Rank in the detail | Computed with `scoring.py` on each request, so it always matches the catalogue direction. |
| C4. `/districts` item | Code, names, area, default score, and two highlights (sale price, rent) with their data-kind badge. |
| C6. Reasons for unavailable metrics | Stored as data (a small table or reviewed JSON in `server/`), not hard-coded in the backend. |
| C7. `data_version` | Hash of the latest `fetched_at` values and report versions; `/meta` exposes per-source as-of dates and attribution lines for the footer. |
| C9. Weekly-refresh metrics | Each carries `updated_at`; responses that include them get a shorter cache lifetime. |
| C10. Versioning | `/v1` prefix; new metric keys appear as catalogue data without a new API version. |
| D. Deed threshold | 30 deeds per district and quarter; below it the value is shown with a low-confidence badge. |
| E. Deflator | Real terms only if a CPI series is easy to fetch; otherwise nominal with a stated caveat. |

## 7. Order of work

1. ~~Coordinator answers section 6.~~ Done 2026-09-30 (answers and standing proposals above; logged in the private decision log).
2. `backend/openapi.yaml` for the endpoints in 3.1 and 3.2, PR for review, before code.
3. Data side, in parallel: migration `0016`, `rcn_series`, `yield`, `commute`, audit rules. Measure deeds per district and quarter first. **Done 2026-10-02** (also migration `0017` for `city_series`, `nbp_load.py` and the backtest).
4. FastAPI skeleton and the endpoints, contract tests, golden test.
5. Backtest notebook or script for the scenario range in `data/analysis/` (outputs and the pass or fail verdict recorded in the private decision log); wire the endpoint only on a pass.
6. Frontend starts against the generated client once the contract merges (the private plan Phase E).

## 8. Out of scope (unchanged and newly decided)

Accounts, saved searches, live listings, live transit, live translation or generation, address-level answers, sub-district areas (decided 2026-09-30), point forecasts, district rankings by predicted growth.
