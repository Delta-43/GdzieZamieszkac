-- Annotations for the krakow schema: a comment on the schema, every table and every column, so the data model documents itself
-- (psql \d+, Supabase table editor, generated TypeScript types and the API contract all show them). Identical in both cities. Safe to re-run.
comment on schema krakow is 'Data for one city build (dzielnice/districts, metrics with provenance, cached reports and translations). Read-only for the API; RLS is on and only service_role has access. Identical structure in both city schemas.';

comment on table krakow.districts is 'The 18 dzielnice (districts) of the city with their boundary polygon. Every metric row joins to one of these. Boundaries come from OpenStreetMap (ODbL) and match the official district areas within 0.2%.';
comment on column krakow.districts.id is 'Surrogate key used by the other tables.';
comment on column krakow.districts.code is 'Stable URL-safe slug of the district name without diacritics, for example ''stare-miasto''. Unique. Use it in APIs and links.';
comment on column krakow.districts.name_pl is 'District name in Polish. A proper noun, never translated.';
comment on column krakow.districts.name_en is 'District name in English. Equal to name_pl because proper nouns are not translated.';
comment on column krakow.districts.boundary is 'District boundary as a PostGIS MultiPolygon in EPSG:4326 (lon/lat), from OpenStreetMap admin_level=9.';
comment on column krakow.districts.area_km2 is 'District area in square kilometres, computed from the boundary in EPSG:2180 (Polish national grid).';
comment on column krakow.districts.source is 'Where the boundary comes from (''OpenStreetMap'').';
comment on column krakow.districts.as_of_date is 'Date the boundary was downloaded.';
comment on column krakow.districts.created_at is 'Row creation time.';

comment on table krakow.metric_definitions is 'The metric catalogue: what each metric_key means, in English and Polish, its unit, whether a higher value is better, and how often it refreshes. Drives labels, scoring direction and the API''s metric list. Identical in both cities; a metric may have no data in one of them.';
comment on column krakow.metric_definitions.metric_key is 'Stable identifier of the metric, for example ''sale_price_median_m2''. Primary key; referenced by district_metrics.';
comment on column krakow.metric_definitions.category is 'Group: transport, demographics, livability, amenities, environment, cost or safety.';
comment on column krakow.metric_definitions.label_en is 'Short English label shown in the interface.';
comment on column krakow.metric_definitions.label_pl is 'Short Polish label shown in the interface (needs native-speaker review).';
comment on column krakow.metric_definitions.description_en is 'One or two English sentences defining the metric, its source and its main limit.';
comment on column krakow.metric_definitions.description_pl is 'The same description in Polish (needs native-speaker review).';
comment on column krakow.metric_definitions.unit is 'Unit key such as ''PLN/m²'', ''% of district'' or ''per km²''. Display forms are in the glossary (pipeline/glossary.py).';
comment on column krakow.metric_definitions.higher_is is '''better'', ''worse'' or ''neutral'': the direction used by the livability score. Neutral metrics are shown but never scored.';
comment on column krakow.metric_definitions.refresh_cadence is '''weekly'' (traffic, air quality) or ''static'' (refreshed by hand every 3-4 months).';
comment on column krakow.metric_definitions.default_data_kind is 'The usual data_kind of the metric: observed, estimated or proxy. A row may deviate; see district_metrics.data_kind.';
comment on column krakow.metric_definitions.sort_order is 'Display order within the catalogue.';

