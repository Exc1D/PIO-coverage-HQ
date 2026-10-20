import { describe, expect, it } from "vitest";
import { dashboardPeriod, reportPeriod } from "@/lib/period-params";

const now = new Date("2026-10-20T04:00:00Z"); // Tue Oct 20, noon in Manila

describe("dashboardPeriod", () => {
  it("defaults to this week", () => {
    expect(dashboardPeriod({}, now)).toMatchObject({ kind: "week", startDate: "2026-10-19" });
    expect(dashboardPeriod({ period: "nonsense" }, now).kind).toBe("week");
  });
  it("this month", () => expect(dashboardPeriod({ period: "month" }, now).startDate).toBe("2026-10-01"));
  it("custom range, validated", () => {
    expect(dashboardPeriod({ period: "custom", from: "2026-10-01", to: "2026-10-10" }, now)).toMatchObject({
      kind: "custom",
      endDate: "2026-10-10",
    });
    expect(dashboardPeriod({ period: "custom", from: "2026-10-10", to: "2026-10-01" }, now).kind).toBe("week");
    expect(dashboardPeriod({ period: "custom", from: "2026-10-10" }, now).kind).toBe("week");
    expect(dashboardPeriod({ period: ["custom"], from: ["bad"], to: ["2026-10-01"] }, now).kind).toBe("week");
  });
});

describe("reportPeriod", () => {
  it("defaults to the current month", () => expect(reportPeriod({}, now)).toMatchObject({ kind: "month", startDate: "2026-10-01" }));
  it("week containing a date", () =>
    expect(reportPeriod({ kind: "week", date: "2026-10-01" }, now)).toMatchObject({ startDate: "2026-09-28", endDate: "2026-10-04" }));
  it("month containing a date; bad dates fall back to today", () => {
    expect(reportPeriod({ kind: "month", date: "2026-02-14" }, now).endDate).toBe("2026-02-28");
    expect(reportPeriod({ kind: "month", date: "2026-02-31" }, now).startDate).toBe("2026-10-01");
  });
});
