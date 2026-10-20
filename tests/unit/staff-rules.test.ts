import { describe, expect, it } from "vitest";
import { checkStaffChange } from "@/lib/staff-rules";
import type { Staff } from "@/lib/types";

const s = (id: string, roles: Staff["roles"], active = true): Staff => ({ id, full_name: id, display_name: id, roles, active });
const grace = s("grace", ["head", "proofreader"]);
const joel = s("joel", ["proofreader", "page_admin"]);
const old = s("old", ["head"], false);

describe("staff admin rules", () => {
  it("nobody deactivates themselves", () => {
    expect(checkStaffChange("joel", [grace, joel], "joel", { type: "active", active: false })).toMatchObject({ ok: false });
  });
  it("the last active head stays", () => {
    const staff = [grace, joel, old];
    expect(checkStaffChange("joel", staff, "grace", { type: "active", active: false })).toMatchObject({ ok: false });
    expect(checkStaffChange("grace", staff, "grace", { type: "roles", roles: ["proofreader"] })).toMatchObject({ ok: false });
    // With a second active head, both are allowed
    const two = [grace, { ...joel, roles: ["head" as const] }];
    expect(checkStaffChange("joel", two, "grace", { type: "active", active: false })).toEqual({ ok: true });
    expect(checkStaffChange("grace", two, "grace", { type: "roles", roles: ["proofreader"] })).toEqual({ ok: true });
  });
  it("ordinary changes pass; inactive heads and reactivation are fine", () => {
    const staff = [grace, joel, old];
    expect(checkStaffChange("grace", staff, "joel", { type: "active", active: false })).toEqual({ ok: true });
    expect(checkStaffChange("grace", staff, "old", { type: "active", active: true })).toEqual({ ok: true });
    expect(checkStaffChange("grace", staff, "old", { type: "roles", roles: ["writer"] })).toEqual({ ok: true });
    expect(checkStaffChange("grace", staff, "joel", { type: "roles", roles: ["writer", "head"] })).toEqual({ ok: true });
  });
  it("rejects empty roles and unknown people", () => {
    expect(checkStaffChange("grace", [grace, joel], "joel", { type: "roles", roles: [] })).toEqual({ ok: false, message: "Pick at least one role." });
    expect(checkStaffChange("grace", [grace], "ghost", { type: "active", active: false })).toMatchObject({ ok: false });
  });
});
