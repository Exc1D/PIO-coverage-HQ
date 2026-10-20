import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { env } from "@/lib/env";

/**
 * Best-effort client IP. Vercel sets x-real-ip itself (clients can't spoof
 * it), so prefer it; x-forwarded-for is only a fallback because hosts that
 * append to it leave the first entry under the client's control.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-real-ip")?.trim() || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/** Keyed hash so raw IP addresses (personal data under RA 10173) are never stored. */
export function hashIp(ip: string): string {
  return createHmac("sha256", env().SESSION_SECRET).update(`ip:${ip}`).digest("hex");
}

export async function clientIpHash(): Promise<string> {
  return hashIp(await clientIp());
}
