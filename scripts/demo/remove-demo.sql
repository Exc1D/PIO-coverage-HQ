-- Removes every demo event added by scripts/demo/demo-sql.ts (titles starting
-- with "[DEMO]"), with its activity, caption versions and deleted copy.
-- Real events and staff are not touched. Run in the Supabase SQL editor.

begin;

do $$
declare
  e record;
begin
  for e in select id from events where title like '[DEMO]%' loop
    -- event_activity is append-only; this is the same escape hatch delete_event() uses.
    perform set_config('pio.deleting_event', e.id::text, true);
    delete from event_activity where event_id = e.id;
    delete from events where id = e.id;  -- caption_revisions cascade
  end loop;
  perform set_config('pio.deleting_event', '', true);
  delete from deleted_events where title like '[DEMO]%';
end
$$;

commit;
