// Report tables, built once and shared by the Reports page and its CSV
// export so the two can never disagree.

import { MUNICIPALITY_LABELS, SOURCE_LABELS, type Source } from "./constants";
import { creditsByPerson, emptyCredit, postsGroupedBySource, type Credit, type Period } from "./metrics";
import { formatManila, manilaStartOfDay } from "./time";
import type { EventRow, Staff } from "./types";

export type PostRow = {
  id: string;
  postedAt: string; // "Oct 19, 2026 6:00 PM" (Manila)
  title: string;
  eventDate: string; // "Oct 18, 2026"
  municipality: string;
  writer: string;
  photoVideo: string;
  editor: string;
  proofreader: string;
  link: string;
};

export type SourceGroup = { source: Source | null; label: string; rows: PostRow[] };

export type PersonRow = { id: string; name: string; roles: string } & Credit & { total: number };

const PEOPLE_ROLES = ["writer", "proofreader", "photographer", "videographer", "photo_editor", "video_editor"] as const;

export function postGroups(events: readonly EventRow[], period: Period, staff: readonly Staff[]): SourceGroup[] {
  const name = (id: string | null) => (id ? (staff.find((s) => s.id === id)?.display_name ?? "Unknown") : "");
  return postsGroupedBySource(events, period).map((g) => ({
    source: g.source,
    label: g.source ? SOURCE_LABELS[g.source] : "No source",
    rows: g.posts.map((e) => ({
      id: e.id,
      postedAt: formatManila(e.posted_at as string, "MMM d, yyyy h:mm a"),
      title: e.title,
      eventDate: formatManila(manilaStartOfDay(e.event_date), "MMM d, yyyy"),
      municipality: e.municipality ? MUNICIPALITY_LABELS[e.municipality] : "",
      writer: name(e.writer_id),
      photoVideo: [name(e.photographer_id), name(e.videographer_id)].filter(Boolean).join(" / "),
      editor: name(e.editor_id),
      proofreader: name(e.proofreader_id),
      link: e.post_link ?? "",
    })),
  }));
}

/**
 * One row per person who either earned credit in the period or currently
 * holds a credited role, so a zero is visible rather than missing.
 */
export function peopleRows(events: readonly EventRow[], period: Period, staff: readonly Staff[]): PersonRow[] {
  const credits = creditsByPerson(events, period);
  return staff
    .filter((s) => credits.has(s.id) || (s.active && s.roles.some((r) => (PEOPLE_ROLES as readonly string[]).includes(r))))
    .map((s) => {
      const c = credits.get(s.id) ?? emptyCredit();
      return {
        id: s.id,
        name: s.display_name + (s.active ? "" : " (inactive)"),
        roles: s.roles.filter((r) => (PEOPLE_ROLES as readonly string[]).includes(r)).join(", "),
        ...c,
        total: c.written + c.proofread + c.photographed + c.videographed + c.edited,
      };
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

export function peopleTotals(rows: readonly PersonRow[]): Credit & { total: number } {
  const totals = { ...emptyCredit(), total: 0 };
  for (const r of rows) {
    for (const k of Object.keys(totals) as (keyof typeof totals)[]) totals[k] += r[k];
  }
  return totals;
}

/** "2026-10" or "2026-W43"-style slug for file names. */
export function periodSlug(period: Period): string {
  return period.kind === "month" ? period.startDate.slice(0, 7) : `week-of-${period.startDate}`;
}
