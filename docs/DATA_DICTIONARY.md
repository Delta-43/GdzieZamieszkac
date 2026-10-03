# Data dictionary

Generated 2026-10-02 from the live database by `python -m pipeline.data_dictionary` (run from `data/`). Do not edit by hand: change the migration or the connector, then regenerate.

## 1. Model in one page

- Two schemas, `krakow` and `warsaw`, with **identical tables**. The schema is the city boundary; there is no `city` column. A backend deployment picks the schema from `CITY`.
- **districts** (18 per city, with boundary) and **metric_definitions** (the catalogue: 51 keys, same in both cities) are the two dimensions.
- **district_metrics** is the fact table: one row per district, metric and `as_of_date`, with the numeric value, cached display strings in English and Polish, and full provenance.
- **district_reports** holds one pre-generated report per district and language. **translation_cache** holds the Polish versions of the English notes. **glossary** and **ingestion_runs** support ingestion.
- Access: RLS is enabled with no public policies; only `service_role` (the backend) can read. Never expose the service key to a browser.

## 2. Tables and columns (from the database comments)

### `audit_log`

Append-only history of UPDATE and DELETE on translation_cache, glossary, metric_definitions and district_reports. Use it to revert a bad edit.

| Column | Type | Meaning |
|---|---|---|
| `id` | bigint | Sequential change number. |
| `changed_at` | timestamp with time zone | When the change was committed to the table. |
| `table_name` | text | Table that was changed, without schema. |
| `operation` | text | UPDATE or DELETE. |
| `changed_by` | text | Database role that made the change. |
| `old_row` | jsonb | The whole row before the change. |
| `new_row` | jsonb | The whole row after the change (null for DELETE). |
| `on_behalf_of` | text | Person the change is attributed to, for example reviewer. Set by whoever applies the change with set local app.on_behalf_of = 'name' in the same transaction. Empty when nobody was named. |

Constraints: `PRIMARY KEY (id)`

### `city_series`

City-level history of one measure, one row per period. Used as context for the price outlook; it is not a district value and not part of the livability score.

| Column | Type | Meaning |
|---|---|---|
| `metric_key` | text | Name of the measure, for example nbp_secondary_transaction_price_m2. Not a key of metric_definitions. |
| `period_start` | date | First day of the period (for NBP data, the start of the survey quarter). |
| `period_end` | date | Last day of the period. |
| `value_num` | double precision | The value for the period, in the unit named in the method text. |
| `value_en` | text | Display string in English, formatted at load time. |
| `value_pl` | text | Display string in Polish, formatted at load time. |
| `data_kind` | text | observed, estimated or proxy. |
| `method` | text | What the measure is and how the source computes it. |
| `source` | text | Name of the source. |
| `source_url` | text | Where the source data comes from. |
| `licence` | text | Licence or terms of use of the source. |
| `attribution` | text | Credit line the source requires. |
| `fetched_at` | timestamp with time zone | When the row was last written. |

Constraints: `CHECK ((data_kind = ANY (ARRAY['observed'::text, 'estimated'::text, 'proxy'::text])))`; `PRIMARY KEY (metric_key, period_start)`

### `commute_matrix`

Estimated public transport minutes between district centres on one weekday morning. One row per ordered pair.

| Column | Type | Meaning |
|---|---|---|
| `from_district_id` | integer | Origin district. |
| `to_district_id` | integer | Destination district. |
| `minutes` | double precision | Door-to-door minutes including walking; null when no connection was found within the limit. |
| `method` | text | How the minutes were computed (service day, departure times, walking limits). |
| `computed_at` | timestamp with time zone | When the matrix was computed. |

Constraints: `FOREIGN KEY (from_district_id) REFERENCES warsaw.districts(id) ON DELETE CASCADE`; `FOREIGN KEY (to_district_id) REFERENCES warsaw.districts(id) ON DELETE CASCADE`; `PRIMARY KEY (from_district_id, to_district_id)`

### `district_metrics`

One value per district, metric and as-of date, with full provenance. The core table the API reads: value_num for scoring and sorting, value_en and value_pl as ready-made display strings, plus source, licence, attribution, method and caveats.

| Column | Type | Meaning |
|---|---|---|
| `id` | bigint | Surrogate key. |
| `district_id` | integer | The district (districts.id). Rows are deleted with their district. |
| `metric_key` | text | The metric (metric_definitions.metric_key). |
| `value_num` | double precision | The numeric value, in the unit of the metric. Used for scoring, sorting and colouring maps. |
| `value_en` | text | Cached English display string, for example '12,346 PLN/m²'. Read directly; never format or translate at request time. |
| `value_pl` | text | Cached Polish display string, for example '12 346 PLN/m²'. |
| `unit` | text | Unit key of this row (falls back to the catalogue unit). |
| `as_of_date` | date | The date the value describes or was collected (for example 2024-12-31 for a year-end statistic, or the snapshot date for listings). |
| `source` | text | Human-readable source name, for example 'Rejestr Cen Nieruchomości'. |
| `source_url` | text | Endpoint or page the data came from. |
| `licence` | text | Licence or terms of use of the source. Must be shown or respected when the value is displayed. |
| `attribution` | text | Credit line the source requires. Show it beside the value. |
| `data_kind` | text | 'observed' (measured or officially reported), 'estimated' (calculated from real inputs, for example interpolated between stations) or 'proxy' (an indirect indicator). Show it in the interface. |
| `method` | text | How the value was computed, in English. Empty for plain observed values. The Polish version is in translation_cache. |
| `coverage_note` | text | Caveats to show beside the value, in English (for example 'Recorded crimes, not risk'). The Polish version is in translation_cache. |
| `n_obs` | integer | Sample size behind the value: transactions, listings, stations, pixels or metrics used. Small values mean low confidence. |
| `fetched_at` | timestamp with time zone | When the row was written. |

