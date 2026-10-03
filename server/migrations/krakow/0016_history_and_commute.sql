-- City schema: krakow. Identical in warsaw/0016_history_and_commute.sql apart from the schema name.
-- Adds district_series (quarterly history) and commute_matrix (district to district transit minutes). Additive only.

create table if not exists krakow.district_series (
  district_id  integer not null references krakow.districts(id) on delete cascade,
  metric_key   text not null references krakow.metric_definitions(metric_key),
  period_start date not null,
  period_end   date not null,
  value_num    double precision not null,
  value_en     text,
  value_pl     text,
  n_obs        integer not null,
  data_kind    text not null default 'observed' check (data_kind in ('observed','estimated','proxy')),
  method       text,
  source       text,
  source_url   text,
  licence      text,
  attribution  text,
  fetched_at   timestamptz not null default now(),
  primary key (district_id, metric_key, period_start)
);
comment on table krakow.district_series is 'History of one metric per district, one row per period (a calendar quarter for sale prices). Rows exist only for periods with at least one observation.';
comment on column krakow.district_series.district_id is 'District the value belongs to.';
comment on column krakow.district_series.metric_key is 'Metric in metric_definitions that this history belongs to.';
comment on column krakow.district_series.period_start is 'First day of the period.';
comment on column krakow.district_series.period_end is 'Last day of the period.';
comment on column krakow.district_series.value_num is 'The value for the period, in the unit of the metric.';
comment on column krakow.district_series.value_en is 'Display string in English, formatted at load time.';
comment on column krakow.district_series.value_pl is 'Display string in Polish, formatted at load time.';
comment on column krakow.district_series.n_obs is 'Number of observations (deeds) behind the value; thin periods are flagged by the API.';
comment on column krakow.district_series.data_kind is 'observed, estimated or proxy.';
comment on column krakow.district_series.method is 'How the value was computed, including the filters and the periods left out.';
comment on column krakow.district_series.source is 'Name of the source.';
comment on column krakow.district_series.source_url is 'Where the source data comes from.';
comment on column krakow.district_series.licence is 'Licence or terms of use of the source.';
comment on column krakow.district_series.attribution is 'Credit line the source requires.';
comment on column krakow.district_series.fetched_at is 'When the row was last written.';
create index if not exists district_series_metric_idx on krakow.district_series (metric_key, period_start);

create table if not exists krakow.commute_matrix (
  from_district_id integer not null references krakow.districts(id) on delete cascade,
  to_district_id   integer not null references krakow.districts(id) on delete cascade,
  minutes          double precision,
  method           text,
  computed_at      timestamptz not null default now(),
  primary key (from_district_id, to_district_id)
);
comment on table krakow.commute_matrix is 'Estimated public transport minutes between district centres on one weekday morning. One row per ordered pair.';
comment on column krakow.commute_matrix.from_district_id is 'Origin district.';
comment on column krakow.commute_matrix.to_district_id is 'Destination district.';
comment on column krakow.commute_matrix.minutes is 'Door-to-door minutes including walking; null when no connection was found within the limit.';
comment on column krakow.commute_matrix.method is 'How the minutes were computed (service day, departure times, walking limits).';
comment on column krakow.commute_matrix.computed_at is 'When the matrix was computed.';

alter table krakow.district_series enable row level security;
alter table krakow.commute_matrix enable row level security;

grant select on krakow.district_series, krakow.commute_matrix to api_reader, alex_reviewer;
create policy api_reader_select on krakow.district_series for select to api_reader using (true);
create policy api_reader_select on krakow.commute_matrix for select to api_reader using (true);
create policy alex_reviewer_select on krakow.district_series for select to alex_reviewer using (true);
create policy alex_reviewer_select on krakow.commute_matrix for select to alex_reviewer using (true);

do $$
declare
  t text;
begin
  for t in select unnest(array['district_series','commute_matrix']) loop
    execute format('drop trigger if exists guard_no_delete on krakow.%I', t);
    execute format('create trigger guard_no_delete before delete on krakow.%I for each row execute function krakow.guard_destructive()', t);
    execute format('drop trigger if exists guard_no_truncate on krakow.%I', t);
    execute format('create trigger guard_no_truncate before truncate on krakow.%I for each statement execute function krakow.guard_destructive()', t);
  end loop;
end $$;

revoke delete, truncate on krakow.district_series, krakow.commute_matrix from anon, authenticated;
