-- Data lifecycle: recoverable event deletion, account deletion and one
-- retention sweep.
--
-- Deleting an event used to drop it and its history for good, leaving only a
-- server log line. Now delete_event first copies the event, its activity and
-- its caption versions into deleted_events, so a mistaken delete can be undone
-- with restore_deleted_event for 30 days (Undo / Recently deleted in the app). After that prune_expired_data
-- removes the copy, so the requester's name and contact don't outlive the
-- delete indefinitely (RA 10173).
--
-- prune_expired_data also takes over the sign-in and rate-limit cleanup the
-- app used to run as two separate deletes, and the indexes below let those
-- deletes find old rows without scanning the whole table.

-- ===================================================================
-- Deleted events (kept 30 days)
-- ===================================================================
create table deleted_events (
  event_id      uuid primary key,
  title         text not null,
  deleted_by_id uuid not null references staff (id) on delete restrict,
  deleted_at    timestamptz not null default now(),
  event         jsonb not null,  -- the events row as it was
  activity      jsonb not null,  -- its event_activity rows, oldest first
  captions      jsonb not null   -- its caption_revisions rows, oldest first
);
create index deleted_events_deleted_at_idx on deleted_events (deleted_at);

alter table deleted_events enable row level security;
-- Written and cleared only by the functions below; the app may read it.
revoke all on deleted_events from anon, authenticated, service_role;
grant select on deleted_events to service_role;

-- ===================================================================
-- Delete (head only, now checked here too)
-- ===================================================================
drop function delete_event(uuid, integer);

