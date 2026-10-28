// Month grid for the calendars: Monday-first weeks (matching report weeks),
// including the leading/trailing days of neighbouring months.

import { addDays, endOfMonth, isSupportedDate, startOfWeek } from "./time";

/** "yyyy-MM" → true if it names a real month in the supported range. */
export function isMonthString(value: string): boolean {
  return /^\d{4}-\d{2}$/.test(value) && isSupportedDate(`${value}-01`);
}

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** "2026-10" moved by `delta` months. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export type GridDay = { date: string; inMonth: boolean };

/** 4–6 weeks of 7 days covering the whole month, Monday first. */
export function monthGrid(month: string): GridDay[][] {
  const first = `${month}-01`;
  const last = endOfMonth(first);
  const weeks: GridDay[][] = [];
  for (let start = startOfWeek(first); start <= last; start = addDays(start, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => {
      const date = addDays(start, i);
      return { date, inMonth: date.slice(0, 7) === month };
    }));
  }
  return weeks;
}

/** First and last dates shown in the grid. */
export function gridRange(month: string): { from: string; to: string } {
  const weeks = monthGrid(month);
  return { from: weeks[0][0].date, to: weeks[weeks.length - 1][6].date };
}

/** Group items by a date key, preserving input order within each day. */
export function byDay<T>(items: readonly T[], key: (item: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = out.get(k);
    if (list) list.push(item);
    else out.set(k, [item]);
  }
  return out;
}
