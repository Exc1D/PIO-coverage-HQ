import { formatManila, manilaStartOfDay } from "./time";
import type { EventRow } from "./types";

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
