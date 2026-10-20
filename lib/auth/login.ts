import "server-only";
import { db } from "@/lib/db/server";
import { getStaffAuthRecord } from "@/lib/data/staff";
import { clientIpHash } from "./ip";
import {
  IP_THRESHOLD,
  LOCKOUT_WINDOW_MS,
  STAFF_THRESHOLD,
  lockoutState,
  minutesUntil,
  type Attempt,
} from "./lockout";
import { verifyAgainstDummy, verifyPin } from "./pin";
import { createSession } from "./session";

export type LoginResult = { ok: true } | { ok: false; message: string };

const WRONG = "That PIN didn't match. Check the name and try again.";

type AttemptRow = { success: boolean; cleared_by_id: string | null; created_at: string };

async function recentAttempts(column: "staff_id" | "ip_hash", value: string, now: Date): Promise<Attempt[]> {
  const { data, error } = await db()
    .from("pin_attempts")
    .select("success, cleared_by_id, created_at")
    .eq(column, value)
    .gt("created_at", new Date(now.getTime() - LOCKOUT_WINDOW_MS).toISOString())
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Could not check sign-in attempts: ${error.message}`);
  return (data as AttemptRow[]).map((r) => ({
    success: r.success,
    cleared: r.cleared_by_id !== null,
    created_at: r.created_at,
  }));
}

function lockedMessage(until: Date, now: Date): string {
  const m = minutesUntil(until, now);
  return `Too many wrong PINs. Try again in ${m} minute${m === 1 ? "" : "s"}, or ask the head to clear the lock.`;
}

/** Verify a PIN with lockout, record the attempt, and start a session on success. */
export async function attemptLogin(staffId: string, pin: string): Promise<LoginResult> {
  const now = new Date();
  const ipHash = await clientIpHash();

  const ipState = lockoutState(await recentAttempts("ip_hash", ipHash, now), now, IP_THRESHOLD);
  if (ipState.locked) return { ok: false, message: lockedMessage(ipState.until, now) };

  const staff = await getStaffAuthRecord(staffId);
  if (!staff || !staff.active) {
    await verifyAgainstDummy(pin);
    // Still counts against the IP.
    await db().from("pin_attempts").insert({ staff_id: null, ip_hash: ipHash, success: false });
    return { ok: false, message: WRONG };
  }

  const staffState = lockoutState(await recentAttempts("staff_id", staff.id, now), now, STAFF_THRESHOLD);
  if (staffState.locked) return { ok: false, message: lockedMessage(staffState.until, now) };

  const success = await verifyPin(pin, staff.pin_hash);
  const { error } = await db().from("pin_attempts").insert({ staff_id: staff.id, ip_hash: ipHash, success });
  if (error) throw new Error(`Could not record sign-in attempt: ${error.message}`);

  if (!success) {
    if (staffState.failures + 1 >= STAFF_THRESHOLD) {
      return { ok: false, message: lockedMessage(new Date(now.getTime() + LOCKOUT_WINDOW_MS), now) };
    }
    return { ok: false, message: WRONG };
  }

  await createSession(staff.id, staff.session_version);
  // Occasional housekeeping on successful sign-ins keeps the security tables small.
  if (Math.random() < 0.1) await pruneSecurityLogs(now).catch((e) => console.error("prune failed", e));
  return { ok: true };
}

/** Head action: reset a staff member's failure count. */
export async function clearLockout(staffId: string, clearedById: string): Promise<void> {
  const { error } = await db()
    .from("pin_attempts")
    .insert({ staff_id: staffId, ip_hash: "admin-clear", success: false, cleared_by_id: clearedById });
  if (error) throw new Error(`Could not clear the lock: ${error.message}`);
}

/** Staff currently locked out of PIN sign-in, with when the lock lifts. */
export async function lockedStaff(now = new Date()): Promise<Map<string, Date>> {
  const { data, error } = await db()
    .from("pin_attempts")
    .select("staff_id, success, cleared_by_id, created_at")
    .not("staff_id", "is", null)
    .gt("created_at", new Date(now.getTime() - LOCKOUT_WINDOW_MS).toISOString());
  if (error) throw new Error(`Could not check locks: ${error.message}`);
  const byStaff = new Map<string, Attempt[]>();
  for (const r of data as (AttemptRow & { staff_id: string })[]) {
    const list = byStaff.get(r.staff_id) ?? [];
    list.push({ success: r.success, cleared: r.cleared_by_id !== null, created_at: r.created_at });
    byStaff.set(r.staff_id, list);
  }
  const out = new Map<string, Date>();
  for (const [id, attempts] of byStaff) {
    const s = lockoutState(attempts, now, STAFF_THRESHOLD);
    if (s.locked) out.set(id, s.until);
  }
  return out;
}

/** Housekeeping: drop sign-in attempts older than 30 days and rate-limit hits older than 2 days. */
export async function pruneSecurityLogs(now = new Date()): Promise<void> {
  const day = 86_400_000;
  await Promise.all([
    db().from("pin_attempts").delete().lt("created_at", new Date(now.getTime() - 30 * day).toISOString()),
    db().from("rate_limit_hits").delete().lt("created_at", new Date(now.getTime() - 2 * day).toISOString()),
  ]);
}
