import { describe, expect, it } from "vitest";
import { byDay, gridRange, isMonthString, monthGrid, monthOf, shiftMonth } from "@/lib/calendar";

describe("calendar grid", () => {
  it("validates and shifts months", () => {
    expect(isMonthString("2026-10")).toBe(true);
    expect(isMonthString("2026-13")).toBe(false);
    expect(isMonthString("2026-1")).toBe(false);
    expect(monthOf("2026-10-20")).toBe("2026-10");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });

  it("builds Monday-first weeks covering the month", () => {
    const oct = monthGrid("2026-10"); // Oct 1, 2026 is a Thursday
    expect(oct).toHaveLength(5);
    expect(oct[0].map((d) => d.date)).toEqual([
      "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04",
    ]);
    expect(oct[0][2].inMonth).toBe(false);
    expect(oct[0][3].inMonth).toBe(true);
    expect(oct[4][6]).toEqual({ date: "2026-11-01", inMonth: false });
    expect(gridRange("2026-10")).toEqual({ from: "2026-09-28", to: "2026-11-01" });
  });

  it("handles 4- and 6-week months", () => {
    expect(monthGrid("2027-02")).toHaveLength(4); // Feb 2027 starts on a Monday, 28 days
    expect(monthGrid("2026-08")).toHaveLength(6); // Aug 2026 starts Saturday, 31 days
  });

  it("groups by day", () => {
    const g = byDay([{ d: "a", n: 1 }, { d: "b", n: 2 }, { d: "a", n: 3 }], (x) => x.d);
    expect([...g.entries()].map(([k, v]) => [k, v.map((x) => x.n)])).toEqual([["a", [1, 3]], ["b", [2]]]);
  });
});