Constraints: `CHECK ((data_kind = ANY (ARRAY['observed'::text, 'estimated'::text, 'proxy'::text])))`; `FOREIGN KEY (district_id) REFERENCES warsaw.districts(id) ON DELETE CASCADE`; `FOREIGN KEY (metric_key) REFERENCES warsaw.metric_definitions(metric_key)`; `PRIMARY KEY (id)`; `UNIQUE (district_id, metric_key, as_of_date)`

### `district_reports`

Pre-generated area report per district and language: a short text narrating the district's metrics, written natively in English and in Polish. Generated at ingestion and cached; never produced at request time.

| Column | Type | Meaning |
|---|---|---|
| `district_id` | integer | The district (districts.id). |
| `locale` | text | 'en' or 'pl'. Primary key together with district_id. |
| `body` | text | The report text (about 100-140 words). Only cites supplied figures, flags estimated and proxy values and makes no safety verdict. |
| `livability_score` | numeric(5,2) | The default livability score (0-100, relative to the other districts of the same city) that the report is based on. Used to detect stale reports. |
| `model` | text | The model that wrote the text, or 'template' for the deterministic fallback. |
| `data_version` | text | Short hash of the facts the report was built from. |
| `generated_at` | timestamp with time zone | When the report was stored. |

Constraints: `CHECK ((locale = ANY (ARRAY['en'::text, 'pl'::text])))`; `FOREIGN KEY (district_id) REFERENCES warsaw.districts(id) ON DELETE CASCADE`; `PRIMARY KEY (district_id, locale)`

### `district_series`

History of one metric per district, one row per period (a calendar quarter for sale prices). Rows exist only for periods with at least one observation.

| Column | Type | Meaning |
|---|---|---|
| `district_id` | integer | District the value belongs to. |
| `metric_key` | text | Metric in metric_definitions that this history belongs to. |
| `period_start` | date | First day of the period. |
| `period_end` | date | Last day of the period. |
| `value_num` | double precision | The value for the period, in the unit of the metric. |
| `value_en` | text | Display string in English, formatted at load time. |
| `value_pl` | text | Display string in Polish, formatted at load time. |
| `n_obs` | integer | Number of observations (deeds) behind the value; thin periods are flagged by the API. |
| `data_kind` | text | observed, estimated or proxy. |
| `method` | text | How the value was computed, including the filters and the periods left out. |
| `source` | text | Name of the source. |
| `source_url` | text | Where the source data comes from. |
| `licence` | text | Licence or terms of use of the source. |
| `attribution` | text | Credit line the source requires. |
| `fetched_at` | timestamp with time zone | When the row was last written. |

Constraints: `CHECK ((data_kind = ANY (ARRAY['observed'::text, 'estimated'::text, 'proxy'::text])))`; `FOREIGN KEY (district_id) REFERENCES warsaw.districts(id) ON DELETE CASCADE`; `FOREIGN KEY (metric_key) REFERENCES warsaw.metric_definitions(metric_key)`; `PRIMARY KEY (district_id, metric_key, period_start)`

### `districts`

The 18 dzielnice (districts) of the city with their boundary polygon. Every metric row joins to one of these. Boundaries come from OpenStreetMap (ODbL) and match the official district areas within 0.2%.

| Column | Type | Meaning |
|---|---|---|
| `id` | integer | Surrogate key used by the other tables. |
| `code` | text | Stable URL-safe slug of the district name without diacritics, for example 'stare-miasto'. Unique. Use it in APIs and links. |
| `name_pl` | text | District name in Polish. A proper noun, never translated. |
| `name_en` | text | District name in English. Equal to name_pl because proper nouns are not translated. |
| `boundary` | geometry(MultiPolygon,4326) | District boundary as a PostGIS MultiPolygon in EPSG:4326 (lon/lat), from OpenStreetMap admin_level=9. |
| `area_km2` | numeric(10,3) | District area in square kilometres, computed from the boundary in EPSG:2180 (Polish national grid). |
| `source` | text | Where the boundary comes from ('OpenStreetMap'). |
| `as_of_date` | date | Date the boundary was downloaded. |
| `created_at` | timestamp with time zone | Row creation time. |

Constraints: `PRIMARY KEY (id)`; `UNIQUE (code)`

### `glossary`

Fixed vocabulary that must never be machine-translated inconsistently: metric labels, units and data-kind terms in both languages. Synced from the catalogue and pipeline/glossary.py.

| Column | Type | Meaning |
|---|---|---|
| `term_pl` | text | Polish term. |
| `term_en` | text | English term. |
| `kind` | text | 'metric label', 'unit' or 'data kind'. |
| `note` | text | Optional remark for translators. |

Constraints: `PRIMARY KEY (term_pl, term_en)`

### `ingestion_runs`

Log of every retrieval or ETL run for provenance and debugging: which source, when, how many rows and which code version.

