// Reading periods from URL query strings (dashboard and reports).

import { currentPeriod, customPeriod, monthPeriod, weekPeriod, type Period } from "./metrics";
import { isDateString, manilaDate } from "./time";

type Params = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * Dashboard: ?period=week|month (this week/month in Manila) or
 * ?period=custom&from=yyyy-MM-dd&to=yyyy-MM-dd. Anything invalid falls back
 * to this week.
 */
export function dashboardPeriod(params: Params, now: Date): Period {
  const period = one(params.period);
  if (period === "month") return currentPeriod("month", now);
  if (period === "custom") {
    const from = one(params.from);
    const to = one(params.to);
    if (from && to && isDateString(from) && isDateString(to) && from <= to) return customPeriod(from, to);
  }
  return currentPeriod("week", now);
}

/**
 * Reports: ?kind=week|month&date=yyyy-MM-dd (any day inside the period).
 * Defaults to the current month.
 */
export function reportPeriod(params: Params, now: Date): Period {
  const kind = one(params.kind) === "week" ? "week" : "month";
  const raw = one(params.date);
  const date = raw && isDateString(raw) ? raw : manilaDate(now);
  return kind === "week" ? weekPeriod(date) : monthPeriod(date);
}
