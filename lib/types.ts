import type { Coverage, Municipality, Role, Source, Status } from "./constants";

/** A row of `events` as returned by the database (timestamps as ISO strings). */
export type EventRow = {
  id: string;
  title: string;
  event_date: string; // yyyy-MM-dd (Manila calendar date)
  start_time: string | null; // HH:mm[:ss]
  venue: string | null;
  municipality: Municipality | null;
  source: Source | null;
  coverage: Coverage;
  requested_by: string | null;
  contact: string | null;
  notes: string | null;
  status: Status;
  cancelled_from_status: Status | null;
  photographer_id: string | null;
  videographer_id: string | null;
  editor_id: string | null;
  writer_id: string | null;
  proofreader_id: string | null;
  cameraman_id: string | null;
  obs_tech_id: string | null;
  approved_by_id: string | null;
  coverage_confirmed: boolean;
  photos_done: boolean;
  caption_done: boolean;
  drive_folder_url: string | null;
  caption_text: string | null;
  scheduled_post_at: string | null;
  posted_at: string | null;
  post_link: string | null;
  due_date: string; // yyyy-MM-dd, generated: event_date + 2
  version: number;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
};

/** Staff as exposed to app code. Never includes pin_hash. */
export type Staff = {
  id: string;
  full_name: string;
  display_name: string;
  roles: Role[];
  active: boolean;
};

export type ActivityRow = {
  id: number;
  event_id: string;
  actor_id: string | null;
  action: string;
  from_status: Status | null;
  to_status: Status | null;
  details: Record<string, unknown>;
  created_at: string;
};

/** One saved version of an event's caption (newest first when listed). */
export type CaptionRevision = {
  id: number;
  event_id: string;
  author_id: string | null;
  body: string | null;
  created_at: string;
};

/** A deleted event's copy, kept 30 days so it can be restored. */
export type DeletedEvent = {
  event_id: string;
  title: string;
  event_date: string; // yyyy-MM-dd
  status: Status;
  deleted_by_id: string;
  deleted_at: string;
};

/** An unfinished event someone is assigned to (shown before deactivating them). */
export type OpenAssignment = { id: string; title: string; event_date: string };
