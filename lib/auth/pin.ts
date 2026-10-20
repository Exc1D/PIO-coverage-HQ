import "server-only";
import bcrypt from "bcryptjs";
import { z } from "zod";

const COST = 12;

export const pinSchema = z.string().regex(/^\d{4,6}$/, "PIN must be 4 to 6 digits.");

export function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, COST);
}

export function verifyPin(pin: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pin, hash);
}

let dummy: Promise<string> | null = null;

/** Burn the same time as a real check when the staff member doesn't exist. */
export async function verifyAgainstDummy(pin: string): Promise<false> {
  dummy ??= bcrypt.hash("000000", COST);
  await bcrypt.compare(pin, await dummy);
  return false;
}
