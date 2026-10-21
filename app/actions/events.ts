"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { detailsSchema, parseCommand } from "@/lib/commands";
import { AuthError, requireStaff } from "@/lib/auth/session";
import { db, DB_ERRORS } from "@/lib/db/server";
import { getEvent } from "@/lib/data/events";
import { listStaff } from "@/lib/data/staff";
import { notify } from "@/lib/notify";
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

  await notify({ eventId: event.id, title: event.title, actorId: me.id, activity: result.activity }).catch((e) =>
    console.error("notify failed", e),
  );
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
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { fieldErrors, values: raw };
  }

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
  await notify({
    eventId: data.id,
    title: data.title,
    actorId: me.id,
    activity: [{ action: "created", from_status: null, to_status: "requested", details: {} }],
  }).catch((e) => console.error("notify failed", e));
  refresh();
  return { createdId: data.id };
}

// ---------------------------------------------------------------------------
// Delete event (head)
// ---------------------------------------------------------------------------

export type DeleteResult = { ok: true } | Extract<CommandResult, { ok: false }>;

/** Permanently delete an event and its activity. Cancelling is the reversible option. */
export async function deleteEventAction(eventId: string, version: number): Promise<DeleteResult> {
  const me = await actor();
  if ("ok" in me) return me;
  if (!me.roles.includes("head")) return { ok: false, code: "rejected", message: "Only the head can delete events." };

  if (!idSchema.safeParse(eventId).success || !Number.isInteger(version)) {
    return { ok: false, code: "rejected", message: "Invalid request." };
  }

  const { error } = await db().rpc("delete_event", { p_event_id: eventId, p_expected_version: version });
  if (error) {
    // not_found: the client navigates away, so don't re-render the missing event.
    if (error.code === DB_ERRORS.notFound) return { ok: false, code: "not_found", message: "This event no longer exists." };
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
