// Human-readable descriptions of event_activity rows.

import { SLOT_LABELS, SLOTS, STATUS_LABELS, type Slot, type Status } from "./constants";
import type { ActivityRow } from "./types";

const FIELD_LABELS: Record<string, string> = {
  title: "title",
  event_date: "event date",
  start_time: "start time",
  venue: "venue",
  municipality: "municipality",
  source: "source",
  coverage: "coverage",
  requested_by: "requester",
  contact: "contact",
  notes: "notes",
  caption_text: "caption text",
  drive_folder_url: "Drive link",
  scheduled_post_at: "posting schedule",
  // Slots cleared when the coverage changes.
  ...Object.fromEntries(SLOTS.map((slot) => [`${slot}_id`, SLOT_LABELS[slot].toLowerCase()])),
};

const TICK_LABELS: Record<string, string> = {
  photos_done: "Photos/Video done",
  caption_done: "Caption done",
};

const s = (v: unknown) => STATUS_LABELS[v as Status] ?? String(v);

export function describeActivity(a: ActivityRow, nameOf: (id: string | null | undefined) => string): string {
  const d = a.details ?? {};
  switch (a.action) {
    case "created":
      return d.public_request ? "Submitted through the public request form" : `Created as ${s(a.to_status)}`;
    case "transition":
      return `Moved to ${s(a.to_status)}`;
    case "auto_advance":
      return d.rule === "work_started"
        ? `Moved to ${s(a.to_status)} automatically (work started)`
        : `Moved to ${s(a.to_status)} automatically (photos and caption done)`;
    case "tick":
      return `${d.value ? "Ticked" : "Unticked"} “${TICK_LABELS[String(d.field)] ?? String(d.field)}”`;
    case "coverage_confirmed":
      return d.value ? "Confirmed coverage" : "Removed the coverage confirmation";
    case "assign": {
      const role = SLOT_LABELS[d.slot as Slot] ?? String(d.slot);
      if (!d.to) return `Unassigned ${role.toLowerCase()} (was ${nameOf(d.from as string)})`;
      return `Assigned ${role.toLowerCase()}: ${nameOf(d.to as string)}`;
    }
    case "edit": {
      const keys = Object.keys((d.changes as Record<string, unknown>) ?? {});
      return `Edited ${keys.map((k) => FIELD_LABELS[k] ?? k).join(", ") || "details"}`;
    }
    case "request_changes":
      return `Requested caption changes; moved back to ${s(a.to_status)}`;
    case "step_back":
      return `Moved back to ${s(a.to_status)}`;
    case "cancel":
      return "Cancelled";
    case "restore":
      return `Restored to ${s(a.to_status)}`;
    case "undelete":
      return "Brought back after being deleted";
    default:
      return a.action.replace(/_/g, " ");
  }
}

/** The free-text reason attached to an activity row, if any. */
export function activityReason(a: ActivityRow): string | null {
  const r = a.details?.reason;
  return typeof r === "string" && r.length > 0 ? r : null;
}

/**
 * The proofreader's caption feedback still waiting on the writer: the latest
 * "request changes" entry, unless "Caption done" was ticked again after it.
 * `activity` is newest first, as getActivity returns it.
 */
export function openCaptionFeedback(activity: readonly ActivityRow[]): ActivityRow | null {
  for (const a of activity) {
    if (a.action === "request_changes") return a;
    if (a.action === "tick" && a.details?.field === "caption_done" && a.details.value === true) return null;
  }
  return null;
}
