import "server-only";
import { connection } from "next/server";
import { db } from "@/lib/db/server";
import { addDays } from "@/lib/time";
import type { ActivityRow, CaptionRevision, DeletedEvent, EventRow } from "@/lib/types";

/** How far back the board loads finished (posted/cancelled) events. */
const BOARD_HISTORY_DAYS = 90;

/** Requester details are personal data: only signed-in staff may see them. */
export function redactForViewer<T extends Pick<EventRow, "requested_by" | "contact">>(event: T, signedIn: boolean): T {
  return signedIn ? event : { ...event, requested_by: null, contact: null };
}

/**
 * Lists (board, dashboard, calendars, reports) never carry requester details
 * (personal data) or caption bodies. Add new personal-data columns here.
 */
function forList(e: EventRow): EventRow {
  return { ...e, requested_by: null, contact: null, caption_text: null };
}

/**
 * Events for the board: everything still in progress, plus finished events
 * from roughly the last 90 days. Requester details and caption bodies are
 * dropped (cards don't need them).
 */
export async function listBoardEvents(today: string): Promise<EventRow[]> {
  await connection();
  const since = addDays(today, -BOARD_HISTORY_DAYS);
  const { data, error } = await db()
    .from("events")
    .select("*")
    .or(`status.not.in.(posted,cancelled),event_date.gte.${since}`)
    .order("event_date", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Could not load events: ${error.message}`);
  return (data as EventRow[]).map(forList);
}

export async function getEvent(id: string): Promise<EventRow | null> {
  await connection();
  const { data, error } = await db().from("events").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Could not load the event: ${error.message}`);
  return (data as EventRow | null) ?? null;
}

export async function getActivity(eventId: string): Promise<ActivityRow[]> {
  await connection();
  const { data, error } = await db()
    .from("event_activity")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (error) throw new Error(`Could not load the activity log: ${error.message}`);
  return data as ActivityRow[];
}

/** How many caption versions the event page shows. */
const CAPTION_HISTORY_LIMIT = 20;

/** Saved versions of an event's caption, newest first. */
export async function getCaptionRevisions(eventId: string): Promise<CaptionRevision[]> {
  await connection();
  const { data, error } = await db()
    .from("caption_revisions")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(CAPTION_HISTORY_LIMIT);
  if (error) throw new Error(`Could not load the caption history: ${error.message}`);
  return data as CaptionRevision[];
}

type Range = { start: Date; end: Date; startDate: string; endDate: string };

/**
 * Everything the dashboard needs in one query: events still in progress
 * (pipeline, stuck, needs assignment, next 7 days), plus events posted or
 * held within any of the given periods (current and previous, for deltas).
 * Requester details are dropped; the dashboard never shows them.
 */
export async function listEventsForDashboard(periods: Range[]): Promise<EventRow[]> {
  await connection();
  const clauses = ["status.not.in.(posted,cancelled)"];
  for (const p of periods) {
    clauses.push(`and(posted_at.gte.${p.start.toISOString()},posted_at.lt.${p.end.toISOString()})`);
    clauses.push(`and(event_date.gte.${p.startDate},event_date.lte.${p.endDate})`);
  }
  const { data, error } = await db()
    .from("events")
    .select("*")
    .or(clauses.join(","))
    .order("event_date", { ascending: true });
  if (error) throw new Error(`Could not load dashboard data: ${error.message}`);
  return (data as EventRow[]).map(forList);
}

/** Posted events whose posted_at falls inside the period (for reports). */
export async function listPostedInPeriod(period: Range): Promise<EventRow[]> {
  await connection();
  const { data, error } = await db()
    .from("events")
    .select("*")
    .eq("status", "posted")
    .gte("posted_at", period.start.toISOString())
    .lt("posted_at", period.end.toISOString())
    .order("posted_at", { ascending: true });
  if (error) throw new Error(`Could not load posts: ${error.message}`);
  return (data as EventRow[]).map(forList);
}

/** Non-cancelled events held between two Manila dates (inclusive). */
export async function listEventsByDate(from: string, to: string): Promise<EventRow[]> {
  await connection();
  const { data, error } = await db()
    .from("events")
    .select("*")
    .neq("status", "cancelled")
    .gte("event_date", from)
    .lte("event_date", to)
    .order("event_date", { ascending: true })
    .order("start_time", { ascending: true, nullsFirst: false });
  if (error) throw new Error(`Could not load events: ${error.message}`);
  return (data as EventRow[]).map(forList);
}

/** Posted events whose posted_at falls between two instants. */
export async function listPostedBetween(start: Date, end: Date): Promise<EventRow[]> {
  return listPostedInPeriod({ start, end, startDate: "", endDate: "" });
}

/** Deleted events still restorable (kept 30 days), newest delete first. */
export async function listDeletedEvents(): Promise<DeletedEvent[]> {
  await connection();
  const { data, error } = await db()
    .from("deleted_events")
    .select("event_id, title, deleted_by_id, deleted_at, event_date:event->>event_date, status:event->>status")
    .order("deleted_at", { ascending: false });
  if (error) throw new Error(`Could not load deleted events: ${error.message}`);
  return data as DeletedEvent[];
}
