import { describe, expect, it } from "vitest";
import { isStaffOnlyPath } from "@/lib/safe-next";

describe("isStaffOnlyPath", () => {
  it("is true for pages that need a sign-in, with or without a query", () => {
    for (const p of ["/reports", "/reports?month=2026-11", "/needs-assignment", "/admin", "/me"]) {
      expect(isStaffOnlyPath(p)).toBe(true);
    }
  });

  it("is false for pages anyone can view and lookalike paths", () => {
    for (const p of ["/", "/board", "/calendar?month=2026-11", "/events/abc", "/reportsy", "/messages"]) {
      expect(isStaffOnlyPath(p)).toBe(false);
    }
  });
});
