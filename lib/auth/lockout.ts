// Brute-force protection rules. Pure so they can be unit tested.

export const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
/** Failed PINs for one staff member before they are locked out. */
export const STAFF_THRESHOLD = 5;
/** Failed PINs from one IP (any staff) before it is locked out. Higher, for shared office Wi-Fi. */
export const IP_THRESHOLD = 20;

export type Attempt = {
  success: boolean;
  /** True for a head-issued "clear lockout" row. */
  cleared: boolean;
  created_at: string;
};

export type LockoutState = { locked: false; failures: number } | { locked: true; failures: number; until: Date };

/**
 * Failures inside the window (and after the most recent success or clear)
 * count. Once they reach the threshold the subject is locked until enough of
 * them age out of the window to drop below it again.
 */
export function lockoutState(attempts: readonly Attempt[], now: Date, threshold: number): LockoutState {
  const since = now.getTime() - LOCKOUT_WINDOW_MS;
  const recent = attempts
    .map((a) => ({ ...a, t: new Date(a.created_at).getTime() }))
    .filter((a) => a.t > since)
    .sort((a, b) => a.t - b.t);

  let failures: number[] = [];
  for (const a of recent) {
    if (a.success || a.cleared) failures = [];
    else failures.push(a.t);
  }

  if (failures.length < threshold) return { locked: false, failures: failures.length };
  const until = new Date(failures[failures.length - threshold] + LOCKOUT_WINDOW_MS);
  return { locked: true, failures: failures.length, until };
}

/** "14 minutes" style wait message. */
export function minutesUntil(until: Date, now: Date): number {
  return Math.max(1, Math.ceil((until.getTime() - now.getTime()) / 60_000));
}
