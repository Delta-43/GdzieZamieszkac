-- City schema: krakow. Keep structurally identical to warsaw/0001_init.sql: any change here must be
-- mirrored there in the same PR. See AGENTS.md: the schema is the city boundary.
create schema if not exists krakow;

-- Districts (dzielnice). Names are proper nouns: name_en normally equals name_pl.
create table krakow.districts (
  id           integer generated always as identity primary key,
  code         text not null unique,                    -- stable slug, e.g. 'stare-miasto'
  name_pl      text not null,
  name_en      text not null,
  boundary     extensions.geometry(MultiPolygon, 4326),
  area_km2     numeric(10, 3),
  source       text,
  as_of_date   date,
  created_at   timestamptz not null default now()
);
create index districts_boundary_gix on krakow.districts using gist (boundary);

-- What each metric is. Drives scoring direction, UI labels and refresh cadence.
create table krakow.metric_definitions (
  metric_key        text primary key,
  category          text not null check (category in
                      ('transport','demographics','livability','amenities','environment','cost','safety')),
  label_en          text not null,
  label_pl          text not null,
  description_en    text,
  description_pl    text,
  unit              text,
  higher_is         text not null default 'neutral' check (higher_is in ('better','worse','neutral')),
  refresh_cadence   text not null default 'static' check (refresh_cadence in ('weekly','static')),
  default_data_kind text not null default 'observed' check (default_data_kind in ('observed','estimated','proxy')),
  sort_order        integer not null default 0
);

-- One row per district, metric and as-of date. value_num drives scoring; value_en/value_pl are the
-- cached display strings (AGENTS.md: never translate at request time).
create table krakow.district_metrics (
  id             bigint generated always as identity primary key,
  district_id    integer not null references krakow.districts(id) on delete cascade,
  metric_key     text not null references krakow.metric_definitions(metric_key),
  value_num      double precision,
  value_en       text,
  value_pl       text,
  unit           text,
  as_of_date     date not null,
  source         text not null,
  source_url     text,
  licence        text,
  attribution    text,
  data_kind      text not null default 'observed' check (data_kind in ('observed','estimated','proxy')),
  method         text,                                  -- formula/method reference for estimated and proxy values
  coverage_note  text,                                  -- caveats to show beside the value
  n_obs          integer,                               -- sample size, station count, listings, etc.
  fetched_at     timestamptz not null default now(),
  unique (district_id, metric_key, as_of_date)
);
create index district_metrics_metric_idx on krakow.district_metrics (metric_key, as_of_date desc);

-- Cached AI area reports, written natively in each language (AGENTS.md).
create table krakow.district_reports (
  district_id    integer not null references krakow.districts(id) on delete cascade,
  locale         text not null check (locale in ('en','pl')),
  body           text not null,
  livability_score numeric(5, 2),
  model          text not null,
  data_version   text not null,
  generated_at   timestamptz not null default now(),
  primary key (district_id, locale)
);

-- Manual glossary: overrides machine translation for fixed vocabulary.
create table krakow.glossary (
  term_pl    text not null,
  term_en    text not null,
  kind       text not null default 'label',
  note       text,
  primary key (term_pl, term_en)
);

-- Content-hash translation cache (AGENTS.md: never send unchanged text twice).
create table krakow.translation_cache (
  cache_key        text primary key,                    -- sha256 of text|src|tgt|glossary_version|engine
  source_lang      text not null,
  target_lang      text not null,
  source_text      text not null,
  translated_text  text not null,
  engine           text not null,
  model            text,
  glossary_version text,
  created_at       timestamptz not null default now()
);

-- Log of every retrieval/ETL run, for provenance and debugging.
create table krakow.ingestion_runs (
  id            bigint generated always as identity primary key,
  source        text not null,
  status        text not null default 'running' check (status in ('running','ok','failed')),
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  rows_written  integer,
  git_sha       text,
  notes         text
);

-- Access: only the backend (service_role) and postgres touch these. RLS on, no public policies.
alter table krakow.districts          enable row level security;
alter table krakow.metric_definitions enable row level security;
alter table krakow.district_metrics   enable row level security;
alter table krakow.district_reports   enable row level security;
alter table krakow.glossary           enable row level security;
alter table krakow.translation_cache  enable row level security;
alter table krakow.ingestion_runs     enable row level security;

grant usage on schema krakow to service_role;
grant all on all tables in schema krakow to service_role;
grant all on all sequences in schema krakow to service_role;
alter default privileges in schema krakow grant all on tables to service_role;
alter default privileges in schema krakow grant all on sequences to service_role;
