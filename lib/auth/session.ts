import "server-only";
import { jwtVerify, SignJWT } from "jose";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import type { Role } from "@/lib/constants";
import { getStaffAuthRecord } from "@/lib/data/staff";
import { env } from "@/lib/env";
import type { Staff } from "@/lib/types";

export const SESSION_COOKIE = "pio_session";
const MAX_AGE_SECONDS = 8 * 60 * 60;

const key = () => new TextEncoder().encode(env().SESSION_SECRET);

export async function createSession(staffId: string, sessionVersion: number): Promise<void> {
  const token = await new SignJWT({ sv: sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(staffId)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(key());

  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Read our cookie from the raw request header. */
function cookieFromHeader(header: string | null, name: string): string | undefined {
  for (const part of header?.split(";") ?? []) {
    const eq = part.indexOf("=");
    if (eq > -1 && part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}

async function readToken(): Promise<{ staffId: string; sv: number } | null> {
  // Read via headers() rather than cookies(): in Next 16.4 dev mode, calling
  // cookies() while rendering a Server Action response throws an internal
  // invariant ("underlying cookies object does not match"). Writes still use
  // cookies(); every write that changes the session is followed by a redirect.
  const token = cookieFromHeader((await headers()).get("cookie"), SESSION_COOKIE);
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string" || typeof payload.sv !== "number") return null;
    return { staffId: payload.sub, sv: payload.sv };
  } catch {
    return null;
  }
}

/**
 * The signed-in staff member, re-read from the database on every request so
 * deactivation, role changes and PIN resets take effect immediately.
 */
export const getCurrentStaff = cache(async (): Promise<Staff | null> => {
  const token = await readToken();
  if (!token) return null;
  const record = await getStaffAuthRecord(token.staffId);
  if (!record || !record.active || record.session_version !== token.sv) return null;
  return {
    id: record.id,
    full_name: record.full_name,
    display_name: record.display_name,
    roles: record.roles as Role[],
    active: record.active,
  };
});

export class AuthError extends Error {
  constructor(message = "Your session has expired. Sign in with your PIN again.") {
    super(message);
    this.name = "AuthError";
  }
}

/** For Server Actions: the actor, or throw. */
export async function requireStaff(): Promise<Staff> {
  const staff = await getCurrentStaff();
  if (!staff) throw new AuthError();
  return staff;
}

export async function requireHead(): Promise<Staff> {
  const staff = await requireStaff();
  if (!staff.roles.includes("head")) throw new AuthError("Only the head can do this.");
  return staff;
}
