// Reporting definitions (spec section 7). Pure functions over event rows;
// the dashboard, reports and CSV export all use these so they can't disagree.

import {
  hasLive,
  hasRegular,
  NEEDS_ASSIGNMENT_DAYS,
  PIPELINE,
  SOURCES,
  type Source,
  type Status,
} from "./constants";
import {
  addDays,
  daysBetween,
  endOfMonth,
  formatManila,
  isDateString,
  manilaDate,
  manilaStartOfDay,
  startOfMonth,
  startOfWeek,
} from "./time";
import type { EventRow } from "./types";

export type MetricEvent = Pick<
  EventRow,
  | "status"
  | "event_date"
  | "due_date"
  | "posted_at"
  | "source"
  | "coverage"
  | "photographer_id"
  | "videographer_id"
  | "editor_id"
  | "writer_id"
  | "proofreader_id"
  | "cameraman_id"
  | "obs_tech_id"
>;

// ---------------------------------------------------------------------------
// Periods (Asia/Manila)
// ---------------------------------------------------------------------------

export type PeriodKind = "week" | "month" | "custom";

export type Period = {
  kind: PeriodKind;
  /** First Manila calendar day, inclusive. */
  startDate: string;
  /** Last Manila calendar day, inclusive. */
  endDate: string;
  /** UTC instant of startDate 00:00 Manila. */
  start: Date;
  /** UTC instant of the day after endDate 00:00 Manila (exclusive). */
  end: Date;
  label: string;
};

function makePeriod(kind: PeriodKind, startDate: string, endDate: string, label: string): Period {
  return {
    kind,
    startDate,
    endDate,
    start: manilaStartOfDay(startDate),
    end: manilaStartOfDay(addDays(endDate, 1)),
    label,
  };
}

const dayLabel = (date: string, pattern: string) => formatManila(manilaStartOfDay(date), pattern);

/** The Monday–Sunday week containing `date`. */
export function weekPeriod(date: string): Period {
  const start = startOfWeek(date);
  const end = addDays(start, 6);
  return makePeriod("week", start, end, `Week of ${dayLabel(start, "MMM d, yyyy")}`);
}

/** The calendar month containing `date`. */
export function monthPeriod(date: string): Period {
  return makePeriod("month", startOfMonth(date), endOfMonth(date), dayLabel(date, "MMMM yyyy"));
}

/** An inclusive custom range of Manila calendar dates. */
export function customPeriod(startDate: string, endDate: string): Period {
  if (!isDateString(startDate) || !isDateString(endDate)) {
    throw new RangeError("Dates must be yyyy-MM-dd.");
  }
  if (endDate < startDate) throw new RangeError("The end date is before the start date.");
  return makePeriod(
    "custom",
    startDate,
    endDate,
    `${dayLabel(startDate, "MMM d, yyyy")} – ${dayLabel(endDate, "MMM d, yyyy")}`,
  );
}

/** The period of the same kind immediately before `period`. */
export function previousPeriod(period: Period): Period {
  if (period.kind === "week") return weekPeriod(addDays(period.startDate, -7));
  if (period.kind === "month") return monthPeriod(addDays(period.startDate, -1));
  const length = daysBetween(period.startDate, period.endDate) + 1;
  return customPeriod(addDays(period.startDate, -length), addDays(period.startDate, -1));
}

/** The period of the same kind immediately after `period` (weeks and months). */
export function nextPeriod(period: Period): Period {
  return period.kind === "week"
    ? weekPeriod(addDays(period.startDate, 7))
    : monthPeriod(addDays(period.endDate, 1));
}

/** "This week" / "This month" relative to `now`, in Manila. */
export function currentPeriod(kind: "week" | "month", now: Date): Period {
  const today = manilaDate(now);
  return kind === "week" ? weekPeriod(today) : monthPeriod(today);
}

export function instantInPeriod(instant: string | Date, period: Period): boolean {
  const t = new Date(instant).getTime();
  return t >= period.start.getTime() && t < period.end.getTime();
}

