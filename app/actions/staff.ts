"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { clearLockout } from "@/lib/auth/login";
import { hashPin, pinSchema } from "@/lib/auth/pin";
import { AuthError, createSession, requireHead } from "@/lib/auth/session";
import { ROLES, type Role } from "@/lib/constants";
import { db } from "@/lib/db/server";
import { listStaff } from "@/lib/data/staff";
import { checkStaffChange } from "@/lib/staff-rules";
import type { Staff } from "@/lib/types";

export type StaffFormState =
  | { ok: true; message: string }
  | { ok?: false; error?: string; fieldErrors?: Record<string, string>; values?: Record<string, string | string[]> }
  | undefined;

export type SimpleResult = { ok: true; message: string } | { ok: false; message: string };

const UNIQUE_VIOLATION = "23505";

async function head(): Promise<Staff | { error: string }> {
  try {
    return await requireHead();
  } catch (e) {
    if (e instanceof AuthError) return { error: e.message };
    throw e;
  }
}

function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of error.issues) out[String(i.path[0])] ??= i.message;
  return out;
}

const namesSchema = z.object({
  full_name: z.string().trim().min(1, "Enter the full name.").max(120),
  display_name: z.string().trim().min(1, "Enter a short display name, e.g. “Ana R.”").max(40),
  roles: z.array(z.enum(ROLES)).min(1, "Pick at least one role."),
});

const pinPair = z
  .object({ pin: pinSchema, confirm_pin: z.string() })
  .refine((v) => v.pin === v.confirm_pin, { path: ["confirm_pin"], message: "The PINs don't match." });

function readForm(formData: FormData) {
  return {
    full_name: String(formData.get("full_name") ?? ""),
    display_name: String(formData.get("display_name") ?? ""),
    roles: formData.getAll("roles").map(String),
    pin: String(formData.get("pin") ?? ""),
    confirm_pin: String(formData.get("confirm_pin") ?? ""),
  };
}

const keepValues = (r: ReturnType<typeof readForm>) => ({ full_name: r.full_name, display_name: r.display_name, roles: r.roles });

export async function createStaffAction(_prev: StaffFormState, formData: FormData): Promise<StaffFormState> {
  const me = await head();
  if ("error" in me) return { error: me.error };
  const raw = readForm(formData);
  const parsed = namesSchema.and(pinPair).safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values: keepValues(raw) };

  const { error } = await db().from("staff").insert({
    full_name: parsed.data.full_name,
    display_name: parsed.data.display_name,
    roles: parsed.data.roles,
    pin_hash: await hashPin(parsed.data.pin),
  });
  if (error) {
    if (error.code === UNIQUE_VIOLATION) return { fieldErrors: { display_name: "Someone already uses that display name." }, values: keepValues(raw) };
    console.error("create staff failed", error.code, error.message);
    return { error: "Couldn’t add this person. Please try again.", values: keepValues(raw) };
  }
  refresh();
  return { ok: true, message: `${parsed.data.display_name} added. Give them their PIN in person.` };
}

export async function updateStaffAction(staffId: string, _prev: StaffFormState, formData: FormData): Promise<StaffFormState> {
  const me = await head();
  if ("error" in me) return { error: me.error };
  const raw = readForm(formData);
  const parsed = namesSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values: keepValues(raw) };

  const rule = checkStaffChange(me.id, await listStaff(), staffId, { type: "roles", roles: parsed.data.roles as Role[] });
  if (!rule.ok) return { error: rule.message, values: keepValues(raw) };

  const { error } = await db()
    .from("staff")
    .update({ full_name: parsed.data.full_name, display_name: parsed.data.display_name, roles: parsed.data.roles })
    .eq("id", staffId);
  if (error) {
    if (error.code === UNIQUE_VIOLATION) return { fieldErrors: { display_name: "Someone already uses that display name." }, values: keepValues(raw) };
    console.error("update staff failed", error.code, error.message);
    return { error: "Couldn’t save the changes. Please try again.", values: keepValues(raw) };
  }
  refresh();
  return { ok: true, message: `${parsed.data.display_name} updated.` };
}

/**
 * Apply `changes` and bump session_version in one UPDATE, so every existing
 * session for this person ends now and a failure can't leave half the change
 * applied (e.g. a new PIN with old sessions still valid).
 */
async function updateAndRevoke(staffId: string, changes: Record<string, unknown>): Promise<number> {
  const { data, error } = await db().from("staff").select("session_version").eq("id", staffId).single<{ session_version: number }>();
  if (error) throw new Error(`Could not load staff: ${error.message}`);
  const next = data.session_version + 1;
  const { error: upd } = await db().from("staff").update({ ...changes, session_version: next }).eq("id", staffId);
  if (upd) throw new Error(`Could not update staff: ${upd.message}`);
  return next;
}

export async function resetPinAction(staffId: string, _prev: StaffFormState, formData: FormData): Promise<StaffFormState> {
  const me = await head();
  if ("error" in me) return { error: me.error };
  const parsed = pinPair.safeParse(readForm(formData));
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  if (!z.uuid().safeParse(staffId).success) return { error: "Invalid request." };

  let version: number;
  try {
    version = await updateAndRevoke(staffId, { pin_hash: await hashPin(parsed.data.pin) });
  } catch (e) {
    console.error("reset PIN failed", e);
    return { error: "Couldn’t reset the PIN. Please try again." };
  }
  await clearLockout(staffId, me.id);
  // Resetting your own PIN keeps you signed in on this device.
  if (staffId === me.id) await createSession(me.id, version);
  refresh();
  return { ok: true, message: "PIN reset. They’ve been signed out everywhere and any lock is cleared." };
}

export async function setActiveAction(staffId: string, active: boolean): Promise<SimpleResult> {
  const me = await head();
  if ("error" in me) return { ok: false, message: me.error };
  const rule = checkStaffChange(me.id, await listStaff(), staffId, { type: "active", active });
  if (!rule.ok) return { ok: false, message: rule.message };

  try {
    if (active) {
      const { error } = await db().from("staff").update({ active: true }).eq("id", staffId);
      if (error) throw new Error(error.message);
    } else {
      await updateAndRevoke(staffId, { active: false });
    }
  } catch (e) {
    console.error("set active failed", e);
    return { ok: false, message: "Couldn’t save the change. Please try again." };
  }
  refresh();
  return { ok: true, message: active ? "Reactivated." : "Deactivated and signed out. Their past work still counts in reports." };
}

export async function clearLockAction(staffId: string): Promise<SimpleResult> {
  const me = await head();
  if ("error" in me) return { ok: false, message: me.error };
  if (!z.uuid().safeParse(staffId).success) return { ok: false, message: "Invalid request." };
  await clearLockout(staffId, me.id);
  refresh();
  return { ok: true, message: "Lock cleared. They can sign in again." };
}
