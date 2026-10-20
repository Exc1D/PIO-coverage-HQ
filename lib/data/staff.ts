import "server-only";
import { connection } from "next/server";
import { db } from "@/lib/db/server";
import type { Staff } from "@/lib/types";

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
