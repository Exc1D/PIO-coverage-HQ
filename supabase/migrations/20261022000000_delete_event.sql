-- Permanent event deletion (head only; the app checks the role).
--
-- event_activity stays append-only for everything else. The one exception is
-- delete_event below, which sets a transaction-local flag so forbid_mutation
-- lets it remove the deleted event's own history. The FK stays
-- `on delete restrict`, so a stray `delete from events` still fails.

create or replace function forbid_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- Nested so OLD is only read in the row-level DELETE case (it is unset for
  -- the statement-level TRUNCATE trigger).
  if tg_op = 'DELETE' then
    if current_setting('pio.deleting_event', true) = old.event_id::text then
      return old;
    end if;
  end if;
  raise exception '% is append-only', tg_table_name;
end
$$;

-- Delete one event and its activity in one transaction. The caller passes
-- the version it last saw so an event someone just changed isn't deleted
-- from a stale screen.
create function delete_event(p_event_id uuid, p_expected_version integer) returns void
language plpgsql set search_path = public as $$
declare
  cur events;
begin
  select * into cur from events where id = p_event_id for update;
  if not found then
    raise exception 'event_not_found' using errcode = 'PT404';
  end if;
  if cur.version <> p_expected_version then
    raise exception 'version_conflict' using errcode = 'PT409';
  end if;

  perform set_config('pio.deleting_event', p_event_id::text, true);
  delete from event_activity where event_id = p_event_id;
  delete from events where id = p_event_id;
  perform set_config('pio.deleting_event', '', true);
end
$$;

revoke all on function delete_event(uuid, integer) from anon, authenticated, public;
grant execute on function delete_event(uuid, integer) to service_role;