| Column | Type | Meaning |
|---|---|---|
| `id` | bigint | Surrogate key. |
| `source` | text | Name of the run, for example 'gtfs' or 'rcn'. |
| `status` | text | 'running', 'ok' or 'failed'. |
| `started_at` | timestamp with time zone | Start time. |
| `finished_at` | timestamp with time zone | End time. |
| `rows_written` | integer | Number of metric rows written. |
| `git_sha` | text | Short commit hash of the code that ran. |
| `notes` | text | Error message for failed runs. |

Constraints: `CHECK ((status = ANY (ARRAY['running'::text, 'ok'::text, 'failed'::text])))`; `PRIMARY KEY (id)`

### `metric_definitions`

The metric catalogue: what each metric_key means, in English and Polish, its unit, whether a higher value is better, and how often it refreshes. Drives labels, scoring direction and the API's metric list. Identical in both cities; a metric may have no data in one of them.

| Column | Type | Meaning |
|---|---|---|
| `metric_key` | text | Stable identifier of the metric, for example 'sale_price_median_m2'. Primary key; referenced by district_metrics. |
| `category` | text | Group: transport, demographics, livability, amenities, environment, cost or safety. |
| `label_en` | text | Short English label shown in the interface. |
| `label_pl` | text | Short Polish label shown in the interface (needs native-speaker review). |
| `description_en` | text | One or two English sentences defining the metric, its source and its main limit. |
| `description_pl` | text | The same description in Polish (needs native-speaker review). |
| `unit` | text | Unit key such as 'PLN/m²', '% of district' or 'per km²'. Display forms are in the glossary (pipeline/glossary.py). |
| `higher_is` | text | 'better', 'worse' or 'neutral': the direction used by the livability score. Neutral metrics are shown but never scored. |
| `refresh_cadence` | text | 'weekly' (traffic, air quality) or 'static' (refreshed by hand every 3-4 months). |
| `default_data_kind` | text | The usual data_kind of the metric: observed, estimated or proxy. A row may deviate; see district_metrics.data_kind. |
| `sort_order` | integer | Display order within the catalogue. |

Constraints: `CHECK ((category = ANY (ARRAY['transport'::text, 'demographics'::text, 'livability'::text, 'amenities'::text, 'environment'::text, 'cost'::text, 'safety'::text])))`; `CHECK ((default_data_kind = ANY (ARRAY['observed'::text, 'estimated'::text, 'proxy'::text])))`; `CHECK ((higher_is = ANY (ARRAY['better'::text, 'worse'::text, 'neutral'::text])))`; `CHECK ((refresh_cadence = ANY (ARRAY['weekly'::text, 'static'::text])))`; `PRIMARY KEY (metric_key)`

### `translation_cache`

Content-hash cache of machine translations of the free-text notes (method, coverage_note) so unchanged text is never sent twice. The backend reads the Polish note by looking up source_text with target_lang = 'pl'.

| Column | Type | Meaning |
|---|---|---|
| `cache_key` | text | sha256 of text, languages, glossary version and engine/model. Primary key. |
| `source_lang` | text | Language of source_text ('en'). |
| `target_lang` | text | Language of translated_text ('pl'). |
| `source_text` | text | The original text, exactly as stored in district_metrics.method or coverage_note. |
| `translated_text` | text | The translation, with fixed terminology enforced and Polish number formats. |
| `engine` | text | Engine that produced it ('openrouter' or 'libretranslate'). |
| `model` | text | Model name for LLM engines. |
| `glossary_version` | text | Version of the glossary used; part of the cache key. |
| `created_at` | timestamp with time zone | When the translation was stored. |

Constraints: `PRIMARY KEY (cache_key)`

## 3. Metric catalogue and coverage

`kind` is the default data kind (a row may differ, see `district_metrics.data_kind`). Coverage counts districts with a value (of 18). `higher` tells the scorer the direction; `neutral` metrics are shown but never scored. Refresh: `static` (by hand every 3-4 months) or `weekly`.

