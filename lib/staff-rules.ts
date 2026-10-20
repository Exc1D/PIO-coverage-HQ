// Safety rules for staff administration. Pure so they can be unit tested;
// the admin Server Actions enforce them before writing.

import type { Role } from "./constants";
import type { Staff } from "./types";

export type StaffChange =
  | { type: "roles"; roles: Role[] }
  | { type: "active"; active: boolean };

export type RuleResult = { ok: true } | { ok: false; message: string };

const activeHeads = (staff: readonly Staff[]) => staff.filter((s) => s.active && s.roles.includes("head"));

/**
 * Keep the office administrable: nobody deactivates themselves, and there is
 * always at least one active head.
 */
export function checkStaffChange(actorId: string, staff: readonly Staff[], targetId: string, change: StaffChange): RuleResult {
  const target = staff.find((s) => s.id === targetId);
  if (!target) return { ok: false, message: "That staff member no longer exists." };

  if (change.type === "active") {
    if (!change.active && targetId === actorId) {
      return { ok: false, message: "You can’t deactivate yourself. Ask another head to do it." };
    }
    if (!change.active && target.active && target.roles.includes("head") && activeHeads(staff).length === 1) {
      return { ok: false, message: "This is the only active head. Make someone else head first." };
    }
    return { ok: true };
  }

  if (change.roles.length === 0) return { ok: false, message: "Pick at least one role." };
  const losesHead = target.roles.includes("head") && !change.roles.includes("head");
  if (losesHead && target.active && activeHeads(staff).length === 1) {
    return { ok: false, message: "This is the only active head. Make someone else head first." };
  }
  return { ok: true };
}
