-- Live coverage: an event can be livestreamed on the page, covered the usual
-- way (photos, video and an article), or both. A live stream needs a
-- cameraman and an OBS tech, so they get their own roles and event slots.
--
-- A live-only event has no article, so it skips the production steps:
-- requested → scheduled → covered → posted, where the post is the live video.

create type coverage_kind as enum ('regular', 'live', 'live_and_regular');

alter table staff drop constraint staff_roles_check;
alter table staff add constraint staff_roles_check
  check (roles <@ array['head', 'photographer', 'videographer', 'photo_editor', 'video_editor',
                        'graphics', 'writer', 'proofreader', 'page_admin',
                        'cameraman', 'obs_tech']::text[]);

alter table events
  add column coverage     coverage_kind not null default 'regular',
  add column cameraman_id uuid references staff (id) on delete restrict,
  add column obs_tech_id  uuid references staff (id) on delete restrict;

-- A live-only event is posted straight from covered, with no posting schedule.
alter table events drop constraint sfp_needs_time;
alter table events add constraint sfp_needs_time check (
  status not in ('scheduled_for_posting', 'posted') or scheduled_post_at is not null or coverage = 'live');

-- Safety nets behind lib/workflow.ts
alter table events add constraint live_needs_crew check (
  coverage = 'regular' or not coverage_confirmed or (cameraman_id is not null and obs_tech_id is not null));
alter table events add constraint live_only_steps check (
  coverage <> 'live'
  or (status in ('requested', 'scheduled', 'covered', 'posted', 'cancelled')
      and (cancelled_from_status is null or cancelled_from_status in ('requested', 'scheduled', 'covered'))));

-- Recreate the write functions so the new columns are editable and insertable.
-- Same signatures, so existing grants carry over.
create or replace function apply_event_change(
  p_event_id uuid,
  p_expected_version integer,
  p_patch jsonb,
  p_activity jsonb
) returns events
language plpgsql set search_path = public as $$
declare
  allowed constant text[] := array[
    'title', 'event_date', 'start_time', 'venue', 'municipality', 'source', 'coverage',
    'requested_by', 'contact', 'notes', 'status', 'cancelled_from_status',
    'photographer_id', 'videographer_id', 'editor_id', 'writer_id', 'proofreader_id',
    'cameraman_id', 'obs_tech_id',
    'approved_by_id', 'coverage_confirmed', 'photos_done', 'caption_done',
    'drive_folder_url', 'caption_text', 'scheduled_post_at', 'posted_at', 'post_link'];
  bad text[];
  cur events;
  nxt events;
