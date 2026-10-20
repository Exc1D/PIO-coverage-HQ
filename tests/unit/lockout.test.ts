import { describe, expect, it } from "vitest";
import { IP_THRESHOLD, STAFF_THRESHOLD, lockoutState, minutesUntil, type Attempt } from "@/lib/auth/lockout";

const NOW = new Date("2026-10-20T04:00:00Z");
const ago = (min: number) => new Date(NOW.getTime() - min * 60_000).toISOString();
const fail = (min: number): Attempt => ({ success: false, cleared: false, created_at: ago(min) });
const ok = (min: number): Attempt => ({ success: true, cleared: false, created_at: ago(min) });
const cleared = (min: number): Attempt => ({ success: false, cleared: true, created_at: ago(min) });

describe("lockout", () => {
  it("thresholds are 5 per staff and 20 per IP", () => {
    expect(STAFF_THRESHOLD).toBe(5);
    expect(IP_THRESHOLD).toBe(20);
  });

  it("is unlocked below the threshold", () => {
    expect(lockoutState([fail(1), fail(2), fail(3), fail(4)], NOW, 5)).toEqual({ locked: false, failures: 4 });
    expect(lockoutState([], NOW, 5)).toEqual({ locked: false, failures: 0 });
  });

  it("locks after 5 failures, for 15 minutes from the 5th-latest failure", () => {
    const s = lockoutState([fail(1), fail(2), fail(3), fail(4), fail(5)], NOW, 5);
    expect(s.locked).toBe(true);
    if (s.locked) {
      expect(s.until.toISOString()).toBe(new Date(NOW.getTime() + 10 * 60_000).toISOString());
      expect(minutesUntil(s.until, NOW)).toBe(10);
    }
  });

  it("ignores failures older than 15 minutes", () => {
    expect(lockoutState([fail(1), fail(2), fail(3), fail(4), fail(16)], NOW, 5).locked).toBe(false);
  });

  it("a success or a head clear resets the count", () => {
    expect(lockoutState([fail(1), fail(2), ok(3), fail(4), fail(5), fail(6)], NOW, 5).failures).toBe(2);
    expect(lockoutState([fail(1), cleared(2), fail(3), fail(4), fail(5), fail(6)], NOW, 5).locked).toBe(false);
  });

  it("minutesUntil never reports less than a minute", () => {
    expect(minutesUntil(new Date(NOW.getTime() - 1000), NOW)).toBe(1);
  });
});
