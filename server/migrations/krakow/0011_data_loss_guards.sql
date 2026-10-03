-- Data-loss guard, per-city part (identical in krakow and warsaw). Depends on shared/0011_drop_guard.sql only for the drop guard.
--  1. DELETE and TRUNCATE are refused on every table unless:  set local app.allow_destructive = 'on';
--  2. UPDATE and DELETE on the review-relevant tables are recorded in krakow.audit_log (old and new row as JSON), so a bad edit can be reverted.
--  3. anon and authenticated lose DELETE and TRUNCATE.
-- The pipeline only upserts, so none of this changes how loads run.

create table if not exists krakow.audit_log (
  id          bigint generated always as identity primary key,
  changed_at  timestamptz not null default now(),
  table_name  text not null,
  operation   text not null,
  changed_by  text not null default current_user,
  old_row     jsonb,
  new_row     jsonb
);
comment on table krakow.audit_log is 'Append-only history of UPDATE and DELETE on translation_cache, glossary, metric_definitions and district_reports. Use it to revert a bad edit.';
comment on column krakow.audit_log.id is 'Sequential change number.';
comment on column krakow.audit_log.changed_at is 'When the change was committed to the table.';
comment on column krakow.audit_log.table_name is 'Table that was changed, without schema.';
comment on column krakow.audit_log.operation is 'UPDATE or DELETE.';
comment on column krakow.audit_log.changed_by is 'Database role that made the change.';
comment on column krakow.audit_log.old_row is 'The whole row before the change.';
comment on column krakow.audit_log.new_row is 'The whole row after the change (null for DELETE).';
create index if not exists audit_log_table_time_idx on krakow.audit_log (table_name, changed_at desc);
alter table krakow.audit_log enable row level security;

create or replace function krakow.guard_destructive() returns trigger
language plpgsql set search_path = pg_catalog as $$
begin
  if coalesce(current_setting('app.allow_destructive', true), '') = 'on' then
    if tg_op = 'TRUNCATE' then return null; end if;
    return case tg_op when 'DELETE' then old else new end;
  end if;
  raise exception 'Blocked: % on %.% would delete loaded data. If intended, run "set local app.allow_destructive = ''on'';" in the same transaction (and take a backup first).',
    tg_op, tg_table_schema, tg_table_name;
end $$;
comment on function krakow.guard_destructive() is 'Trigger function: refuses DELETE, TRUNCATE (and audit_log UPDATE) unless app.allow_destructive = on.';

create or replace function krakow.audit_row() returns trigger
language plpgsql security definer set search_path = pg_catalog, krakow as $$
begin
  if tg_op = 'UPDATE' then
    if to_jsonb(old) = to_jsonb(new) then return new; end if;
    insert into krakow.audit_log (table_name, operation, old_row, new_row) values (tg_table_name, tg_op, to_jsonb(old), to_jsonb(new));
    return new;
  end if;
  insert into krakow.audit_log (table_name, operation, old_row) values (tg_table_name, tg_op, to_jsonb(old));
  return old;
end $$;
comment on function krakow.audit_row() is 'Trigger function: writes the old and new row of an UPDATE or DELETE to audit_log; skips updates that change nothing.';
revoke all on function krakow.audit_row() from public;

do $$
declare
  t text;
begin
  for t in select unnest(array['district_metrics','district_reports','districts','glossary','ingestion_runs','metric_definitions','translation_cache','audit_log']) loop
    execute format('drop trigger if exists guard_no_delete on krakow.%I', t);
    execute format('create trigger guard_no_delete before delete on krakow.%I for each row execute function krakow.guard_destructive()', t);
    execute format('drop trigger if exists guard_no_truncate on krakow.%I', t);
    execute format('create trigger guard_no_truncate before truncate on krakow.%I for each statement execute function krakow.guard_destructive()', t);
  end loop;
  for t in select unnest(array['district_reports','glossary','metric_definitions','translation_cache']) loop
    execute format('drop trigger if exists audit_changes on krakow.%I', t);
    execute format('create trigger audit_changes after update or delete on krakow.%I for each row execute function krakow.audit_row()', t);
  end loop;
end $$;

drop trigger if exists guard_no_update on krakow.audit_log;
create trigger guard_no_update before update on krakow.audit_log for each row execute function krakow.guard_destructive();

revoke delete, truncate on all tables in schema krakow from anon, authenticated;
