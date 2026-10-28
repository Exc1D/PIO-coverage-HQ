// "My work": one person's events, month by month (by event date, Manila).
// Pure, so the page and its tests can't disagree.

import { isMonthString, shiftMonth } from "./calendar";
import { SLOTS, type Slot } from "./constants";
import { byDateAndTime } from "./metrics";
import { endOfMonth, formatManila, manilaDate, manilaStartOfDay } from "./time";
import type { EventRow } from "./types";

/** How many months the overview strip shows, ending with the selected one. */
export const HISTORY_MONTHS = 6;

export type MyEvent = Pick<EventRow, "id" | "event_date" | "start_time" | "status"> & {
  [K in `${Slot}_id`]: string | null;
};

/** The slots `staffId` fills on an event, in slot order. */
export function mySlots(e: MyEvent, staffId: string): Slot[] {
  return SLOTS.filter((s) => e[`${s}_id`] === staffId);
}

export { shiftMonth };

/**
 * ?month=yyyy-MM, if it's a real month from 2000 up to the current Manila
 * month; anything else (missing, malformed, future) is the current month.
 */
export function monthParam(raw: string | string[] | undefined, now: Date): string {
  const current = manilaDate(now).slice(0, 7);
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && isMonthString(value) && value <= current ? value : current;
}

/** The `count` months ending with `month`, oldest first. */
export function monthsEnding(month: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => shiftMonth(month, i - count + 1));
}

/** First and last Manila calendar day of a run of months (oldest first). */
export function monthsRange(months: readonly string[]): { from: string; to: string } {
  return { from: `${months[0]}-01`, to: endOfMonth(`${months[months.length - 1]}-01`) };
}

export const monthLabel = (month: string, pattern = "MMMM yyyy") => formatManila(manilaStartOfDay(`${month}-01`), pattern);

export type MonthSummary = {
  month: string;
  /** Events held that month, not counting cancelled ones. */
  events: number;
  /** Of those, how many are posted. */
  posted: number;
};

/** One summary per month, in the order given. */
export function monthSummaries(events: readonly MyEvent[], months: readonly string[]): MonthSummary[] {
  return months.map((month) => {
    const held = events.filter((e) => e.event_date.startsWith(month) && e.status !== "cancelled");
    return { month, events: held.length, posted: held.filter((e) => e.status === "posted").length };
  });
}

/** Events held in `month`, earliest first (by date, then start time; no time last). */
export function eventsInMonth<T extends MyEvent>(events: readonly T[], month: string): T[] {
  return events.filter((e) => e.event_date.startsWith(month)).sort(byDateAndTime);
}

/** How many of the month's (non-cancelled) events this person filled each slot on. */
export function slotCounts(events: readonly MyEvent[], staffId: string): { slot: Slot; count: number }[] {
  const held = events.filter((e) => e.status !== "cancelled");
  return SLOTS.map((slot) => ({ slot, count: held.filter((e) => e[`${slot}_id`] === staffId).length })).filter((c) => c.count > 0);
}