export function dateInPeriod(date: string, period: Period): boolean {
  return date >= period.startDate && date <= period.endDate;
}

// ---------------------------------------------------------------------------
// Definitions
// ---------------------------------------------------------------------------

const TERMINAL: readonly Status[] = ["posted", "cancelled"];
const COVERED_OR_LATER: readonly Status[] = PIPELINE.slice(PIPELINE.indexOf("covered"));

/** A post counts if status = posted and posted_at falls inside the period. */
export function countsAsPost(e: MetricEvent, period: Period): boolean {
  return e.status === "posted" && e.posted_at !== null && instantInPeriod(e.posted_at, period);
}

/** Still being worked on (not posted, not cancelled). */
export function inPipeline(e: MetricEvent): boolean {
  return !TERMINAL.includes(e.status);
}

/** Stuck = not posted/cancelled and today (Manila) is past the due date. */
export function isStuck(e: MetricEvent, today: string): boolean {
  return inPipeline(e) && today > e.due_date;
}

/** Someone an event's minimum team is still missing. */
export type TeamGap = "writer" | "photo_video" | "cameraman" | "obs_tech";

export const TEAM_GAP_LABELS: Record<TeamGap, string> = {
  writer: "writer",
  photo_video: "photo/video",
  cameraman: "cameraman",
  obs_tech: "OBS tech",
};

/**
 * Who is missing from the minimum team: a writer and a photographer or
 * videographer for regular coverage, a cameraman and an OBS tech for a live stream.
 */
export function teamGaps(
  e: Pick<MetricEvent, "coverage" | "writer_id" | "photographer_id" | "videographer_id" | "cameraman_id" | "obs_tech_id">,
): TeamGap[] {
  const gaps: TeamGap[] = [];
  if (hasRegular(e.coverage)) {
    if (!e.writer_id) gaps.push("writer");
    if (!e.photographer_id && !e.videographer_id) gaps.push("photo_video");
  }
  if (hasLive(e.coverage)) {
    if (!e.cameraman_id) gaps.push("cameraman");
    if (!e.obs_tech_id) gaps.push("obs_tech");
  }
  return gaps;
}

/**
 * Needs assignment = requested/scheduled, event within the next 14 days
 * (today through today + 14), and a gap in the minimum team (see teamGaps).
 */
export function needsAssignment(e: MetricEvent, today: string): boolean {
  return (
    (e.status === "requested" || e.status === "scheduled") &&
    e.event_date >= today &&
    e.event_date <= addDays(today, NEEDS_ASSIGNMENT_DAYS) &&
    teamGaps(e).length > 0
  );
}

/** Whole days an event is past its posting target (0 if not overdue). */
export function daysOverdue(e: Pick<MetricEvent, "due_date">, today: string): number {
  return Math.max(0, daysBetween(e.due_date, today));
}

/** Sort order for events: by date, then start time (no time last). */
export const byDateAndTime = (
  a: Pick<EventRow, "event_date" | "start_time">,
  b: Pick<EventRow, "event_date" | "start_time">,
) => a.event_date.localeCompare(b.event_date) || (a.start_time ?? "99").localeCompare(b.start_time ?? "99");

/** Non-cancelled events happening from today through the next `days - 1` days. */
export function upcoming<T extends MetricEvent & { start_time: string | null }>(
  events: readonly T[],
  today: string,
  days = 7,
): T[] {
  const last = addDays(today, days - 1);
  return events.filter((e) => e.status !== "cancelled" && e.event_date >= today && e.event_date <= last).sort(byDateAndTime);
}

/** Covered in period = event_date in the period and status covered or later. */
export function countsAsCovered(e: MetricEvent, period: Period): boolean {
  return COVERED_OR_LATER.includes(e.status) && dateInPeriod(e.event_date, period);
}

// ---------------------------------------------------------------------------
// Aggregates
// ---------------------------------------------------------------------------

