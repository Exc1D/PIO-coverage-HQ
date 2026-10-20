// Workflow rules for events. Pure: no I/O, no clock (callers pass `now`).
// The server uses `applyCommand` to enforce every change; the UI uses
// `availability` / `dropCommand` to show only the actions that will succeed.

import {
  PIPELINE,
  STATUS_LABELS,
  type Role,
  type Slot,
  type Status,
} from "./constants";
import type { EventRow } from "./types";
import { isFacebookPostUrl, isHttpsUrl } from "./urls";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WorkflowEvent = Pick<
  EventRow,
  | "title"
  | "event_date"
  | "start_time"
  | "venue"
  | "municipality"
  | "source"
  | "requested_by"
  | "contact"
  | "notes"
  | "status"
  | "cancelled_from_status"
  | "photographer_id"
  | "videographer_id"
  | "writer_id"
  | "proofreader_id"
  | "approved_by_id"
  | "coverage_confirmed"
  | "photos_done"
  | "caption_done"
  | "drive_folder_url"
  | "caption_text"
  | "scheduled_post_at"
  | "posted_at"
  | "post_link"
>;

export type Patch = Partial<WorkflowEvent>;

export type Actor = { id: string; roles: readonly Role[] };

export type Assignee = { id: string; roles: readonly Role[]; active: boolean };

export type EditableDetails = Pick<
  WorkflowEvent,
  | "title"
  | "event_date"
  | "start_time"
  | "venue"
  | "municipality"
  | "source"
  | "requested_by"
  | "contact"
  | "notes"
>;

export type StepBackReset = "caption" | "photos" | "both";

export type Command =
  | { type: "schedule" }
  | { type: "set_coverage_confirmed"; value: boolean }
  | { type: "mark_covered" }
  | { type: "start_production" }
  | { type: "set_photos_done"; value: boolean }
  | { type: "set_caption_done"; value: boolean }
  | { type: "approve" }
  | { type: "schedule_post"; scheduledPostAt: Date }
  | { type: "reschedule_post"; scheduledPostAt: Date }
  | { type: "mark_posted"; postLink: string; postedAt?: Date }
  | { type: "cancel"; reason: string }
  | { type: "restore"; reason: string }
  | { type: "step_back"; reason: string; reset?: StepBackReset }
  | { type: "assign"; slot: Slot; assignee: Assignee | null }
  | { type: "edit_details"; changes: Partial<EditableDetails> }
  | { type: "edit_caption_text"; value: string | null }
  | { type: "edit_drive_link"; value: string | null };

export type CommandType = Command["type"];

export const COMMAND_TYPES: readonly CommandType[] = [
  "schedule",
  "set_coverage_confirmed",
  "mark_covered",
  "start_production",
  "set_photos_done",
  "set_caption_done",
  "approve",
  "schedule_post",
  "reschedule_post",
  "mark_posted",
  "cancel",
  "restore",
  "step_back",
  "assign",
  "edit_details",
  "edit_caption_text",
  "edit_drive_link",
];

export type ActivityEntry = {
  action: string;
  from_status: Status | null;
  to_status: Status | null;
  details: Record<string, unknown>;
};

export type ErrorCode =
  | "wrong_status" // not possible at this stage
  | "forbidden" // actor lacks the role / assignment
  | "requirement" // state prerequisite missing (e.g. coverage not confirmed)
  | "invalid_input" // bad value supplied with the command
  | "no_change"; // command would not change anything

export type Failure = { ok: false; code: ErrorCode; message: string };
export type Success = {
  ok: true;
  patch: Patch;
  next: WorkflowEvent;
  activity: ActivityEntry[];
};
export type Result = Success | Failure;
export type Check = { ok: true } | Failure;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const OK: Check = { ok: true };
const MAX_REASON = 500;
/** Allowed clock skew when checking that posted_at isn't in the future. */
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

const fail = (code: ErrorCode, message: string): Failure => ({ ok: false, code, message });

const isHead = (a: Actor) => a.roles.includes("head");
const hasRole = (a: Actor, r: Role) => a.roles.includes(r);
const isAssignedMedia = (e: WorkflowEvent, a: Actor) =>
  e.photographer_id === a.id || e.videographer_id === a.id;
const isAssignedWriter = (e: WorkflowEvent, a: Actor) => e.writer_id === a.id;

const label = (s: Status) => STATUS_LABELS[s];

