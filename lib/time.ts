// All calendar logic happens in Asia/Manila. Timestamps are stored in UTC;
// calendar dates (event_date, due_date) are plain "yyyy-MM-dd" strings, which
// compare correctly as strings.

import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { TIMEZONE } from "./constants";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar date in yyyy-MM-dd form. */
export function isDateString(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** The Manila calendar date of an instant. */
export function manilaDate(instant: Date | string): string {
  return formatInTimeZone(instant, TIMEZONE, "yyyy-MM-dd");
}

/** Format an instant in Manila time (date-fns format tokens). */
export function formatManila(instant: Date | string, pattern: string): string {
  return formatInTimeZone(instant, TIMEZONE, pattern);
}

/** The UTC instant at which a Manila calendar day starts. */
export function manilaStartOfDay(date: string): Date {
  return fromZonedTime(`${date}T00:00:00`, TIMEZONE);
}

/** Convert a Manila wall-clock date + time ("HH:mm") to a UTC instant. */
export function manilaDateTime(date: string, time: string): Date {
  return fromZonedTime(`${date}T${time.length === 5 ? `${time}:00` : time}`, TIMEZONE);
}

/** Calendar arithmetic on yyyy-MM-dd strings (timezone-free). */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole days from `a` to `b` (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000,
  );
}

/** ISO weekday of a calendar date: 1 = Monday ... 7 = Sunday. */
export function isoWeekday(date: string): number {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

/** Monday of the week containing `date`. */
export function startOfWeek(date: string): string {
  return addDays(date, 1 - isoWeekday(date));
}

/** First day of the month containing `date`. */
export function startOfMonth(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

/** Last day of the month containing `date`. */
export function endOfMonth(date: string): string {
  const [y, m] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}