export function postsInPeriod<T extends MetricEvent>(events: readonly T[], period: Period): T[] {
  return events.filter((e) => countsAsPost(e, period));
}

export function postsBySource(events: readonly MetricEvent[], period: Period): Record<Source, number> {
  const out = Object.fromEntries(SOURCES.map((s) => [s, 0])) as Record<Source, number>;
  for (const e of postsInPeriod(events, period)) {
    if (e.source) out[e.source] += 1;
  }
  return out;
}

/** Posts in the period grouped by source (sources in fixed order), each group oldest first. */
export function postsGroupedBySource<T extends MetricEvent>(
  events: readonly T[],
  period: Period,
): { source: Source | null; posts: T[] }[] {
  const posts = postsInPeriod(events, period).sort((a, b) => (a.posted_at as string).localeCompare(b.posted_at as string));
  const groups: { source: Source | null; posts: T[] }[] = SOURCES.map((source) => ({
    source,
    posts: posts.filter((p) => p.source === source),
  }));
  const unknown = posts.filter((p) => p.source === null);
  if (unknown.length) groups.push({ source: null, posts: unknown });
  return groups.filter((g) => g.posts.length > 0);
}

export type PipelineStatus = Exclude<Status, "posted" | "cancelled">;
export const PIPELINE_STATUSES = PIPELINE.filter((s) => !TERMINAL.includes(s)) as PipelineStatus[];

/** Count of events currently at each in-progress status. */
export function pipelineCounts(events: readonly MetricEvent[]): Record<PipelineStatus, number> {
  const out = Object.fromEntries(PIPELINE_STATUSES.map((s) => [s, 0])) as Record<PipelineStatus, number>;
  for (const e of events) {
    if (inPipeline(e)) out[e.status as PipelineStatus] += 1;
  }
  return out;
}

export type Credit = {
  written: number;
  proofread: number;
  photographed: number;
  videographed: number;
  edited: number;
  /** Live streams worked as cameraman. */
  liveCamera: number;
  /** Live streams worked as OBS tech. */
  liveObs: number;
};

export const emptyCredit = (): Credit => ({
  written: 0,
  proofread: 0,
  photographed: 0,
  videographed: 0,
  edited: 0,
  liveCamera: 0,
  liveObs: 0,
});

/** Per-person credit by role, counted only from events posted in the period. */
export function creditsByPerson(events: readonly MetricEvent[], period: Period): Map<string, Credit> {
  const out = new Map<string, Credit>();
  const bump = (id: string | null, key: keyof Credit) => {
    if (!id) return;
    const c = out.get(id) ?? emptyCredit();
    c[key] += 1;
    out.set(id, c);
  };
  for (const e of postsInPeriod(events, period)) {
    bump(e.writer_id, "written");
    bump(e.proofreader_id, "proofread");
    bump(e.photographer_id, "photographed");
    bump(e.videographer_id, "videographed");
    bump(e.editor_id, "edited");
    bump(e.cameraman_id, "liveCamera");
    bump(e.obs_tech_id, "liveObs");
  }
  return out;
}

export type DashboardSummary = {
  postsPublished: number;
  eventsCovered: number;
  /** Of the events covered, how many were livestreamed. */
  liveStreams: number;
  inPipeline: number;
  stuck: number;
  bySource: Record<Source, number>;
  pipeline: Record<PipelineStatus, number>;
  credits: Map<string, Credit>;
};

/** Everything the dashboard tiles and charts need. */
export function summarize(events: readonly MetricEvent[], period: Period, today: string): DashboardSummary {
  return {
    postsPublished: postsInPeriod(events, period).length,
    eventsCovered: events.filter((e) => countsAsCovered(e, period)).length,
    liveStreams: events.filter((e) => hasLive(e.coverage) && countsAsCovered(e, period)).length,
    inPipeline: events.filter(inPipeline).length,
    stuck: events.filter((e) => isStuck(e, today)).length,
    bySource: postsBySource(events, period),
    pipeline: pipelineCounts(events),
    credits: creditsByPerson(events, period),
  };
}
