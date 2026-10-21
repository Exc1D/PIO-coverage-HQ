-- Editor role: a coverage role alongside photographer and videographer,
-- and an editor slot on events. Staff already hold several roles (text[]).

alter table staff drop constraint staff_roles_check;
alter table staff add constraint staff_roles_check
  check (roles <@ array['head', 'photographer', 'videographer', 'editor',
                        'writer', 'proofreader', 'page_admin']::text[]);

alter table events add column editor_id uuid references staff (id) on delete restrict;

-- Recreate the write functions so the new column is editable and insertable.
-- Same signatures, so existing grants carry over.
-- Lock the row, check the version, apply the patch, log the activity.
create or replace function apply_event_change(
  p_event_id uuid,
  p_expected_version integer,
  p_patch jsonb,
  p_activity jsonb
) returns events
language plpgsql set search_path = public as $$
declare
  allowed constant text[] := array[
    'title', 'event_date', 'start_time', 'venue', 'municipality', 'source',
    'requested_by', 'contact', 'notes', 'status', 'cancelled_from_status',
    'photographer_id', 'videographer_id', 'editor_id', 'writer_id', 'proofreader_id',
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
    title, event_date, start_time, venue, municipality, source, requested_by,
    contact, notes, status, cancelled_from_status, photographer_id, videographer_id,
    editor_id, writer_id, proofreader_id, approved_by_id, coverage_confirmed, photos_done,
    caption_done, drive_folder_url, caption_text, scheduled_post_at, posted_at,
    post_link, created_by_id)
  values (
    r.title, r.event_date, r.start_time, r.venue, r.municipality, r.source, r.requested_by,
    r.contact, r.notes, coalesce(r.status, 'requested'), r.cancelled_from_status,
    r.photographer_id, r.videographer_id, r.editor_id, r.writer_id, r.proofreader_id, r.approved_by_id,
    coalesce(r.coverage_confirmed, false), coalesce(r.photos_done, false),
    coalesce(r.caption_done, false), r.drive_folder_url, r.caption_text,
    r.scheduled_post_at, r.posted_at, r.post_link, r.created_by_id)
  returning * into r;

  perform insert_activity(r.id, p_activity);
  return r;
end
$$;
