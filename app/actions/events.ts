"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { detailsSchema, parseCommand } from "@/lib/commands";
import { AuthError, requireStaff } from "@/lib/auth/session";
import { db, DB_ERRORS } from "@/lib/db/server";
import { fieldErrors } from "@/lib/form-errors";
import { getEvent } from "@/lib/data/events";
import { listStaff } from "@/lib/data/staff";
import type { EventRow, Staff } from "@/lib/types";
import { applyCommand } from "@/lib/workflow";

export type CommandResult =
  | { ok: true; version: number }
  | { ok: false; code: "auth" | "conflict" | "not_found" | "rejected" | "error"; message: string };

const idSchema = z.uuid();

async function actor(): Promise<Staff | Extract<CommandResult, { ok: false }>> {
  try {
    return await requireStaff();
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, code: "auth", message: e.message };
    throw e;
  }
}

/**
 * Run one workflow command against an event. The client sends the version it
 * last saw; a stale version is rejected so two people can't silently
 * overwrite each other.
 */
export async function runEventCommand(eventId: string, version: number, payload: unknown): Promise<CommandResult> {
  const me = await actor();
  if ("ok" in me) return me;

  if (!idSchema.safeParse(eventId).success || !Number.isInteger(version)) {
    return { ok: false, code: "rejected", message: "Invalid request." };
  }

  const [event, staff] = await Promise.all([getEvent(eventId), listStaff()]);
  if (!event) return { ok: false, code: "not_found", message: "This event no longer exists." };
  if (event.version !== version) {
    refresh();
    return { ok: false, code: "conflict", message: "Someone else just updated this event. It has been reloaded; please try again." };
  }

  const parsed = parseCommand(payload, staff);
  if (!parsed.ok) return { ok: false, code: "rejected", message: parsed.message };

  const result = applyCommand(event, parsed.command, me, new Date());
  if (!result.ok) return { ok: false, code: "rejected", message: result.message };

  const { data, error } = await db()
    .rpc("apply_event_change", {
      p_event_id: event.id,
      p_expected_version: version,
      p_patch: result.patch,
      p_activity: result.activity.map((a) => ({ ...a, actor_id: me.id })),
    })
    .single<EventRow>();

  if (error) {
    refresh();
    if (error.code === DB_ERRORS.conflict) {
      return { ok: false, code: "conflict", message: "Someone else just updated this event. It has been reloaded; please try again." };
    }
    if (error.code === DB_ERRORS.notFound) return { ok: false, code: "not_found", message: "This event no longer exists." };
    console.error("apply_event_change failed", error.code, error.message);
    return { ok: false, code: "error", message: "The change couldn't be saved. Please try again." };
  }

  refresh();
  return { ok: true, version: data.version };
}

// ---------------------------------------------------------------------------
// New event (head)
// ---------------------------------------------------------------------------

export type CreateEventState =
  | { error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string>; createdId?: string }
  | undefined;

const createSchema = detailsSchema.extend({
  municipality: detailsSchema.shape.municipality.unwrap(),
  source: detailsSchema.shape.source.unwrap(),
});

export async function createEventAction(_prev: CreateEventState, formData: FormData): Promise<CreateEventState> {
  const me = await actor();
  if ("ok" in me) return { error: me.message };
  if (!me.roles.includes("head")) return { error: "Only the head can add events here. Others can use the request form." };

  const raw = Object.fromEntries(
    ["title", "event_date", "start_time", "venue", "municipality", "source", "requested_by", "contact", "notes"].map(
      (k) => [k, String(formData.get(k) ?? "")],
    ),
  );
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values: raw };

  const { data, error } = await db()
    .rpc("create_event", {
      p_row: { ...parsed.data, status: "requested", created_by_id: me.id },
      p_activity: [{ actor_id: me.id, action: "created", from_status: null, to_status: "requested", details: {} }],
    })
    .single<EventRow>();
  if (error) {
    console.error("create_event failed", error.code, error.message);
    return { error: "The event couldn't be saved. Please try again.", values: raw };
  }
  refresh();
  return { createdId: data.id };
}

// ---------------------------------------------------------------------------
// Delete event (head)
// ---------------------------------------------------------------------------

export type DeleteResult = { ok: true } | Extract<CommandResult, { ok: false }>;

/**
 * Delete an event and its activity. The database keeps a copy for 30 days so a
 * mistake can be undone (README, "Troubleshooting"); cancelling is the everyday
 * reversible option.
 */
export async function deleteEventAction(eventId: string, version: number): Promise<DeleteResult> {
  const me = await actor();
  if ("ok" in me) return me;
  if (!me.roles.includes("head")) return { ok: false, code: "rejected", message: "Only the head can delete events." };

  if (!idSchema.safeParse(eventId).success || !Number.isInteger(version)) {
    return { ok: false, code: "rejected", message: "Invalid request." };
  }

  const { error } = await db().rpc("delete_event", { p_event_id: eventId, p_expected_version: version, p_deleted_by: me.id });
  if (error) {
    // not_found: the client navigates away, so don't re-render the missing event.
    if (error.code === DB_ERRORS.notFound) return { ok: false, code: "not_found", message: "This event no longer exists." };
    // The database re-checks the role, so a head demoted since loading the page is refused.
    if (error.code === DB_ERRORS.forbidden) return { ok: false, code: "rejected", message: "Only the head can delete events." };
    refresh();
    if (error.code === DB_ERRORS.conflict) {
      return { ok: false, code: "conflict", message: "Someone else just updated this event. It has been reloaded; please check it before deleting." };
    }
    console.error("delete_event failed", error.code, error.message);
    return { ok: false, code: "error", message: "The event couldn't be deleted. Please try again." };
  }
  // No refresh here: re-rendering the deleted event's page would 404. The
  // client navigates away and refreshes the page it lands on.
  console.info("event deleted", { eventId, by: me.id });
  return { ok: true };
}

export type RestoreResult = { ok: true } | Extract<CommandResult, { ok: false }>;

/** Bring back an event deleted in the last 30 days (Undo, or Recently deleted on Staff). */
export async function restoreEventAction(eventId: string): Promise<RestoreResult> {
  const me = await actor();
  if ("ok" in me) return me;
  if (!me.roles.includes("head")) return { ok: false, code: "rejected", message: "Only the head can restore events." };
  if (!idSchema.safeParse(eventId).success) return { ok: false, code: "rejected", message: "Invalid request." };

  const { error } = await db().rpc("restore_deleted_event", { p_event_id: eventId, p_restored_by: me.id });
  refresh();
  if (error) {
    if (error.code === DB_ERRORS.forbidden) return { ok: false, code: "rejected", message: "Only the head can restore events." };
    if (error.code === DB_ERRORS.notFound) {
      return { ok: false, code: "not_found", message: "This event can’t be restored: it was deleted over 30 days ago or already brought back." };
    }
    if (error.code === DB_ERRORS.conflict) return { ok: false, code: "conflict", message: "This event is already back on the board." };
    console.error("restore_deleted_event failed", error.code, error.message);
    return { ok: false, code: "error", message: "The event couldn't be restored. Please try again." };
  }
  console.info("event restored", { eventId, by: me.id });
  return { ok: true };
}
