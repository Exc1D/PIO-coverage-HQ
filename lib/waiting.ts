// "Waiting on": who has to act next for an event to move forward. Derived
// from the status, the progress boxes and the team (never stored), so it can't
// go stale. Mirrors the steps in lib/workflow.ts.

import type { Slot } from "./constants";
import { teamGaps, type TeamGap } from "./metrics";
import type { EventRow } from "./types";

export type WaitingEvent = Pick<
  EventRow,
  | "status"
  | "event_date"
  | "source"
  | "municipality"
  | "coverage"
  | "coverage_confirmed"
  | "photos_done"
  | "caption_done"
  | "photographer_id"
  | "videographer_id"
  | "editor_id"
  | "writer_id"
  | "proofreader_id"
  | "cameraman_id"
  | "obs_tech_id"
>;

/** An assigned person, or anyone with a role when no one specific is on it. */
export type Party = { kind: "staff"; id: string; slot: Slot } | { kind: "role"; role: "head" | "proofreader" | "page_admin" };

export type Waiting = { who: Party; task: string };

const HEAD: Party = { kind: "role", role: "head" };
const PAGE_ADMIN: Party = { kind: "role", role: "page_admin" };

const staff = (e: WaitingEvent, slot: Slot): Party | null => {
  const id = e[`${slot}_id`];
  return id ? { kind: "staff", id, slot } : null;
};

const present = (p: Party | null): p is Party => p !== null;

const GAP_TASKS: Record<TeamGap, string> = {
  writer: "a writer",
  photo_video: "photo/video",
  cameraman: "a cameraman",
  obs_tech: "an OBS tech",
};

/** "a, b and c" */
const listOf = (items: readonly string[]) =>
  items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}` : items.join("");

/** Who still owes photos/video: the editor once there is one, else whoever shot it. */
function photoWork(e: WaitingEvent): Waiting[] {
  const editor = staff(e, "editor");
  if (editor) return [{ who: editor, task: "Finish editing photos/video" }];
  const shooters = [staff(e, "photographer"), staff(e, "videographer")].filter(present);
  if (shooters.length === 0) return [{ who: HEAD, task: "Assign photo/video" }];
  return shooters.map((who) => ({ who, task: "Finish photos/video" }));
}

/**
 * Who the event is waiting on, and for what. Empty when nobody is holding it
 * up: posted, cancelled, or fully set up and the event day hasn't come yet.
 * `changesRequested`: the proofreader sent the caption back.
 */
export function waitingOn(e: WaitingEvent, today: string, opts: { changesRequested?: boolean } = {}): Waiting[] {
  switch (e.status) {
    case "requested":
      return [{ who: HEAD, task: e.source && e.municipality ? "Schedule the event" : "Add source and municipality, then schedule" }];

    case "scheduled": {
      const missing = teamGaps(e);
      if (missing.length) return [{ who: HEAD, task: `Assign ${listOf(missing.map((g) => GAP_TASKS[g]))}` }];
      if (!e.coverage_confirmed) return [{ who: HEAD, task: "Confirm coverage" }];
      if (e.event_date > today) return [];
      return [staff(e, "photographer"), staff(e, "videographer"), staff(e, "cameraman"), staff(e, "obs_tech")]
        .filter(present)
        .map((who) => ({ who, task: "Mark as covered" }));
    }

    case "covered":
    case "in_production": {
      // Live only: the live video is the post; the OBS tech usually has its link.
      if (e.coverage === "live") return [{ who: staff(e, "obs_tech") ?? PAGE_ADMIN, task: "Add the live video link" }];
      const out: Waiting[] = [];
      if (!e.photos_done) out.push(...photoWork(e));
      if (!e.caption_done) {
        const writer = staff(e, "writer");
        out.push(
          writer
            ? { who: writer, task: opts.changesRequested ? "Revise the caption (changes requested)" : "Finish the caption" }
            : { who: HEAD, task: "Assign a writer" },
        );
      }
      return out;
    }

    case "for_proofreading":
      return [{ who: staff(e, "proofreader") ?? { kind: "role", role: "proofreader" }, task: "Proofread the caption" }];

    case "approved":
      return [{ who: PAGE_ADMIN, task: "Schedule the post" }];

    case "scheduled_for_posting":
      return [{ who: PAGE_ADMIN, task: "Publish the post" }];

    default:
      return [];
  }
}

/** Stable key for grouping by party. */
export const partyKey = (p: Party) => (p.kind === "staff" ? `staff:${p.id}` : `role:${p.role}`);

export type WaitingGroup<T> = { who: Party; items: { event: T; task: string }[] };

/**
 * Everyone something is waiting on, with what, busiest first (ties: people
 * before roles, then by key). A person on two tasks for one event is listed once per task.
 */
export function waitingByParty<T extends WaitingEvent>(events: readonly T[], today: string): WaitingGroup<T>[] {
  const groups = new Map<string, WaitingGroup<T>>();
  for (const event of events) {
    for (const w of waitingOn(event, today)) {
      const key = partyKey(w.who);
      const g = groups.get(key) ?? { who: w.who, items: [] };
      g.items.push({ event, task: w.task });
      groups.set(key, g);
    }
  }
  return [...groups.values()].sort(
    (a, b) =>
      b.items.length - a.items.length ||
      (a.who.kind === b.who.kind ? partyKey(a.who).localeCompare(partyKey(b.who)) : a.who.kind === "staff" ? -1 : 1),
  );
}
