import { describe, expect, it } from "vitest";
import { findStaffByName } from "@/lib/auth/name-match";

const grace = { id: "1", full_name: "Grace Santos", display_name: "Grace S." };
const rico = { id: "2", full_name: "Rico Mendoza", display_name: "Rico M." };
const rico2 = { id: "3", full_name: "Rico Mendoza", display_name: "Rico Me." };
const staff = [grace, rico, rico2];

describe("findStaffByName", () => {
  it("accepts the short or full name, ignoring case and extra spaces", () => {
    expect(findStaffByName(staff, "Grace S.")).toBe(grace);
    expect(findStaffByName(staff, "  grace   santos ")).toBe(grace);
  });

  it("finds nobody for an unknown or partial name", () => {
    expect(findStaffByName(staff, "Grace")).toBeNull();
    expect(findStaffByName(staff, "Nobody")).toBeNull();
    expect(findStaffByName(staff, "")).toBeNull();
  });

  it("refuses a full name two people share, but their short names still work", () => {
    expect(findStaffByName(staff, "Rico Mendoza")).toBeNull();
    expect(findStaffByName(staff, "Rico Me.")).toBe(rico2);
  });
});