| Key | Category | English label | Polish label | Unit | Higher | Kind | Refresh | Kraków | Warsaw |
|---|---|---|---|---|---|---|---|---|---|
| `transit_stops_total` | transport | Public transport stops | Przystanki komunikacji miejskiej | stops | better | observed | static | 18 | 18 |
| `transit_stops_bus` | transport | Bus stops | Przystanki autobusowe | stops | better | observed | static | 18 | 18 |
| `transit_stops_tram` | transport | Tram stops | Przystanki tramwajowe | stops | better | observed | static | 18 | 18 |
| `transit_stops_rail_metro` | transport | Rail and metro stations | Stacje kolejowe i metra | stations | better | observed | static | 0 | 18 |
| `transit_routes_count` | transport | Routes serving the district | Linie obsługujące dzielnicę | routes | better | observed | static | 18 | 18 |
| `transit_departures_weekday` | transport | Weekday departures | Odjazdy w dzień roboczy | departures/day | better | observed | static | 18 | 18 |
| `transit_night_departures` | transport | Night departures | Odjazdy w nocy | departures/night | better | observed | static | 18 | 18 |
| `airport_distance_km` | transport | Distance to the airport | Odległość od lotniska | km | worse | observed | static | 18 | 18 |
| `population_total` | demographics | Population | Liczba ludności | people | neutral | observed | static | 0 | 18 |
| `residents_registered` | demographics | Registered permanent residents | Zameldowani na pobyt stały | people | neutral | observed | static | 18 | 0 |
| `population_density` | demographics | Population density | Gęstość zaludnienia | people/km² | neutral | observed | static | 18 | 18 |
| `age_mean` | demographics | Average age | Średni wiek | years | neutral | observed | static | 18 | 18 |
| `share_age_65_plus` | demographics | Residents aged 65 or older | Mieszkańcy w wieku 65+ | % | neutral | observed | static | 18 | 18 |
| `share_female` | demographics | Share of women | Udział kobiet | % | neutral | observed | static | 18 | 18 |
| `amenity_schools` | amenities | Schools | Szkoły | count | better | observed | static | 18 | 18 |
| `amenity_hospitals_clinics` | amenities | Hospitals and clinics | Szpitale i przychodnie | count | better | observed | static | 18 | 18 |
| `amenity_parks_share` | amenities | Park area | Łączna powierzchnia parków | % of district | better | observed | static | 18 | 18 |
| `amenity_supermarkets` | amenities | Supermarkets | Supermarkety | count | better | observed | static | 18 | 18 |
| `amenity_malls` | amenities | Shopping centres | Centra handlowe | count | better | observed | static | 18 | 18 |
| `amenity_gyms` | amenities | Gyms and fitness clubs | Siłownie i kluby fitness | count | better | observed | static | 18 | 18 |
| `amenity_parking` | amenities | Car parks | Parkingi | count | neutral | observed | static | 18 | 18 |
| `amenity_open_sports_grounds` | amenities | Open school sports grounds | Otwarte szkolne tereny sportowe | count | better | observed | static | 0 | 18 |
| `amenity_nursery_places` | amenities | Nursery and children's club places | Miejsca w żłobkach i klubach dziecięcych | count | better | observed | static | 18 | 18 |
| `amenity_restaurants_cafes` | amenities | Restaurants, cafes and fast food | Restauracje, kawiarnie i fast foody | count | neutral | observed | static | 18 | 18 |
| `air_pm10_mean` | environment | PM10 (annual mean) | Pył PM10 (średnia roczna) | µg/m³ | worse | estimated | weekly | 18 | 18 |
| `air_pm25_mean` | environment | PM2.5 (annual mean) | Pył PM2,5 (średnia roczna) | µg/m³ | worse | estimated | weekly | 18 | 18 |
| `air_no2_mean` | environment | NO₂ (annual mean) | Dwutlenek azotu NO₂ (średnia roczna) | µg/m³ | worse | estimated | weekly | 18 | 18 |
| `air_quality_index` | environment | Air quality index (latest) | Indeks jakości powietrza (najnowszy) | index 0-5 | worse | estimated | weekly | 18 | 18 |
| `tree_cover_share` | environment | Tree cover | Udział terenów zadrzewionych | % of district | better | observed | static | 18 | 18 |
| `green_space_share` | environment | Green space | Tereny zielone | % of district | better | observed | static | 18 | 18 |
| `heat_exposure_index` | environment | Summer heat exposure | Narażenie na letnie upały | index | worse | proxy | static | 18 | 18 |
| `noise_share_above_55db` | livability | Area above 55 dB | Tereny o natężeniu dźwięku powyżej 55 dB | % of district | worse | observed | static | 18 | 18 |
| `night_noise_estimate` | livability | Night noise (estimate) | Poziom hałasu w nocy (szacunek) | index | worse | proxy | static | 18 | 18 |
| `nightlife_density` | livability | Bars and clubs | Bary i kluby | per km² | neutral | observed | static | 18 | 18 |
| `busyness_index` | livability | Busyness | Natężenie ruchu | index | neutral | proxy | static | 18 | 18 |
| `walkability_index` | livability | Walkability | Dostępność usług dla pieszych | index | better | proxy | static | 18 | 18 |
| `family_friendliness_index` | livability | Family friendliness | Przyjazność rodzinom z dziećmi | index | better | proxy | static | 18 | 18 |
| `sale_price_median_m2` | cost | Median sale price per m² | Mediana ceny sprzedaży za m² | PLN/m² | worse | observed | static | 18 | 18 |
| `sale_transactions_count` | cost | Sale transactions | Liczba transakcji | count | neutral | observed | static | 18 | 18 |
| `rent_price_median_m2` | cost | Median asking rent per m² | Mediana ofertowej ceny najmu za m² | PLN/m² | worse | observed | static | 18 | 18 |
| `rent_listings_count` | cost | Rent listings counted | Liczba ofert najmu | count | neutral | observed | static | 18 | 18 |
| `nursery_fee_median` | cost | Median monthly nursery fee | Mediana miesięcznej opłaty za żłobek | PLN/month | neutral | observed | static | 18 | 18 |
| `crimes_per_10k` | safety | Recorded crimes per 10,000 residents | Przestępstwa stwierdzone na 10 000 mieszkańców | per 10,000 | worse | observed | static | 0 | 18 |
| `crime_detection_rate` | safety | Offender detection rate | Wskaźnik wykrywalności sprawców | % | better | observed | static | 0 | 18 |
| `road_accidents_per_km` | safety | Road accidents per km of road | Wypadki drogowe na km dróg | per km per year | worse | observed | static | 18 | 18 |
| `road_ped_cyc_casualties_per_km` | safety | Pedestrian and cyclist casualties per km | Poszkodowani piesi i rowerzyści na km | per km per year | worse | observed | static | 18 | 18 |
| `lit_street_share` | safety | Streets tagged as lit | Ulice oznaczone jako oświetlone | % | better | proxy | static | 18 | 18 |
| `emergency_services_distance_km` | safety | Average distance to police, fire station and hospital | Średnia odległość od policji, straży pożarnej i szpitala | km | worse | proxy | static | 18 | 18 |
| `amenity_aed_public` | safety | Public defibrillators (AED) | Publicznie dostępne defibrylatory (AED) | count | better | observed | static | 0 | 18 |
| `safety_index` | safety | Safety index (composite) | Wskaźnik bezpieczeństwa (złożony) | index | better | estimated | static | 18 | 18 |
| `livability_score_default` | livability | Livability score (default weights) | Wskaźnik jakości życia (wagi domyślne) | score 0-100 | better | estimated | static | 18 | 18 |

