import { SLOTS } from "./constants";
import { formatManila, manilaStartOfDay } from "./time";
import type { EventRow, Staff } from "./types";

/** "HH:mm[:ss]" → "9:30 AM". */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** "Thu, Oct 22 · 9:30 AM" (Manila). */
export function formatEventDate(e: Pick<EventRow, "event_date" | "start_time">): string {
  const day = formatManila(manilaStartOfDay(e.event_date), "EEE, MMM d");
  return e.start_time ? `${day} · ${formatTime(e.start_time)}` : day;
}

const ANONYMOUS = "Team member";
const ANONYMOUS_ID = "team-member"; // Real ids can be matched to names on the public sign-in list.

/** Staff as this viewer may see them. Signed-out viewers learn a slot is filled, never by whom, and the names don't reach their browser. */
export function staffForViewer(staff: readonly Staff[], signedIn: boolean): Staff[] {
  if (signedIn) return [...staff];
  return staff.length ? [{ id: ANONYMOUS_ID, full_name: ANONYMOUS, display_name: ANONYMOUS, roles: [], active: true }] : [];
}

/** An event as this viewer may see it. Signed out: no requester, and any assigned staff are all the same placeholder. */
export function redactForViewer(event: EventRow, signedIn: boolean): EventRow {
  if (signedIn) return event;
  const seen = { ...event, requested_by: null, contact: null, created_by_id: null };
  if (seen.approved_by_id) seen.approved_by_id = ANONYMOUS_ID;
  for (const slot of SLOTS) if (seen[`${slot}_id`]) seen[`${slot}_id`] = ANONYMOUS_ID;
  return seen;
}

/** A staff member's display name: null when nobody is assigned, "Unknown" for an ID not in `staff`. */
export function staffName(staff: readonly Pick<Staff, "id" | "display_name">[], id: string | null | undefined): string | null {
  if (!id) return null;
  return staff.find((s) => s.id === id)?.display_name ?? "Unknown";
}
