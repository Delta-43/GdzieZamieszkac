-- City schema: krakow. Identical in warsaw/0017_city_series.sql apart from the schema name.
-- Adds city_series (city-level quarterly history, for the price outlook context). Additive only.

create table if not exists krakow.city_series (
  metric_key   text not null,
  period_start date not null,
  period_end   date not null,
  value_num    double precision not null,
  value_en     text,
  value_pl     text,
  data_kind    text not null default 'observed' check (data_kind in ('observed','estimated','proxy')),
  method       text,
  source       text,
  source_url   text,
  licence      text,
  attribution  text,
  fetched_at   timestamptz not null default now(),
  primary key (metric_key, period_start)
);
comment on table krakow.city_series is 'City-level history of one measure, one row per period. Used as context for the price outlook; it is not a district value and not part of the livability score.';
comment on column krakow.city_series.metric_key is 'Name of the measure, for example nbp_secondary_transaction_price_m2. Not a key of metric_definitions.';
comment on column krakow.city_series.period_start is 'First day of the period (for NBP data, the start of the survey quarter).';
comment on column krakow.city_series.period_end is 'Last day of the period.';
comment on column krakow.city_series.value_num is 'The value for the period, in the unit named in the method text.';
comment on column krakow.city_series.value_en is 'Display string in English, formatted at load time.';
comment on column krakow.city_series.value_pl is 'Display string in Polish, formatted at load time.';
comment on column krakow.city_series.data_kind is 'observed, estimated or proxy.';
comment on column krakow.city_series.method is 'What the measure is and how the source computes it.';
comment on column krakow.city_series.source is 'Name of the source.';
comment on column krakow.city_series.source_url is 'Where the source data comes from.';
comment on column krakow.city_series.licence is 'Licence or terms of use of the source.';
comment on column krakow.city_series.attribution is 'Credit line the source requires.';
comment on column krakow.city_series.fetched_at is 'When the row was last written.';

alter table krakow.city_series enable row level security;
grant select on krakow.city_series to api_reader, alex_reviewer;
create policy api_reader_select on krakow.city_series for select to api_reader using (true);
create policy alex_reviewer_select on krakow.city_series for select to alex_reviewer using (true);

drop trigger if exists guard_no_delete on krakow.city_series;
create trigger guard_no_delete before delete on krakow.city_series for each row execute function krakow.guard_destructive();
drop trigger if exists guard_no_truncate on krakow.city_series;
create trigger guard_no_truncate before truncate on krakow.city_series for each statement execute function krakow.guard_destructive();

revoke delete, truncate on krakow.city_series from anon, authenticated;
