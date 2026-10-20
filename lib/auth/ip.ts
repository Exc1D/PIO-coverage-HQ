import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { env } from "@/lib/env";

/** Best-effort client IP (Vercel sets x-forwarded-for / x-real-ip). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip")?.trim() || "unknown";
}

/** Keyed hash so raw IP addresses (personal data under RA 10173) are never stored. */
export function hashIp(ip: string): string {
  return createHmac("sha256", env().SESSION_SECRET).update(`ip:${ip}`).digest("hex");
}

export async function clientIpHash(): Promise<string> {
  return hashIp(await clientIp());
}
