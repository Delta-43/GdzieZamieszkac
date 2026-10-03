-- Read access to every krakow table for the reviewer role (created in shared/0013_reviewer_role.sql). Row Level Security stays on; the only policies are for alex_reviewer.
grant select on krakow.districts, krakow.district_metrics, krakow.district_reports, krakow.metric_definitions, krakow.translation_cache, krakow.ingestion_runs, krakow.glossary, krakow.audit_log to alex_reviewer;
create policy alex_reviewer_select on krakow.districts for select to alex_reviewer using (true);
create policy alex_reviewer_select on krakow.district_metrics for select to alex_reviewer using (true);
create policy alex_reviewer_select on krakow.district_reports for select to alex_reviewer using (true);
create policy alex_reviewer_select on krakow.metric_definitions for select to alex_reviewer using (true);
create policy alex_reviewer_select on krakow.translation_cache for select to alex_reviewer using (true);
create policy alex_reviewer_select on krakow.ingestion_runs for select to alex_reviewer using (true);
create policy alex_reviewer_select on krakow.glossary for select to alex_reviewer using (true);
create policy alex_reviewer_select on krakow.audit_log for select to alex_reviewer using (true);
