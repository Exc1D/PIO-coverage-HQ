-- Caption review: every saved version of an event's caption, so a
-- proofreader can see exactly what the writer changed since the last read
-- (and the writer can see the proofreader's corrections).
--
-- Rows are written only by apply_event_change, in the same transaction as
-- the change itself. They go with their event when it is deleted (cascade);
-- the audit trail of who changed the caption stays in event_activity.

create table caption_revisions (
  id         bigint generated always as identity primary key,
  event_id   uuid not null references events (id) on delete cascade,
  author_id  uuid references staff (id) on delete restrict,  -- null = from before this migration
  body       text check (char_length(body) <= 20000),        -- null = caption cleared
  created_at timestamptz not null default now()
);
create index caption_revisions_event_idx on caption_revisions (event_id, created_at desc, id desc);

alter table caption_revisions enable row level security;
revoke all on caption_revisions from anon, authenticated;
grant select, insert on caption_revisions to service_role;

-- Start each existing caption's history with what is there now.
insert into caption_revisions (event_id, author_id, body, created_at)
select id, writer_id, caption_text, updated_at from events where caption_text is not null;

-- Same as before, plus the caption_revisions insert. Same signature, so
-- existing grants carry over.
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