comment on table krakow.district_metrics is 'One value per district, metric and as-of date, with full provenance. The core table the API reads: value_num for scoring and sorting, value_en and value_pl as ready-made display strings, plus source, licence, attribution, method and caveats.';
comment on column krakow.district_metrics.id is 'Surrogate key.';
comment on column krakow.district_metrics.district_id is 'The district (districts.id). Rows are deleted with their district.';
comment on column krakow.district_metrics.metric_key is 'The metric (metric_definitions.metric_key).';
comment on column krakow.district_metrics.value_num is 'The numeric value, in the unit of the metric. Used for scoring, sorting and colouring maps.';
comment on column krakow.district_metrics.value_en is 'Cached English display string, for example ''12,346 PLN/m²''. Read directly; never format or translate at request time.';
comment on column krakow.district_metrics.value_pl is 'Cached Polish display string, for example ''12 346 PLN/m²''.';
comment on column krakow.district_metrics.unit is 'Unit key of this row (falls back to the catalogue unit).';
comment on column krakow.district_metrics.as_of_date is 'The date the value describes or was collected (for example 2024-12-31 for a year-end statistic, or the snapshot date for listings).';
comment on column krakow.district_metrics.source is 'Human-readable source name, for example ''Rejestr Cen Nieruchomości''.';
comment on column krakow.district_metrics.source_url is 'Endpoint or page the data came from.';
comment on column krakow.district_metrics.licence is 'Licence or terms of use of the source. Must be shown or respected when the value is displayed.';
comment on column krakow.district_metrics.attribution is 'Credit line the source requires. Show it beside the value.';
comment on column krakow.district_metrics.data_kind is '''observed'' (measured or officially reported), ''estimated'' (calculated from real inputs, for example interpolated between stations) or ''proxy'' (an indirect indicator). Show it in the interface.';
comment on column krakow.district_metrics.method is 'How the value was computed, in English. Empty for plain observed values. The Polish version is in translation_cache.';
comment on column krakow.district_metrics.coverage_note is 'Caveats to show beside the value, in English (for example ''Recorded crimes, not risk''). The Polish version is in translation_cache.';
comment on column krakow.district_metrics.n_obs is 'Sample size behind the value: transactions, listings, stations, pixels or metrics used. Small values mean low confidence.';
comment on column krakow.district_metrics.fetched_at is 'When the row was written.';

comment on table krakow.district_reports is 'Pre-generated area report per district and language: a short text narrating the district''s metrics, written natively in English and in Polish. Generated at ingestion and cached; never produced at request time.';
comment on column krakow.district_reports.district_id is 'The district (districts.id).';
comment on column krakow.district_reports.locale is '''en'' or ''pl''. Primary key together with district_id.';
comment on column krakow.district_reports.body is 'The report text (about 100-140 words). Only cites supplied figures, flags estimated and proxy values and makes no safety verdict.';
comment on column krakow.district_reports.livability_score is 'The default livability score (0-100, relative to the other districts of the same city) that the report is based on. Used to detect stale reports.';
comment on column krakow.district_reports.model is 'The model that wrote the text, or ''template'' for the deterministic fallback.';
comment on column krakow.district_reports.data_version is 'Short hash of the facts the report was built from.';
comment on column krakow.district_reports.generated_at is 'When the report was stored.';

comment on table krakow.glossary is 'Fixed vocabulary that must never be machine-translated inconsistently: metric labels, units and data-kind terms in both languages. Synced from the catalogue and pipeline/glossary.py.';
comment on column krakow.glossary.term_pl is 'Polish term.';
comment on column krakow.glossary.term_en is 'English term.';
comment on column krakow.glossary.kind is '''metric label'', ''unit'' or ''data kind''.';
comment on column krakow.glossary.note is 'Optional remark for translators.';

comment on table krakow.translation_cache is 'Content-hash cache of machine translations of the free-text notes (method, coverage_note) so unchanged text is never sent twice. The backend reads the Polish note by looking up source_text with target_lang = ''pl''.';
comment on column krakow.translation_cache.cache_key is 'sha256 of text, languages, glossary version and engine/model. Primary key.';
comment on column krakow.translation_cache.source_lang is 'Language of source_text (''en'').';
comment on column krakow.translation_cache.target_lang is 'Language of translated_text (''pl'').';
comment on column krakow.translation_cache.source_text is 'The original text, exactly as stored in district_metrics.method or coverage_note.';
comment on column krakow.translation_cache.translated_text is 'The translation, with fixed terminology enforced and Polish number formats.';
comment on column krakow.translation_cache.engine is 'Engine that produced it (''openrouter'' or ''libretranslate'').';
comment on column krakow.translation_cache.model is 'Model name for LLM engines.';
comment on column krakow.translation_cache.glossary_version is 'Version of the glossary used; part of the cache key.';
comment on column krakow.translation_cache.created_at is 'When the translation was stored.';

comment on table krakow.ingestion_runs is 'Log of every retrieval or ETL run for provenance and debugging: which source, when, how many rows and which code version.';
comment on column krakow.ingestion_runs.id is 'Surrogate key.';
comment on column krakow.ingestion_runs.source is 'Name of the run, for example ''gtfs'' or ''rcn''.';
comment on column krakow.ingestion_runs.status is '''running'', ''ok'' or ''failed''.';
comment on column krakow.ingestion_runs.started_at is 'Start time.';
comment on column krakow.ingestion_runs.finished_at is 'End time.';
comment on column krakow.ingestion_runs.rows_written is 'Number of metric rows written.';
comment on column krakow.ingestion_runs.git_sha is 'Short commit hash of the code that ran.';
comment on column krakow.ingestion_runs.notes is 'Error message for failed runs.';