### Descriptions and sources per metric

- **`transit_stops_total`** (Public transport stops): Distinct public transport stops (bus, tram, rail, metro) inside the district, from the timetable feeds; platforms of one stop count once.  
  Sources: Kraków: Public transport GTFS feeds (as of 2026-09-30); Warsaw: Public transport GTFS feeds (as of 2026-09-30).
- **`transit_stops_bus`** (Bus stops): Distinct stops served by bus routes.  
  Sources: Kraków: Public transport GTFS feeds (as of 2026-09-30); Warsaw: Public transport GTFS feeds (as of 2026-09-30).
- **`transit_stops_tram`** (Tram stops): Distinct stops served by tram routes.  
  Sources: Kraków: Public transport GTFS feeds (as of 2026-09-30); Warsaw: Public transport GTFS feeds (as of 2026-09-30).
- **`transit_stops_rail_metro`** (Rail and metro stations): Rail and metro stations in the timetable feed (Warsaw: metro, SKM, rail, WKD). Not available for Kraków, whose feeds contain no rail.  
  Sources: Kraków: none (as of -); Warsaw: Public transport GTFS feeds (as of 2026-09-30).
- **`transit_routes_count`** (Routes serving the district): Distinct route numbers with at least one stop in the district.  
  Sources: Kraków: Public transport GTFS feeds (as of 2026-09-30); Warsaw: Public transport GTFS feeds (as of 2026-09-30).
- **`transit_departures_weekday`** (Weekday departures): Scheduled departures from the district's stops on a typical weekday (Tuesday 6 October 2026).  
  Sources: Kraków: Public transport GTFS feeds (as of 2026-09-30); Warsaw: Public transport GTFS feeds (as of 2026-09-30).
- **`transit_night_departures`** (Night departures): Scheduled departures between 23:00 and 04:59 on that weekday.  
  Sources: Kraków: Public transport GTFS feeds (as of 2026-09-30); Warsaw: Public transport GTFS feeds (as of 2026-09-30).
- **`airport_distance_km`** (Distance to the airport): Straight-line distance from the district centre to the main airport (Kraków-Balice, Warsaw Chopin); not a travel time.  
  Sources: Kraków: Public transport GTFS feeds (as of 2026-09-30); Warsaw: Public transport GTFS feeds (as of 2026-09-30).
- **`population_total`** (Population): Resident population at 31 December 2024 (Warsaw, statistical office). Not available for Kraków.  
  Sources: Kraków: none (as of -); Warsaw: Panorama dzielnic Warszawy w 2024 r. (as of 2024-12-31).
- **`residents_registered`** (Registered permanent residents): People registered for permanent residence. Not the same as total population.  
  Sources: Kraków: BIP Kraków: liczba mieszkańców w dzielnicach (as of 2025-12-31); Warsaw: none (as of -).
- **`population_density`** (Population density): People per km² of district area. Warsaw: official figure. Kraków: registered residents over district area, so an underestimate.  
  Sources: Kraków: BIP Kraków: liczba mieszkańców w dzielnicach (as of 2025-12-31); Warsaw: Panorama dzielnic Warszawy w 2024 r. (as of 2024-12-31).
- **`age_mean`** (Average age): Mean age of residents. Warsaw: estimated from 5-year age bands. Kraków: from the year of birth of registered residents.  
  Sources: Kraków: Kraków open data: residents registered for permanent residence by age and sex (as of 2024-12-31); Warsaw: Panorama dzielnic Warszawy w 2024 r. (as of 2024-12-31).
- **`share_age_65_plus`** (Residents aged 65 or older): Share of residents aged 65 or older.  
  Sources: Kraków: Kraków open data: residents registered for permanent residence by age and sex (as of 2024-12-31); Warsaw: Panorama dzielnic Warszawy w 2024 r. (as of 2024-12-31).
- **`share_female`** (Share of women): Share of women among residents.  
  Sources: Kraków: Kraków open data: residents registered for permanent residence by age and sex (as of 2024-12-31); Warsaw: Panorama dzielnic Warszawy w 2024 r. (as of 2024-12-31).
- **`amenity_schools`** (Schools): Schools mapped in OpenStreetMap inside the district; counts reflect how completely volunteers have mapped them.  
  Sources: Kraków: OpenStreetMap via Overpass (as of 2026-09-30); Warsaw: OpenStreetMap via Overpass (as of 2026-09-30).
