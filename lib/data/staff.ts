import "server-only";
import { connection } from "next/server";
import { db } from "@/lib/db/server";
import { SLOTS } from "@/lib/constants";
import type { OpenAssignment, Staff } from "@/lib/types";

const PUBLIC_COLUMNS = "id, full_name, display_name, roles, active";

/** Staff for pickers and labels. Never includes PIN hashes. */
export async function listStaff(opts: { activeOnly?: boolean } = {}): Promise<Staff[]> {
  await connection();
  let q = db().from("staff").select(PUBLIC_COLUMNS).order("display_name");
  if (opts.activeOnly) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw new Error(`Could not load staff: ${error.message}`);
  return data as Staff[];
}

/** Staff who appear anywhere in the record; their accounts can't be deleted, only deactivated. */
export async function staffWithHistory(): Promise<Set<string>> {
  await connection();
  const { data, error } = await db().rpc("staff_with_history");
  if (error) throw new Error(`Could not check staff history: ${error.message}`);
  return new Set(data as string[]);
}

/** Unfinished events each person is assigned to, soonest first. */
export async function openAssignments(): Promise<Map<string, OpenAssignment[]>> {
  await connection();
  const cols = SLOTS.map((s) => `${s}_id`);
  const { data, error } = await db()
    .from("events")
    .select("id, title, event_date, photographer_id, videographer_id, editor_id, writer_id, proofreader_id")
    .not("status", "in", "(posted,cancelled)")
    .or(cols.map((c) => `${c}.not.is.null`).join(","))
    .order("event_date");
  if (error) throw new Error(`Could not load assignments: ${error.message}`);
  const out = new Map<string, OpenAssignment[]>();
  for (const e of data as unknown as (OpenAssignment & Record<string, string | null>)[]) {
    // One entry per person even if they fill two slots on the same event.
    for (const id of new Set(cols.map((c) => e[c]).filter((v): v is string => !!v))) {
      const list = out.get(id) ?? [];
      list.push({ id: e.id, title: e.title, event_date: e.event_date });
      out.set(id, list);
    }
  }
  return out;
}

export async function staffCount(): Promise<number> {
  await connection();
  const { count, error } = await db().from("staff").select("id", { count: "exact", head: true });
  if (error) throw new Error(`Could not count staff: ${error.message}`);
  return count ?? 0;
}

export type StaffAuthRecord = Staff & { pin_hash: string; session_version: number };

/** Internal: includes the PIN hash. Only auth code may call this. */
export async function getStaffAuthRecord(id: string): Promise<StaffAuthRecord | null> {
  await connection();
  const { data, error } = await db()
    .from("staff")
    .select(`${PUBLIC_COLUMNS}, pin_hash, session_version`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Could not load staff: ${error.message}`);
  return (data as StaffAuthRecord | null) ?? null;
}
