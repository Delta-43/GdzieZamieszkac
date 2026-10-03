-- Read access for the backend role (created in shared/0012_api_reader_role.sql). Row Level Security stays on with no policy for anon or authenticated;
-- the only policies below are for api_reader. The glossary and audit_log are not needed by the API and are not granted.
grant select on krakow.districts, krakow.district_metrics, krakow.district_reports, krakow.metric_definitions, krakow.translation_cache, krakow.ingestion_runs to api_reader;
create policy api_reader_select on krakow.districts for select to api_reader using (true);
create policy api_reader_select on krakow.district_metrics for select to api_reader using (true);
create policy api_reader_select on krakow.district_reports for select to api_reader using (true);
create policy api_reader_select on krakow.metric_definitions for select to api_reader using (true);
create policy api_reader_select on krakow.translation_cache for select to api_reader using (true);
create policy api_reader_select on krakow.ingestion_runs for select to api_reader using (true);