- **`amenity_hospitals_clinics`** (Hospitals and clinics): Hospitals and clinics mapped in OpenStreetMap inside the district.  
  Sources: Kraków: OpenStreetMap via Overpass (as of 2026-09-30); Warsaw: OpenStreetMap via Overpass (as of 2026-09-30).
- **`amenity_parks_share`** (Park area): Share of the district area covered by parks (OpenStreetMap leisure=park); forests and cemeteries are not counted.  
  Sources: Kraków: OpenStreetMap via Overpass (as of 2026-09-30); Warsaw: OpenStreetMap via Overpass (as of 2026-09-30).
- **`amenity_supermarkets`** (Supermarkets): Supermarkets mapped in OpenStreetMap inside the district.  
  Sources: Kraków: OpenStreetMap via Overpass (as of 2026-09-30); Warsaw: OpenStreetMap via Overpass (as of 2026-09-30).
- **`amenity_malls`** (Shopping centres): Shopping centres mapped in OpenStreetMap inside the district.  
  Sources: Kraków: OpenStreetMap via Overpass (as of 2026-09-30); Warsaw: OpenStreetMap via Overpass (as of 2026-09-30).
- **`amenity_gyms`** (Gyms and fitness clubs): Gyms and fitness clubs mapped in OpenStreetMap inside the district.  
  Sources: Kraków: OpenStreetMap via Overpass (as of 2026-09-30); Warsaw: OpenStreetMap via Overpass (as of 2026-09-30).
- **`amenity_parking`** (Car parks): Car parks and parking structures mapped in OpenStreetMap; shown for information and not scored.  
  Sources: Kraków: OpenStreetMap via Overpass (as of 2026-09-30); Warsaw: OpenStreetMap via Overpass (as of 2026-09-30).
- **`amenity_open_sports_grounds`** (Open school sports grounds): School sites in the district whose sports grounds (pitches, tracks, courts, outdoor gyms) are open to residents free of charge at set hours (Warsaw open data, Biuro Edukacji).  
  Sources: Kraków: none (as of -); Warsaw: dane.um.warszawa.pl: Otwarte boiska (as of 2026-09-30).