function inStatus(e: WorkflowEvent, allowed: readonly Status[], what: string): Check {
  return allowed.includes(e.status)
    ? OK
    : fail("wrong_status", `${what} isn't possible while the event is ${label(e.status)}.`);
}

function notCancelled(e: WorkflowEvent, what: string): Check {
  return e.status === "cancelled"
    ? fail("wrong_status", `${what} isn't possible on a cancelled event. Restore it first.`)
    : OK;
}

const first = (...checks: Array<() => Check>): Check => {
  for (const c of checks) {
    const r = c();
    if (!r.ok) return r;
  }
  return OK;
};

/** The status one step back in the pipeline, or null if there is none. */
export function previousStatus(status: Status): Status | null {
  const i = PIPELINE.indexOf(status);
  return i > 0 ? PIPELINE[i - 1] : null;
}

/** The status one step forward in the pipeline, or null if there is none. */
export function nextStatus(status: Status): Status | null {
  const i = PIPELINE.indexOf(status);
  return i >= 0 && i < PIPELINE.length - 1 ? PIPELINE[i + 1] : null;
}

function cleanReason(reason: string): string | Failure {
  const r = reason.trim();
  if (r.length === 0) return fail("invalid_input", "A reason is required.");
  if (r.length > MAX_REASON) return fail("invalid_input", `Keep the reason under ${MAX_REASON} characters.`);
  return r;
}

// ---------------------------------------------------------------------------
// Guards: status + permission + state prerequisites (no command input)
// ---------------------------------------------------------------------------

const GUARDS: Record<CommandType, (e: WorkflowEvent, a: Actor) => Check> = {
  schedule: (e, a) =>
    first(
      () => inStatus(e, ["requested"], "Scheduling"),
      () => (isHead(a) ? OK : fail("forbidden", "Only the head can schedule an event.")),
      () =>
        e.source && e.municipality
          ? OK
          : fail("requirement", "Set the event source and municipality before scheduling."),
    ),

  set_coverage_confirmed: (e, a) =>
    first(
      () => inStatus(e, ["requested", "scheduled"], "Confirming coverage"),
      () => (isHead(a) ? OK : fail("forbidden", "Only the head can confirm coverage.")),
    ),

  mark_covered: (e, a) =>
    first(
      () => inStatus(e, ["scheduled"], "Marking as covered"),
      () =>
        isHead(a) || isAssignedMedia(e, a)
          ? OK
          : fail("forbidden", "Only the assigned photographer/videographer or the head can mark this covered."),
      () =>
        e.coverage_confirmed
          ? OK
          : fail("requirement", "The head needs to tick “Coverage confirmed” first."),
    ),

  start_production: (e, a) =>
    first(
      () => inStatus(e, ["covered"], "Starting production"),
      () =>
        isHead(a) || isAssignedMedia(e, a) || isAssignedWriter(e, a)
          ? OK
          : fail("forbidden", "Only the assigned team or the head can start production."),
    ),

  set_photos_done: (e, a) =>
    first(
      () => inStatus(e, ["covered", "in_production"], "Changing “Photos/Video done”"),
      () =>
        isHead(a) || isAssignedMedia(e, a)
          ? OK
          : fail("forbidden", "Only the assigned photographer/videographer or the head can tick this."),
    ),

  set_caption_done: (e, a) =>
    first(
      () => inStatus(e, ["scheduled", "covered", "in_production"], "Changing “Caption done”"),
      () =>
        isHead(a) || isAssignedWriter(e, a)
          ? OK
          : fail("forbidden", "Only the assigned writer or the head can tick this."),
    ),

  approve: (e, a) =>
    first(
      () => inStatus(e, ["for_proofreading"], "Approving"),
      () =>
        isHead(a) || hasRole(a, "proofreader")
          ? OK
          : fail("forbidden", "Only a proofreader or the head can approve."),
    ),

  schedule_post: (e, a) =>
    first(
      () => inStatus(e, ["approved"], "Scheduling the post"),
      () =>
        isHead(a) || hasRole(a, "page_admin")
          ? OK
          : fail("forbidden", "Only a page admin or the head can schedule posts."),
    ),

  reschedule_post: (e, a) =>
    first(
      () => inStatus(e, ["scheduled_for_posting"], "Rescheduling the post"),
      () =>
        isHead(a) || hasRole(a, "page_admin")
          ? OK
          : fail("forbidden", "Only a page admin or the head can reschedule posts."),
    ),

  mark_posted: (e, a) =>
    first(
      () => inStatus(e, ["scheduled_for_posting"], "Marking as posted"),
      () =>
        isHead(a) || hasRole(a, "page_admin")
          ? OK
          : fail("forbidden", "Only a page admin or the head can mark posts as published."),
    ),

  cancel: (e, a) =>
    first(
      () =>
        e.status === "posted" || e.status === "cancelled"
          ? fail("wrong_status", `A ${label(e.status).toLowerCase()} event can't be cancelled.`)
          : OK,
      () => (isHead(a) ? OK : fail("forbidden", "Only the head can cancel an event.")),
    ),

  restore: (e, a) =>
    first(
      () => inStatus(e, ["cancelled"], "Restoring"),
      () => (isHead(a) ? OK : fail("forbidden", "Only the head can restore an event.")),
    ),

  step_back: (e, a) =>
    first(
      () =>
        previousStatus(e.status)
          ? OK
          : fail("wrong_status", `There is no earlier step from ${label(e.status)}.`),
      () => (isHead(a) ? OK : fail("forbidden", "Only the head can move an event back a step.")),
    ),

  assign: (e, a) =>
    first(
      () => notCancelled(e, "Assigning"),
      () => (isHead(a) ? OK : fail("forbidden", "Only the head can assign staff.")),
    ),

  edit_details: (e, a) =>
    first(
      () => notCancelled(e, "Editing"),
      () => (isHead(a) ? OK : fail("forbidden", "Only the head can edit event details.")),
    ),

  edit_caption_text: (e, a) =>
    first(
      () => notCancelled(e, "Editing the caption"),
      () =>
        isHead(a) || isAssignedWriter(e, a)
          ? OK
          : fail("forbidden", "Only the assigned writer or the head can edit the caption."),
    ),

  edit_drive_link: (e, a) =>
    first(
      () => notCancelled(e, "Editing the Drive link"),
      () =>
        isHead(a) || isAssignedMedia(e, a)
          ? OK
          : fail("forbidden", "Only the assigned photographer/videographer or the head can edit the Drive link."),
    ),
};

