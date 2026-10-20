import "server-only";
import { db } from "@/lib/db/server";

/** How many hits this key has in the window (newest first, capped). */
export async function recentHits(bucket: string, keyHash: string, windowMs: number): Promise<number> {
  const since = new Date(Date.now() - windowMs).toISOString();
  const { count, error } = await db()
    .from("rate_limit_hits")
    .select("id", { count: "exact", head: true })
    .eq("bucket", bucket)
    .eq("key_hash", keyHash)
    .gt("created_at", since);
  if (error) throw new Error(`Rate limit check failed: ${error.message}`);
  return count ?? 0;
}

export async function recordHit(bucket: string, keyHash: string): Promise<void> {
  const { error } = await db().from("rate_limit_hits").insert({ bucket, key_hash: keyHash });
  if (error) throw new Error(`Rate limit write failed: ${error.message}`);
}
