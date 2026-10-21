// Board filters live in the URL so a filtered board can be shared.

import { MUNICIPALITIES, SOURCES, type Municipality, type Source } from "@/lib/constants";
import { addDays, isDateString, manilaDate } from "@/lib/time";
import type { EventRow } from "@/lib/types";

export type BoardFilters = {
  source: Source | null;
  municipality: Municipality | null;
  person: string | null;
  from: string | null;
  to: string | null;
  cancelled: boolean;
};

/** Without a date range, the Posted column shows only recent posts. */
export const RECENT_POSTED_DAYS = 14;

export function readFilters(params: URLSearchParams): BoardFilters {
  const source = params.get("source");
  const municipality = params.get("municipality");
  const from = params.get("from");
  const to = params.get("to");
  return {
    source: (SOURCES as readonly string[]).includes(source ?? "") ? (source as Source) : null,
    municipality: (MUNICIPALITIES as readonly string[]).includes(municipality ?? "") ? (municipality as Municipality) : null,
    person: params.get("person") || null,
    from: from && isDateString(from) ? from : null,
    to: to && isDateString(to) ? to : null,
    cancelled: params.get("cancelled") === "1",
  };
}

export function hasFilters(f: BoardFilters): boolean {
  return Boolean(f.source || f.municipality || f.person || f.from || f.to || f.cancelled);
}

export function matchesFilters(e: EventRow, f: BoardFilters, today: string): boolean {
  if (f.source && e.source !== f.source) return false;
  if (f.municipality && e.municipality !== f.municipality) return false;
  if (f.person && ![e.photographer_id, e.videographer_id, e.editor_id, e.writer_id, e.proofreader_id].includes(f.person)) return false;
  if (f.from && e.event_date < f.from) return false;
  if (f.to && e.event_date > f.to) return false;
  if (e.status === "cancelled" && !f.cancelled) return false;
  if (e.status === "posted" && !f.from && !f.to) {
    const since = addDays(today, -RECENT_POSTED_DAYS);
    if (!e.posted_at || manilaDate(e.posted_at) < since) return false;
  }
  return true;
}
