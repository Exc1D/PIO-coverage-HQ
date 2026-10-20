-- PIO Coverage HQ: initial schema
-- All reads and writes go through server code with the service-role key.
-- RLS is enabled on every table with no policies, and anon/authenticated
-- roles are stripped of privileges, so the public API key can read nothing.

-- ===================================================================
-- Enums
-- ===================================================================
create type event_status as enum (
  'requested',
  'scheduled',
  'covered',
  'in_production',
  'for_proofreading',
  'approved',
  'scheduled_for_posting',
  'posted',
  'cancelled'
);

create type event_source as enum (
  'provincial_government',
  'other_lgu',
  'community',
  'private'
);

-- Display labels live in lib/constants.ts
create type municipality as enum (
  'basud',
  'capalonga',
  'daet',
  'jose_panganiban',
  'labo',
  'mercedes',
  'paracale',
  'san_lorenzo_ruiz',
  'san_vicente',
  'santa_elena',
  'talisay',
  'vinzons'
);

-- ===================================================================
-- Staff
-- ===================================================================
create table staff (
  id              uuid primary key default gen_random_uuid(),
  full_name       text not null check (char_length(full_name) between 1 and 120),
  display_name    text not null unique check (char_length(display_name) between 1 and 40),
  roles           text[] not null default '{}'
                  check (roles <@ array['head', 'photographer', 'videographer',
                                        'writer', 'proofreader', 'page_admin']::text[]),
  pin_hash        text not null,
  active          boolean not null default true,
  -- Bumped on PIN reset / deactivation to revoke existing sessions.
  session_version integer not null default 1,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ===================================================================
-- Events
-- ===================================================================
create table events (
  id                    uuid primary key default gen_random_uuid(),
  title                 text not null check (char_length(title) between 1 and 200),
  event_date            date not null,
  start_time            time,
  venue                 text check (char_length(venue) <= 200),
  -- Nullable so the head can log a placeholder; required before scheduling.
  municipality          municipality,
  source                event_source,
  requested_by          text check (char_length(requested_by) <= 120),
  contact               text check (char_length(contact) <= 120),
  notes                 text check (char_length(notes) <= 2000),

  status                event_status not null default 'requested',
  -- Remembered so the head can restore a cancelled event.
  cancelled_from_status event_status,

  photographer_id       uuid references staff (id) on delete restrict,
  videographer_id       uuid references staff (id) on delete restrict,
  writer_id             uuid references staff (id) on delete restrict,
  proofreader_id        uuid references staff (id) on delete restrict,
  approved_by_id        uuid references staff (id) on delete restrict,

  -- Head's sign-off that coverage happened (replaces Drive link as proof).
  coverage_confirmed    boolean not null default false,
  photos_done           boolean not null default false,
  caption_done          boolean not null default false,

  -- Optional references; not required by any workflow rule.
  drive_folder_url      text check (drive_folder_url ~* '^https://'),
  caption_text          text check (char_length(caption_text) <= 20000),

  scheduled_post_at     timestamptz,
  posted_at             timestamptz,
  post_link             text check (
                          post_link is null
                          or post_link ~* '^https://((www|m|web|business|mbasic)\.)?(facebook\.com|fb\.watch)/'),

  due_date              date generated always as (event_date + 2) stored,

  version               integer not null default 1,
  created_by_id         uuid references staff (id) on delete restrict,  -- null = public request
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- Safety net behind lib/workflow.ts
  constraint scheduled_needs_fields check (
    status in ('requested', 'cancelled') or (source is not null and municipality is not null)),
  constraint covered_needs_confirmation check (
    status not in ('covered', 'in_production', 'for_proofreading', 'approved',
                   'scheduled_for_posting', 'posted')
    or coverage_confirmed),
  constraint sfp_needs_time check (
    status not in ('scheduled_for_posting', 'posted') or scheduled_post_at is not null),
  constraint posted_needs_link check (
    status <> 'posted' or (post_link is not null and posted_at is not null)),
  constraint cancelled_has_origin check (
    (status = 'cancelled') = (cancelled_from_status is not null)),
  constraint cancelled_origin_not_terminal check (
    cancelled_from_status is null or cancelled_from_status not in ('posted', 'cancelled'))
);

create index events_status_idx     on events (status);
create index events_event_date_idx on events (event_date);
create index events_posted_at_idx  on events (posted_at) where status = 'posted';
create index events_due_idx        on events (due_date) where status not in ('posted', 'cancelled');

-- ===================================================================
-- Audit log (append-only)
-- ===================================================================
create table event_activity (
  id          bigint generated always as identity primary key,
  event_id    uuid not null references events (id) on delete restrict,
  actor_id    uuid references staff (id) on delete restrict,  -- null = public request
  action      text not null check (char_length(action) between 1 and 64),
  from_status event_status,
  to_status   event_status,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index event_activity_event_idx on event_activity (event_id, created_at desc);

create function forbid_mutation() returns trigger
language plpgsql as $$
begin
  raise exception '% is append-only', tg_table_name;
end
$$;

create trigger event_activity_no_update
  before update or delete on event_activity
  for each row execute function forbid_mutation();
create trigger event_activity_no_truncate
  before truncate on event_activity
  for each statement execute function forbid_mutation();

-- ===================================================================
-- PIN attempts and rate limits
-- ===================================================================
create table pin_attempts (
  id            bigint generated always as identity primary key,
  staff_id      uuid references staff (id) on delete cascade,
  ip_hash       text not null,  -- HMAC-SHA256 of the IP, never the raw address
  success       boolean not null,
  -- Set when the head clears a lockout; such rows reset the failure count.
  cleared_by_id uuid references staff (id) on delete set null,
  created_at    timestamptz not null default now()
);
create index pin_attempts_staff_idx on pin_attempts (staff_id, created_at desc);
create index pin_attempts_ip_idx    on pin_attempts (ip_hash, created_at desc);

create table rate_limit_hits (
  id         bigint generated always as identity primary key,
  bucket     text not null,
  key_hash   text not null,
  created_at timestamptz not null default now()
);
create index rate_limit_hits_idx on rate_limit_hits (bucket, key_hash, created_at desc);

-- ===================================================================
-- updated_at
-- ===================================================================
create function touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create trigger staff_touch before update on staff
  for each row execute function touch_updated_at();
create trigger events_touch before update on events
  for each row execute function touch_updated_at();

-- ===================================================================
-- Atomic write functions
-- Custom SQLSTATEs: PT404 not found, PT409 conflict, PT422 bad input.
-- ===================================================================

-- Insert activity rows from a JSON array of
-- {actor_id, action, from_status, to_status, details}.
create function insert_activity(p_event_id uuid, p_activity jsonb) returns void
language sql set search_path = public as $$
  insert into event_activity (event_id, actor_id, action, from_status, to_status, details)
  select p_event_id,
         nullif(a ->> 'actor_id', '')::uuid,
         a ->> 'action',
         nullif(a ->> 'from_status', '')::event_status,
         nullif(a ->> 'to_status', '')::event_status,
         coalesce(a -> 'details', '{}'::jsonb)
  from jsonb_array_elements(coalesce(p_activity, '[]'::jsonb)) as a;
$$;

-- Lock the row, check the version, apply the patch, log the activity.
create function apply_event_change(
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
    'photographer_id', 'videographer_id', 'writer_id', 'proofreader_id',
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
create function create_event(p_row jsonb, p_activity jsonb) returns events
language plpgsql set search_path = public as $$
declare
  r events;
begin
  r := jsonb_populate_record(null::events, p_row);
  insert into events (
    title, event_date, start_time, venue, municipality, source, requested_by,
    contact, notes, status, cancelled_from_status, photographer_id, videographer_id,
    writer_id, proofreader_id, approved_by_id, coverage_confirmed, photos_done,
    caption_done, drive_folder_url, caption_text, scheduled_post_at, posted_at,
    post_link, created_by_id)
  values (
    r.title, r.event_date, r.start_time, r.venue, r.municipality, r.source, r.requested_by,
    r.contact, r.notes, coalesce(r.status, 'requested'), r.cancelled_from_status,
    r.photographer_id, r.videographer_id, r.writer_id, r.proofreader_id, r.approved_by_id,
    coalesce(r.coverage_confirmed, false), coalesce(r.photos_done, false),
    coalesce(r.caption_done, false), r.drive_folder_url, r.caption_text,
    r.scheduled_post_at, r.posted_at, r.post_link, r.created_by_id)
  returning * into r;

  perform insert_activity(r.id, p_activity);
  return r;
end
$$;

-- First-run setup: create the first head only if no staff exist.
create function create_first_head(
  p_full_name text,
  p_display_name text,
  p_pin_hash text
) returns staff
language plpgsql set search_path = public as $$
declare
  s staff;
begin
  perform pg_advisory_xact_lock(hashtext('pio_first_head'));
  if exists (select 1 from staff) then
    raise exception 'setup_already_done' using errcode = 'PT409';
  end if;
  insert into staff (full_name, display_name, roles, pin_hash)
  values (p_full_name, p_display_name, array['head'], p_pin_hash)
  returning * into s;
  return s;
end
$$;

-- ===================================================================
-- Lockdown
-- ===================================================================
alter table staff           enable row level security;
alter table events          enable row level security;
alter table event_activity  enable row level security;
alter table pin_attempts    enable row level security;
alter table rate_limit_hits enable row level security;

revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated, public;

alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated, public;

grant execute on function insert_activity(uuid, jsonb)                        to service_role;
grant execute on function apply_event_change(uuid, integer, jsonb, jsonb)     to service_role;
grant execute on function create_event(jsonb, jsonb)                          to service_role;
grant execute on function create_first_head(text, text, text)                 to service_role;
