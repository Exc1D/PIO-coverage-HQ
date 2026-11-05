// Board filters live in the URL so a filtered board can be shared.

import { MUNICIPALITIES, PIPELINE, SLOTS, SOURCES, type Municipality, type Source, type Status } from "@/lib/constants";
import { isStuck } from "@/lib/metrics";
import { addDays, isDateString, manilaDate } from "@/lib/time";
import type { EventRow } from "@/lib/types";

export type BoardFilters = {
  source: Source | null;
  municipality: Municipality | null;
  person: string | null;
  from: string | null;
  to: string | null;
  cancelled: boolean;
  stuck: boolean;
  status: Status | null;
  /** Words to find in the event name. Separate from the filters: it has its own box, outside the folded panel. */
  q: string | null;
};

/** Without a date range, the Posted column shows only recent posts. */
export const RECENT_POSTED_DAYS = 14;

export function readFilters(params: URLSearchParams): BoardFilters {
  const source = params.get("source");
  const municipality = params.get("municipality");
  const from = params.get("from");
  const to = params.get("to");
  const status = params.get("status");
  return {
    source: (SOURCES as readonly string[]).includes(source ?? "") ? (source as Source) : null,
    municipality: (MUNICIPALITIES as readonly string[]).includes(municipality ?? "") ? (municipality as Municipality) : null,
    person: params.get("person") || null,
    from: from && isDateString(from) ? from : null,
    to: to && isDateString(to) ? to : null,
    cancelled: params.get("cancelled") === "1",
    stuck: params.get("stuck") === "1",
    status: PIPELINE.includes(status as Status) ? (status as Status) : null,
    q: params.get("q")?.trim() || null,
  };
}

export function hasFilters(f: BoardFilters): boolean {
  return Boolean(f.source || f.municipality || f.person || f.from || f.to || f.cancelled || f.stuck || f.status);
}

/** Lowercase without accents, so "penafrancia" finds "Peñafrancia". */
const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export function matchesFilters(e: EventRow, f: BoardFilters, today: string): boolean {
  // ponytail: searches what the board loaded (the last 90 days of finished events); search on the server if older ones are needed.
  if (f.q && !fold(f.q).split(/\s+/).every((word) => fold(e.title).includes(word))) return false;
  if (f.source && e.source !== f.source) return false;
  if (f.municipality && e.municipality !== f.municipality) return false;
  if (f.person && !SLOTS.some((slot) => e[`${slot}_id`] === f.person)) return false;
  if (f.from && e.event_date < f.from) return false;
  if (f.to && e.event_date > f.to) return false;
  if (f.stuck && !isStuck(e, today)) return false;
  if (f.status && e.status !== f.status) return false;
  if (e.status === "cancelled" && !f.cancelled) return false;
  if (e.status === "posted" && !f.from && !f.to && !f.q) {
    const since = addDays(today, -RECENT_POSTED_DAYS);
    if (!e.posted_at || manilaDate(e.posted_at) < since) return false;
  }
  return true;
}

/** Updates the query string in place; the board re-filters instantly without a server round trip. */
export function setParam(key: string, value: string | null) {
  const params = new URLSearchParams(window.location.search);
  if (value) params.set(key, value);
  else params.delete(key);
  const qs = params.toString();
  window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
}

/** Clears the filters but keeps the chosen view and the search. */
export function clearFilters() {
  const now = new URLSearchParams(window.location.search);
  const kept = new URLSearchParams();
  for (const key of ["view", "q"]) {
    const value = now.get(key);
    if (value) kept.set(key, value);
  }
  const qs = kept.toString();
  window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
}
