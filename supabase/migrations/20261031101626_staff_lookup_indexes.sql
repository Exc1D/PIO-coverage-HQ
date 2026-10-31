-- Indexes for looking up events and history by staff member.
--
-- Used by: My work (events where someone fills any slot), the Staff page's
-- open assignments and staff_with_history(), and the foreign-key checks
-- Postgres runs when delete_staff() removes an account (every column below
-- references staff with ON DELETE RESTRICT, and Postgres doesn't index
-- referencing columns on its own).
--
-- Partial (IS NOT NULL): most events leave most slots empty, so the indexes
-- stay small. An equality lookup (col = id) implies NOT NULL, so the planner
-- can still use them for every query above.

create index events_photographer_idx on events (photographer_id) where photographer_id is not null;
create index events_videographer_idx on events (videographer_id) where videographer_id is not null;
create index events_editor_idx       on events (editor_id)       where editor_id is not null;
create index events_writer_idx       on events (writer_id)       where writer_id is not null;
create index events_proofreader_idx  on events (proofreader_id)  where proofreader_id is not null;
create index events_cameraman_idx    on events (cameraman_id)    where cameraman_id is not null;
create index events_obs_tech_idx     on events (obs_tech_id)     where obs_tech_id is not null;
create index events_approved_by_idx  on events (approved_by_id)  where approved_by_id is not null;
create index events_created_by_idx   on events (created_by_id)   where created_by_id is not null;

-- The activity log is the fastest-growing table.
create index event_activity_actor_idx    on event_activity (actor_id)    where actor_id is not null;
create index caption_revisions_author_idx on caption_revisions (author_id) where author_id is not null;
