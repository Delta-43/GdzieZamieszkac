-- Attribution in the audit log. Until now `changed_by` was always the database role (postgres), so a change made for a reviewer showed no person.
-- Whoever applies a change on someone's behalf can now name them in the same transaction: set local app.on_behalf_of = 'reviewer';
-- The audit log stays append-only. Rows written before this migration have no value, and the corrections records say who they came from.
alter table krakow.audit_log add column if not exists on_behalf_of text;
comment on column krakow.audit_log.on_behalf_of is 'Person the change is attributed to, for example reviewer. Set by whoever applies the change with set local app.on_behalf_of = ''name'' in the same transaction. Empty when nobody was named.';

create or replace function krakow.audit_row() returns trigger
language plpgsql security definer set search_path = pg_catalog, krakow as $$
declare
  who text := nullif(current_setting('app.on_behalf_of', true), '');
begin
  if tg_op = 'UPDATE' then
    if to_jsonb(old) = to_jsonb(new) then return new; end if;
    insert into krakow.audit_log (table_name, operation, old_row, new_row, on_behalf_of) values (tg_table_name, tg_op, to_jsonb(old), to_jsonb(new), who);
    return new;
  end if;
  insert into krakow.audit_log (table_name, operation, old_row, on_behalf_of) values (tg_table_name, tg_op, to_jsonb(old), who);
  return old;
end $$;
comment on function krakow.audit_row() is 'Trigger function: writes the old and new row of an UPDATE or DELETE to audit_log, with the person named in app.on_behalf_of if any; skips updates that change nothing.';