-- Same as before, plus: the deleter must be an active head, and the event is
-- copied to deleted_events in the same transaction as the delete.
create function delete_event(p_event_id uuid, p_expected_version integer, p_deleted_by uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  cur events;
begin
  if not exists (
    select 1 from staff where id = p_deleted_by and active and 'head' = any (roles)
  ) then
    raise exception 'forbidden' using errcode = 'PT403';
  end if;

  select * into cur from events where id = p_event_id for update;
  if not found then
    raise exception 'event_not_found' using errcode = 'PT404';
  end if;
  if p_expected_version is null or cur.version <> p_expected_version then
    raise exception 'version_conflict' using errcode = 'PT409';
  end if;

  insert into deleted_events (event_id, title, deleted_by_id, event, activity, captions)
  values (
    cur.id, cur.title, p_deleted_by, to_jsonb(cur),
    coalesce((select jsonb_agg(to_jsonb(a) order by a.id) from event_activity a where a.event_id = cur.id), '[]'),
    coalesce((select jsonb_agg(to_jsonb(c) order by c.id) from caption_revisions c where c.event_id = cur.id), '[]'));

  perform set_config('pio.deleting_event', p_event_id::text, true);
  delete from event_activity where event_id = p_event_id;
  delete from events where id = p_event_id;  -- caption_revisions cascade
  perform set_config('pio.deleting_event', '', true);
end
$$;

revoke all on function delete_event(uuid, integer, uuid) from anon, authenticated, public;
grant execute on function delete_event(uuid, integer, uuid) to service_role;

-- ===================================================================
-- Restore (head only)
-- ===================================================================

-- Put a deleted event back with its original id, history and caption
-- versions, and log which head restored it.
create function restore_deleted_event(p_event_id uuid, p_restored_by uuid) returns events
language plpgsql security definer set search_path = public as $$
declare
  d deleted_events;
  r events;
begin
  if not exists (
    select 1 from staff where id = p_restored_by and active and 'head' = any (roles)
  ) then
    raise exception 'forbidden' using errcode = 'PT403';
  end if;

  select * into d from deleted_events where event_id = p_event_id for update;
  if not found then
    raise exception 'deleted_event_not_found' using errcode = 'PT404';
  end if;
  if exists (select 1 from events where id = p_event_id) then
    raise exception 'event_exists' using errcode = 'PT409';
  end if;

  r := jsonb_populate_record(null::events, d.event);
  -- Bump the version like every other change, so the restore is its own step.
  insert into events (
    id, title, event_date, start_time, venue, municipality, source, requested_by,
    contact, notes, status, cancelled_from_status, photographer_id, videographer_id,
    editor_id, writer_id, proofreader_id, approved_by_id, coverage_confirmed, photos_done,
    caption_done, drive_folder_url, caption_text, scheduled_post_at, posted_at,
    post_link, version, created_by_id, created_at, updated_at)
  values (
    r.id, r.title, r.event_date, r.start_time, r.venue, r.municipality, r.source, r.requested_by,
    r.contact, r.notes, r.status, r.cancelled_from_status, r.photographer_id, r.videographer_id,
    r.editor_id, r.writer_id, r.proofreader_id, r.approved_by_id, r.coverage_confirmed, r.photos_done,
    r.caption_done, r.drive_folder_url, r.caption_text, r.scheduled_post_at, r.posted_at,
    r.post_link, r.version + 1, r.created_by_id, r.created_at, now())
  returning * into r;

  insert into event_activity (id, event_id, actor_id, action, from_status, to_status, details, created_at)
  overriding system value
  select a.id, a.event_id, a.actor_id, a.action, a.from_status, a.to_status, a.details, a.created_at
  from jsonb_populate_recordset(null::event_activity, d.activity) as a;

  insert into caption_revisions (id, event_id, author_id, body, created_at)
  overriding system value
  select c.id, c.event_id, c.author_id, c.body, c.created_at
  from jsonb_populate_recordset(null::caption_revisions, d.captions) as c;

  perform insert_activity(r.id, jsonb_build_array(jsonb_build_object(
    'actor_id', p_restored_by, 'action', 'undelete',
    'from_status', null, 'to_status', r.status,
    'details', jsonb_build_object('deleted_at', d.deleted_at, 'deleted_by_id', d.deleted_by_id))));

  delete from deleted_events where event_id = p_event_id;
  return r;
end
$$;

revoke all on function restore_deleted_event(uuid, uuid) from anon, authenticated, public;
grant execute on function restore_deleted_event(uuid, uuid) to service_role;

-- ===================================================================
-- Account deletion (head only)
-- ===================================================================

-- Staff whose id appears anywhere in the record. Their accounts can only be
-- deactivated, never deleted, so reports and history keep their names.
create function staff_with_history() returns setof uuid
language sql stable security definer set search_path = public as $$
  select s.id from staff s
  where exists (select 1 from events e where s.id in (
          e.photographer_id, e.videographer_id, e.editor_id, e.writer_id,
          e.proofreader_id, e.approved_by_id, e.created_by_id))
     or exists (select 1 from event_activity a where a.actor_id = s.id)
     or exists (select 1 from caption_revisions c where c.author_id = s.id)
     -- Any mention in a deleted event's copy, so restoring it never meets a
     -- missing staff id.
     or exists (select 1 from deleted_events d where d.deleted_by_id = s.id
                  or position(s.id::text in d.event::text || d.activity::text || d.captions::text) > 0);
$$;

-- Permanently remove an account added by mistake: it must already be
-- deactivated, must not be the caller's own, and must have no history.
-- Sign-in attempts go with it (cascade); lock clears it made keep the row
-- with cleared_by_id set to null.
create function delete_staff(p_staff_id uuid, p_deleted_by uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  target staff;
begin
  if not exists (
    select 1 from staff where id = p_deleted_by and active and 'head' = any (roles)
  ) then
    raise exception 'forbidden' using errcode = 'PT403';
  end if;
  if p_staff_id = p_deleted_by then
    raise exception 'cannot_delete_self' using errcode = 'PT422';
  end if;

  select * into target from staff where id = p_staff_id for update;
  if not found then
    raise exception 'staff_not_found' using errcode = 'PT404';
  end if;
  if target.active then
    raise exception 'still_active' using errcode = 'PT409';
  end if;
  if p_staff_id in (select staff_with_history()) then
    raise exception 'has_history' using errcode = 'PT409';
  end if;

  delete from staff where id = p_staff_id;
end
$$;

revoke all on function staff_with_history() from anon, authenticated, public;
revoke all on function delete_staff(uuid, uuid) from anon, authenticated, public;
grant execute on function staff_with_history() to service_role;
grant execute on function delete_staff(uuid, uuid) to service_role;

-- ===================================================================
-- Retention
-- ===================================================================
create index pin_attempts_created_idx    on pin_attempts (created_at);
create index rate_limit_hits_created_idx on rate_limit_hits (created_at);

-- Drop sign-in attempts after 30 days, rate-limit hits after 2 days and
-- deleted events after 30 days. Returns how many rows each step removed.
create function prune_expired_data() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  n_attempts integer;
  n_hits     integer;
  n_deleted  integer;
begin
  delete from pin_attempts    where created_at < now() - interval '30 days';
  get diagnostics n_attempts = row_count;
  delete from rate_limit_hits where created_at < now() - interval '2 days';
  get diagnostics n_hits = row_count;
  delete from deleted_events  where deleted_at < now() - interval '30 days';
  get diagnostics n_deleted = row_count;
  return jsonb_build_object('pin_attempts', n_attempts, 'rate_limit_hits', n_hits, 'deleted_events', n_deleted);
end
$$;

revoke all on function prune_expired_data() from anon, authenticated, public;
grant execute on function prune_expired_data() to service_role;
