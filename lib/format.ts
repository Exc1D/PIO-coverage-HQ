import { formatManila, manilaStartOfDay } from "./time";
import type { EventRow } from "./types";

/** "Thu, Oct 22 · 9:30 AM" (Manila). */
export function formatEventDate(e: Pick<EventRow, "event_date" | "start_time">): string {
  const day = formatManila(manilaStartOfDay(e.event_date), "EEE, MMM d");
  if (!e.start_time) return day;
  const [h, m] = e.start_time.split(":").map(Number);
  const t = `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  return `${day} · ${t}`;
}