/** Can `actor` run a command of this type on `event` (ignoring command input)? */
export function canPerform(event: WorkflowEvent, type: CommandType, actor: Actor): Check {
  return GUARDS[type](event, actor);
}

export type Availability = "available" | "blocked" | "hidden";

/**
 * For the UI: "available" (show enabled), "blocked" (show disabled with the
 * reason, because a prerequisite is missing) or "hidden" (wrong stage or role).
 */
export function availability(
  event: WorkflowEvent,
  actor: Actor | null,
): Record<CommandType, { state: Availability; reason?: string }> {
  const out = {} as Record<CommandType, { state: Availability; reason?: string }>;
  for (const type of COMMAND_TYPES) {
    if (!actor) {
      out[type] = { state: "hidden" };
      continue;
    }
    const c = canPerform(event, type, actor);
    out[type] = c.ok
      ? { state: "available" }
      : c.code === "requirement"
        ? { state: "blocked", reason: c.message }
        : { state: "hidden" };
  }
  return out;
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

type Draft = { next: WorkflowEvent; patch: Patch; activity: ActivityEntry[] };

function set<K extends keyof WorkflowEvent>(d: Draft, key: K, value: WorkflowEvent[K]) {
  d.next = { ...d.next, [key]: value };
  d.patch = { ...d.patch, [key]: value };
}

function move(d: Draft, to: Status, action: string, details: Record<string, unknown> = {}) {
  const from = d.next.status;
  set(d, "status", to);
  d.activity.push({ action, from_status: from, to_status: to, details });
}

/** Automatic advance once both photos and caption are done. */
function autoAdvance(d: Draft) {
  if (d.next.status === "in_production" && d.next.photos_done && d.next.caption_done) {
    move(d, "for_proofreading", "auto_advance", { rule: "photos_done_and_caption_done" });
  }
}

function changed(event: WorkflowEvent, patch: Patch): Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(patch) as Array<keyof WorkflowEvent>) {
    out[key] = { from: event[key], to: patch[key] };
  }
  return out;
}

/**
 * Validate and apply a command. Returns the patch to persist, the resulting
 * event, and the activity rows to log (in order), or a typed failure.
 */
