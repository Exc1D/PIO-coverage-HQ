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

export async function recordHit(bucket: string, keyHash: string): Promise<number> {
  const { data, error } = await db().from("rate_limit_hits").insert({ bucket, key_hash: keyHash }).select("id").single<{ id: number }>();
  if (error) throw new Error(`Rate limit write failed: ${error.message}`);
  return data.id;
}

/**
 * Take one slot: record the hit first, then count. Concurrent callers see
 * each other's hits, so at most `limit` succeed per window even in a burst.
 * Returns the slot's id (release it if the guarded work fails), or null when
 * refused; a refused hit is removed so it doesn't keep extending the block.
 */
export async function takeSlot(bucket: string, keyHash: string, limit: number, windowMs: number): Promise<number | null> {
  const id = await recordHit(bucket, keyHash);
  if ((await recentHits(bucket, keyHash, windowMs)) <= limit) return id;
  await releaseSlot(id);
  return null;
}

export async function releaseSlot(id: number): Promise<void> {
  await db().from("rate_limit_hits").delete().eq("id", id);
}
