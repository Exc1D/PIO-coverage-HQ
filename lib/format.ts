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

/** Staff as this viewer may see them. Signed-out viewers learn a slot is filled, never by whom, and the names don't reach their browser. */
export function staffForViewer(staff: readonly Staff[], signedIn: boolean): Staff[] {
  if (signedIn) return [...staff];
  return staff.map((s) => ({ id: s.id, full_name: ANONYMOUS, display_name: ANONYMOUS, roles: [], active: true }));
}

/** A staff member's display name: null when nobody is assigned, "Unknown" for an ID not in `staff`. */
export function staffName(staff: readonly Pick<Staff, "id" | "display_name">[], id: string | null | undefined): string | null {
  if (!id) return null;
  return staff.find((s) => s.id === id)?.display_name ?? "Unknown";
}