export function applyCommand(event: WorkflowEvent, cmd: Command, actor: Actor, now: Date): Result {
  const guard = canPerform(event, cmd.type, actor);
  if (!guard.ok) return guard;

  const d: Draft = { next: { ...event }, patch: {}, activity: [] };

  switch (cmd.type) {
    case "schedule":
      move(d, "scheduled", "transition");
      break;

    case "set_coverage_confirmed":
      if (event.coverage_confirmed === cmd.value) return fail("no_change", "Nothing to change.");
      set(d, "coverage_confirmed", cmd.value);
      d.activity.push({
        action: "coverage_confirmed",
        from_status: event.status,
        to_status: event.status,
        details: { value: cmd.value },
      });
      break;

    case "mark_covered":
      move(d, "covered", "transition");
      break;

    case "start_production":
      move(d, "in_production", "transition");
      autoAdvance(d);
      break;

    case "set_photos_done":
    case "set_caption_done": {
      const field = cmd.type === "set_photos_done" ? "photos_done" : "caption_done";
      if (event[field] === cmd.value) return fail("no_change", "Nothing to change.");
      set(d, field, cmd.value);
      d.activity.push({
        action: "tick",
        from_status: event.status,
        to_status: event.status,
        details: { field, value: cmd.value },
      });
      // Ticking a box on a covered event means work has started.
      if (cmd.value && event.status === "covered") {
        move(d, "in_production", "auto_advance", { rule: "work_started" });
      }
      autoAdvance(d);
      break;
    }

    case "approve":
      if (!event.proofreader_id) set(d, "proofreader_id", actor.id);
      set(d, "approved_by_id", actor.id);
      move(d, "approved", "transition");
      break;

    case "schedule_post":
    case "reschedule_post": {
      if (Number.isNaN(cmd.scheduledPostAt.getTime())) {
        return fail("invalid_input", "Pick a valid posting date and time.");
      }
      const iso = cmd.scheduledPostAt.toISOString();
      if (cmd.type === "reschedule_post") {
        if (event.scheduled_post_at && new Date(event.scheduled_post_at).getTime() === cmd.scheduledPostAt.getTime()) {
          return fail("no_change", "Nothing to change.");
        }
        set(d, "scheduled_post_at", iso);
        d.activity.push({
          action: "edit",
          from_status: event.status,
          to_status: event.status,
          details: { changes: changed(event, d.patch) },
        });
      } else {
        set(d, "scheduled_post_at", iso);
        move(d, "scheduled_for_posting", "transition", { scheduled_post_at: iso });
      }
      break;
    }

    case "mark_posted": {
      const link = cmd.postLink.trim();
      if (!isFacebookPostUrl(link)) {
        return fail("invalid_input", "Paste the Facebook post link (facebook.com or fb.watch).");
      }
      const postedAt = cmd.postedAt ?? now;
      if (Number.isNaN(postedAt.getTime())) return fail("invalid_input", "Pick a valid posting time.");
      if (postedAt.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) {
        return fail("invalid_input", "The posting time can't be in the future.");
      }
      set(d, "post_link", link);
      set(d, "posted_at", postedAt.toISOString());
      move(d, "posted", "transition", { post_link: link });
      break;
    }

    case "cancel": {
      const reason = cleanReason(cmd.reason);
      if (typeof reason !== "string") return reason;
      set(d, "cancelled_from_status", event.status);
      move(d, "cancelled", "cancel", { reason });
      break;
    }

    case "restore": {
      const reason = cleanReason(cmd.reason);
      if (typeof reason !== "string") return reason;
      // Guard guarantees status === cancelled; the DB guarantees an origin.
      const to = event.cancelled_from_status ?? "requested";
      set(d, "cancelled_from_status", null);
      move(d, to, "restore", { reason });
      break;
    }

    case "step_back": {
      const reason = cleanReason(cmd.reason);
      if (typeof reason !== "string") return reason;
      const to = previousStatus(event.status) as Status;
      const details: Record<string, unknown> = { reason };
      switch (event.status) {
        case "covered":
          // Back to scheduled: coverage is no longer confirmed.
          set(d, "coverage_confirmed", false);
          set(d, "photos_done", false);
          break;
        case "for_proofreading": {
          // Untick at least one box or the event would auto-advance straight back.
          const reset = cmd.reset ?? "caption";
          if (reset !== "photos") set(d, "caption_done", false);
          if (reset !== "caption") set(d, "photos_done", false);
          details.reset = reset;
          break;
        }
        case "approved":
          set(d, "approved_by_id", null);
          break;
        case "scheduled_for_posting":
          set(d, "scheduled_post_at", null);
          break;
        case "posted":
          set(d, "posted_at", null);
          set(d, "post_link", null);
          break;
      }
      move(d, to, "step_back", details);
      break;
    }

    case "assign": {
      const field = `${cmd.slot}_id` as const;
      const nextId = cmd.assignee?.id ?? null;
      if (cmd.assignee) {
        if (!cmd.assignee.active) return fail("invalid_input", "That staff member is inactive.");
        if (!cmd.assignee.roles.includes(cmd.slot)) {
          return fail("invalid_input", `That staff member doesn't have the ${cmd.slot} role.`);
        }
      }
      if (event[field] === nextId) return fail("no_change", "Nothing to change.");
      set(d, field, nextId);
      d.activity.push({
        action: "assign",
        from_status: event.status,
        to_status: event.status,
        details: { slot: cmd.slot, from: event[field], to: nextId },
      });
      break;
    }

    case "edit_details": {
      const c = cmd.changes;
      if (c.title !== undefined && c.title.trim().length === 0) {
        return fail("invalid_input", "The title can't be empty.");
      }
      if (event.status !== "requested" && (c.source === null || c.municipality === null)) {
        return fail("invalid_input", "Source and municipality are required once an event is scheduled.");
      }
      for (const key of Object.keys(c) as Array<keyof EditableDetails>) {
        const value = c[key];
        if (value !== undefined && value !== event[key]) {
          set(d, key, value as never);
        }
      }
      if (Object.keys(d.patch).length === 0) return fail("no_change", "Nothing to change.");
      d.activity.push({
        action: "edit",
        from_status: event.status,
        to_status: event.status,
        details: { changes: changed(event, d.patch) },
      });
      break;
    }

    case "edit_caption_text":
    case "edit_drive_link": {
      const field = cmd.type === "edit_caption_text" ? "caption_text" : "drive_folder_url";
      const value = cmd.value === null || cmd.value.trim() === "" ? null : cmd.value.trim();
      if (field === "drive_folder_url" && value !== null && !isHttpsUrl(value)) {
        return fail("invalid_input", "Paste a full https:// link.");
      }
      if (event[field] === value) return fail("no_change", "Nothing to change.");
      set(d, field, value);
      d.activity.push({
        action: "edit",
        from_status: event.status,
        to_status: event.status,
        // Caption bodies can be long; log only that it changed.
        details: { changes: { [field]: field === "caption_text" ? { changed: true } : { from: event[field], to: value } } },
      });
      break;
    }
  }

  return { ok: true, patch: d.patch, next: d.next, activity: d.activity };
}