begin
  select array_agg(k) into bad
  from jsonb_object_keys(p_patch) as k
  where k <> all (allowed);
  if bad is not null then
    raise exception 'patch has non-editable fields: %', bad using errcode = 'PT422';
  end if;

  select * into cur from events where id = p_event_id for update;
  if not found then
    raise exception 'event_not_found' using errcode = 'PT404';
  end if;
  if cur.version <> p_expected_version then
    raise exception 'version_conflict' using errcode = 'PT409';
  end if;

  nxt := jsonb_populate_record(cur, p_patch);

  update events set
    title = nxt.title,
    event_date = nxt.event_date,
    start_time = nxt.start_time,
    venue = nxt.venue,
    municipality = nxt.municipality,
    source = nxt.source,
    coverage = nxt.coverage,
    requested_by = nxt.requested_by,
    contact = nxt.contact,
    notes = nxt.notes,
    status = nxt.status,
    cancelled_from_status = nxt.cancelled_from_status,
    photographer_id = nxt.photographer_id,
    videographer_id = nxt.videographer_id,
    editor_id = nxt.editor_id,
    writer_id = nxt.writer_id,
    proofreader_id = nxt.proofreader_id,
    cameraman_id = nxt.cameraman_id,
    obs_tech_id = nxt.obs_tech_id,
    approved_by_id = nxt.approved_by_id,
    coverage_confirmed = nxt.coverage_confirmed,
    photos_done = nxt.photos_done,
    caption_done = nxt.caption_done,
    drive_folder_url = nxt.drive_folder_url,
    caption_text = nxt.caption_text,
    scheduled_post_at = nxt.scheduled_post_at,
    posted_at = nxt.posted_at,
    post_link = nxt.post_link,
    version = cur.version + 1
  where id = p_event_id
  returning * into nxt;

  -- Keep every version of the caption so proofreaders can see what changed.
  -- The author is whoever made this change (the first activity row's actor).
  if nxt.caption_text is distinct from cur.caption_text then
    insert into caption_revisions (event_id, author_id, body)
    values (p_event_id, nullif(p_activity -> 0 ->> 'actor_id', '')::uuid, nxt.caption_text);
  end if;

  perform insert_activity(p_event_id, p_activity);
  return nxt;
end
$$;

-- Insert an event and its 'created' activity in one transaction.
create or replace function create_event(p_row jsonb, p_activity jsonb) returns events
language plpgsql set search_path = public as $$
declare
  r events;
begin
  r := jsonb_populate_record(null::events, p_row);
  insert into events (
    title, event_date, start_time, venue, municipality, source, coverage, requested_by,
    contact, notes, status, cancelled_from_status, photographer_id, videographer_id,
    editor_id, writer_id, proofreader_id, cameraman_id, obs_tech_id, approved_by_id,
    coverage_confirmed, photos_done, caption_done, drive_folder_url, caption_text,
    scheduled_post_at, posted_at, post_link, created_by_id)
  values (
    r.title, r.event_date, r.start_time, r.venue, r.municipality, r.source,
    coalesce(r.coverage, 'regular'), r.requested_by,
    r.contact, r.notes, coalesce(r.status, 'requested'), r.cancelled_from_status,
    r.photographer_id, r.videographer_id, r.editor_id, r.writer_id, r.proofreader_id,
    r.cameraman_id, r.obs_tech_id, r.approved_by_id,
    coalesce(r.coverage_confirmed, false), coalesce(r.photos_done, false),
    coalesce(r.caption_done, false), r.drive_folder_url, r.caption_text,
    r.scheduled_post_at, r.posted_at, r.post_link, r.created_by_id)
  returning * into r;

  perform insert_activity(r.id, p_activity);
  return r;
end
$$;

-- Same as before, with the new columns. Copies deleted before this migration
-- have no coverage and come back as regular.
create or replace function restore_deleted_event(p_event_id uuid, p_restored_by uuid) returns events
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
    id, title, event_date, start_time, venue, municipality, source, coverage, requested_by,
    contact, notes, status, cancelled_from_status, photographer_id, videographer_id,
    editor_id, writer_id, proofreader_id, cameraman_id, obs_tech_id, approved_by_id,
    coverage_confirmed, photos_done, caption_done, drive_folder_url, caption_text,
    scheduled_post_at, posted_at, post_link, version, created_by_id, created_at, updated_at)
  values (
    r.id, r.title, r.event_date, r.start_time, r.venue, r.municipality, r.source,
    coalesce(r.coverage, 'regular'), r.requested_by,
    r.contact, r.notes, r.status, r.cancelled_from_status, r.photographer_id, r.videographer_id,
    r.editor_id, r.writer_id, r.proofreader_id, r.cameraman_id, r.obs_tech_id, r.approved_by_id,
    r.coverage_confirmed, r.photos_done, r.caption_done, r.drive_folder_url, r.caption_text,
    r.scheduled_post_at, r.posted_at, r.post_link, r.version + 1, r.created_by_id, r.created_at, now())
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

-- Same as before, counting the live crew slots too.
create or replace function staff_with_history() returns setof uuid
language sql stable security definer set search_path = public as $$
  select s.id from staff s
  where exists (select 1 from events e where s.id in (
          e.photographer_id, e.videographer_id, e.editor_id, e.writer_id,
          e.proofreader_id, e.cameraman_id, e.obs_tech_id, e.approved_by_id, e.created_by_id))
     or exists (select 1 from event_activity a where a.actor_id = s.id)
     or exists (select 1 from caption_revisions c where c.author_id = s.id)
     -- Any mention in a deleted event's copy, so restoring it never meets a
     -- missing staff id.
     or exists (select 1 from deleted_events d where d.deleted_by_id = s.id
                  or position(s.id::text in d.event::text || d.activity::text || d.captions::text) > 0);
$$;