- **`amenity_nursery_places`** (Nursery and children's club places): Places in active nurseries and children's clubs inside the district (national register of nurseries and children's clubs).  
  Sources: Kraków: National register of nurseries and children's clubs (as of 2026-09-30); Warsaw: National register of nurseries and children's clubs (as of 2026-09-30).
- **`amenity_restaurants_cafes`** (Restaurants, cafes and fast food): Restaurants, cafes and fast-food places mapped in OpenStreetMap inside the district; counts reflect mapping completeness. Shown for information, not part of the livability score.  
  Sources: Kraków: OpenStreetMap via Overpass (as of 2026-09-30); Warsaw: OpenStreetMap via Overpass (as of 2026-09-30).
- **`air_pm10_mean`** (PM10 (annual mean)): Annual mean PM10 over the 12 months to August 2026, interpolated between GIOŚ stations; not address-level exposure.  
  Sources: Kraków: GIOŚ air quality stations (archival data) (as of 2026-08-31); Warsaw: GIOŚ air quality stations (archival data) (as of 2026-08-31).
- **`air_pm25_mean`** (PM2.5 (annual mean)): Annual mean PM2.5 over the 12 months to August 2026, interpolated between GIOŚ stations; few stations measure it, so districts differ little.  
  Sources: Kraków: GIOŚ air quality stations (archival data) (as of 2026-08-31); Warsaw: GIOŚ air quality stations (archival data) (as of 2026-08-31).
- **`air_no2_mean`** (NO₂ (annual mean)): Annual mean nitrogen dioxide over the 12 months to August 2026, interpolated between GIOŚ stations; not address-level exposure.  
  Sources: Kraków: GIOŚ air quality stations (archival data) (as of 2026-08-31); Warsaw: GIOŚ air quality stations (archival data) (as of 2026-08-31).
- **`air_quality_index`** (Air quality index (latest)): GIOŚ index from 0 (very good) to 5 (very bad), latest reading, interpolated between stations.  
  Sources: Kraków: GIOŚ air quality index (current) (as of 2026-09-30); Warsaw: GIOŚ air quality index (current) (as of 2026-09-30).
- **`tree_cover_share`** (Tree cover): Share of the district area under tree canopy (Copernicus Tree Cover Density 2024, 10 m); includes gardens and street trees.  
  Sources: Kraków: Copernicus HRL Tree Cover Density 10 m (as of 2024-01-01); Warsaw: Copernicus HRL Tree Cover Density 10 m (as of 2024-01-01).
- **`green_space_share`** (Green space): Share of the district area classified as green urban areas or forest (Copernicus Urban Atlas 2018).  
  Sources: Kraków: Copernicus Urban Atlas 2018 (as of 2018-12-31); Warsaw: Copernicus Urban Atlas 2018 (as of 2018-12-31).
- **`heat_exposure_index`** (Summer heat exposure): Proxy from low tree cover and low green space; higher means hotter. Compares districts of one city only (0-100).  
  Sources: Kraków: Derived from loaded metrics (as of 2026-09-30); Warsaw: Derived from loaded metrics (as of 2026-09-30).
- **`noise_share_above_55db`** (Area above 55 dB): Share of the district area with a noise level of 55 dB Lden or more in the 2022 strategic noise map (Warsaw: road, rail, tram, air and industry; Kraków: road, rail and industry).  
  Sources: Kraków: Kraków strategic noise map 2022 (Lden) (as of 2022-12-31); Warsaw: Warsaw strategic noise map 2022 (Lden, WMS) (as of 2022-12-31).
- **`night_noise_estimate`** (Night noise (estimate)): Proxy from nightlife density and the share of the district above 55 dB; higher means louder. Compares districts of one city only (0-100).  
  Sources: Kraków: Derived from loaded metrics (as of 2026-09-30); Warsaw: Derived from loaded metrics (as of 2026-09-30).
- **`nightlife_density`** (Bars and clubs): Bars, pubs and nightclubs per km² (OpenStreetMap).  
  Sources: Kraków: OpenStreetMap via Overpass (as of 2026-09-30); Warsaw: OpenStreetMap via Overpass (as of 2026-09-30).
- **`busyness_index`** (Busyness): Proxy from the density of stops, departures, shops and nightlife; higher means busier. Compares districts of one city only (0-100).  
  Sources: Kraków: Derived from loaded metrics (as of 2026-09-30); Warsaw: Derived from loaded metrics (as of 2026-09-30).
- **`walkability_index`** (Walkability): Proxy from the density of supermarkets, schools, clinics and stops and the park share; higher means more daily needs close by. Compares districts of one city only (0-100).  
  Sources: Kraków: Derived from loaded metrics (as of 2026-09-30); Warsaw: Derived from loaded metrics (as of 2026-09-30).
- **`family_friendliness_index`** (Family friendliness): Proxy from school and nursery place density, green space, tree cover, low noise and few pedestrian and cyclist casualties. Compares districts of one city only (0-100).  
  Sources: Kraków: Derived from loaded metrics (as of 2026-09-30); Warsaw: Derived from loaded metrics (as of 2026-09-30).
- **`sale_price_median_m2`** (Median sale price per m²): Median gross price per m² of free-market residential sales in the official RCN register, 24 months to September 2026.  
  Sources: Kraków: Rejestr Cen Nieruchomości (as of 2026-09-30); Warsaw: Rejestr Cen Nieruchomości (as of 2026-09-30).
- **`sale_transactions_count`** (Sale transactions): Number of transactions behind the median sale price.  
  Sources: Kraków: Rejestr Cen Nieruchomości (as of 2026-09-30); Warsaw: Rejestr Cen Nieruchomości (as of 2026-09-30).
- **`rent_price_median_m2`** (Median asking rent per m²): Median asking rent per m² (without the service charge) from Otodom and OLX listings, one snapshot in September 2026; not signed contracts.  
  Sources: Kraków: Otodom and OLX flat rent listings (snapshot) (as of 2026-09-30); Warsaw: Otodom and OLX flat rent listings (snapshot) (as of 2026-09-30).
- **`rent_listings_count`** (Rent listings counted): Number of rent listings behind the median asking rent, after removing cross-postings.  
  Sources: Kraków: Otodom and OLX flat rent listings (snapshot) (as of 2026-09-30); Warsaw: Otodom and OLX flat rent listings (snapshot) (as of 2026-09-30).
- **`nursery_fee_median`** (Median monthly nursery fee): Median basic monthly fee paid by parents (without discounts and meals) across active nurseries and children's clubs in the district, as reported to the national register. Shown for information; not part of the livability score.  
  Sources: Kraków: National register of nurseries and children's clubs (as of 2026-09-30); Warsaw: National register of nurseries and children's clubs (as of 2026-09-30).
- **`crimes_per_10k`** (Recorded crimes per 10,000 residents): Crimes recorded by the police per 10,000 residents in 2024 (Warsaw only). Higher in districts with many visitors and commuters; not a measure of risk.  
  Sources: Kraków: none (as of -); Warsaw: Panorama dzielnic Warszawy w 2024 r. (as of 2024-12-31).
- **`crime_detection_rate`** (Offender detection rate): Share of recorded crimes in 2024 with a detected offender (Warsaw only).  
  Sources: Kraków: none (as of -); Warsaw: Panorama dzielnic Warszawy w 2024 r. (as of 2024-12-31).
- **`road_accidents_per_km`** (Road accidents per km of road): Road accidents with injury or death per km of road per year, mean of 2022-2024 (police SEWiK data).  
  Sources: Kraków: SEWiK police accident register (sewik.pl dump) (as of 2024-12-31); Warsaw: SEWiK police accident register (sewik.pl dump) (as of 2024-12-31).
- **`road_ped_cyc_casualties_per_km`** (Pedestrian and cyclist casualties per km): Injured or killed pedestrians and cyclists per km of road per year, mean of 2022-2024 (police SEWiK data).  
  Sources: Kraków: SEWiK police accident register (sewik.pl dump) (as of 2024-12-31); Warsaw: SEWiK police accident register (sewik.pl dump) (as of 2024-12-31).
- **`lit_street_share`** (Streets tagged as lit): Share of road length tagged as lit in OpenStreetMap. Untagged roads may still be lit, so this is a weak signal.  
  Sources: Kraków: OpenStreetMap via Overpass (as of 2026-09-30); Warsaw: OpenStreetMap via Overpass (as of 2026-09-30).
- **`emergency_services_distance_km`** (Average distance to police, fire station and hospital): Mean straight-line distance from the district centre to the nearest police station, fire station and hospital (OpenStreetMap); not a response time.  
  Sources: Kraków: OpenStreetMap via Overpass (as of 2026-09-30); Warsaw: OpenStreetMap via Overpass (as of 2026-09-30).
- **`amenity_aed_public`** (Public defibrillators (AED)): Active automated external defibrillators marked as publicly accessible inside the district (Warsaw open data, Stołeczne Centrum Bezpieczeństwa); access hours differ by location.  
  Sources: Kraków: none (as of -); Warsaw: dane.um.warszawa.pl: Lokalizacja defibrylatorów (AED) (as of 2026-09-30).
- **`safety_index`** (Safety index (composite)): Composite of the road safety, street lighting, emergency-service distance and (Warsaw only) recorded crime metrics; higher is better. Compares districts of one city only (0-100). Not a statement that an area is safe or unsafe.  
  Sources: Kraków: Derived from loaded metrics (as of 2026-09-30); Warsaw: Derived from loaded metrics (as of 2026-09-30).
- **`livability_score_default`** (Livability score (default weights)): Default livability score from 0 to 100: mean of percentile ranks of all directional metrics, each category counting equally. Compares districts of one city only; rent and sale price count against a district.  
  Sources: Kraków: Derived from loaded metrics (as of 2026-09-30); Warsaw: Derived from loaded metrics (as of 2026-09-30).

### Known gaps

- `transit_stops_rail_metro`: Kraków: none; 
- `population_total`: Kraków: none; 
- `residents_registered`: Warsaw: none
- `amenity_open_sports_grounds`: Kraków: none; 
- `crimes_per_10k`: Kraków: none; 
- `crime_detection_rate`: Kraków: none; 
- `amenity_aed_public`: Kraków: none; 

Reasons: recorded crime is out of scope for Kraków (decision 2026-09-30); Kraków's timetable feeds have no rail; registrations are not a population count (Kraków `population_total`); Panorama has no registration count (Warsaw `residents_registered`); the nursery and open-data metrics with a Warsaw-only source are listed in the catalogue.

## 4. Display strings, units and data kinds

`value_en` and `value_pl` are ready to show: English `12,346 PLN/m²` and `26.4% of district area`; Polish `12 346 PLN/m²` (no-break space) and `26,4% powierzchni dzielnicy`. Counts show no unit noun so Polish plurals cannot be wrong. Unit keys and their forms (`pipeline/glossary.py`):

| Unit key | English | Polish |
|---|---|---|
| `%` | % | % |
| `% of district` | % of district area | % powierzchni dzielnicy |
| `count` | (none) | (none) |
| `stops` | (none) | (none) |
| `stations` | (none) | (none) |
| `routes` | (none) | (none) |
| `people` | (none) | (none) |
| `people/km²` | per km² | na km² |
| `per km²` | per km² | na km² |
| `per km` | per km | na km |
| `per km per year` | per km per year | na km rocznie |
| `per 10,000` | per 10,000 residents | na 10 000 mieszkańców |
| `departures/day` | departures per day | odjazdów na dobę |
| `departures/night` | departures per night | odjazdów w nocy |
| `PLN/m²` | PLN/m² | PLN/m² |
| `PLN/month` | PLN per month | PLN miesięcznie |
| `µg/m³` | µg/m³ | µg/m³ |
| `km` | km | km |
| `years` | years | lat |
| `index` | points | pkt |
| `score 0-100` | points (0-100) | pkt (0-100) |
| `index 0-5` | on a 0-5 scale | w skali 0-5 |

`data_kind`: **observed** (measured or officially reported), **estimated** (calculated from real inputs, e.g. interpolated between stations or composed by rank), **proxy** (an indirect indicator). Show the kind beside every value. `n_obs` is the sample size behind a value; the note says 'Low confidence' when it is small (fewer than 20 listings, fewer than 5 institutions).

## 5. Read patterns for the API

Latest value per district and metric (the API should use this everywhere; older `as_of_date` rows may exist):

```sql
select distinct on (d.code, m.metric_key)
       d.code, m.metric_key, m.value_num, m.value_en, m.value_pl, m.unit, m.data_kind, m.n_obs,
       m.source, m.licence, m.attribution, m.as_of_date, m.method, m.coverage_note
from <schema>.district_metrics m join <schema>.districts d on d.id = m.district_id
order by d.code, m.metric_key, m.as_of_date desc;
```

Polish version of a note (lookup, never translate live):

```sql
select translated_text from <schema>.translation_cache
where target_lang = 'pl' and source_text = :method_or_coverage_note
order by created_at desc limit 1;
```

Report and score for a district:

```sql
select r.locale, r.body, r.livability_score, r.model, r.generated_at
from <schema>.district_reports r join <schema>.districts d on d.id = r.district_id where d.code = :code;
```

Boundary as GeoJSON for the map: `select code, extensions.st_asgeojson(boundary) from <schema>.districts` (simplify with `extensions.st_simplifyPreserveTopology(boundary, 0.0002)` for the list view).

Ranking and personalised scores are computed by `data/sources/derived/scoring.py` (percentile ranks within the city, 0-100, 100 = best; count metrics per km²; category-balanced default weights). Reuse it in the backend so `/recommend` matches the stored default score.