// ---------------------------------------------------------------------------
// Board drag and drop
// ---------------------------------------------------------------------------

export type DropResult =
  | { ok: true; type: CommandType; needsInput: boolean }
  | Failure;

const FORWARD: Partial<Record<Status, { type: CommandType; needsInput: boolean }>> = {
  requested: { type: "schedule", needsInput: false },
  scheduled: { type: "mark_covered", needsInput: false },
  covered: { type: "start_production", needsInput: false },
  for_proofreading: { type: "approve", needsInput: false },
  approved: { type: "schedule_post", needsInput: true },
  scheduled_for_posting: { type: "mark_posted", needsInput: true },
};

/**
 * Map a board drop to the command it stands for, or explain why it's illegal.
 * Dropping one step forward runs that transition; one step back is a step-back
 * (head only, asks for a reason). Anything else snaps back.
 */
export function dropCommand(event: WorkflowEvent, to: Status, actor: Actor | null): DropResult {
  if (!actor) return fail("forbidden", "Sign in with your PIN to make changes.");
  if (to === event.status) return fail("no_change", "Nothing to change.");
  if (to === "cancelled") {
    return fail("invalid_input", "To cancel, open the event and use Cancel (a reason is required).");
  }
  if (event.status === "cancelled") {
    return fail("wrong_status", "Restore this event from its drawer first.");
  }

  if (to === nextStatus(event.status)) {
    if (event.status === "in_production") {
      return fail(
        "requirement",
        "This moves to For proofreading by itself once both “Photos/Video done” and “Caption done” are ticked.",
      );
    }
    // Every other forward step has a command; posted has no next status.
    const fwd = FORWARD[event.status] as { type: CommandType; needsInput: boolean };
    const c = canPerform(event, fwd.type, actor);
    return c.ok ? { ok: true, ...fwd } : c;
  }

  if (to === previousStatus(event.status)) {
    const c = canPerform(event, "step_back", actor);
    return c.ok ? { ok: true, type: "step_back", needsInput: true } : c;
  }

  return fail("invalid_input", "Events move one step at a time.");
}
