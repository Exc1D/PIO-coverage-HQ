import { describe, expect, it } from "vitest";
import {
  eventsInMonth,
  monthLabel,
  monthParam,
  monthsEnding,
  monthsRange,
  monthSummaries,
  mySlots,
  shiftMonth,
  slotCounts,
  type MyEvent,
} from "@/lib/my-work";

const ME = "me";
const now = new Date("2026-10-20T04:00:00Z"); // Tue Oct 20, noon in Manila

const ev = (p: Partial<MyEvent> & { event_date: string }): MyEvent => ({
  id: p.event_date + (p.start_time ?? ""),
  start_time: null,
  status: "scheduled",
  photographer_id: null,
  videographer_id: null,
  editor_id: null,
  writer_id: null,
  proofreader_id: null,
  ...p,
});

describe("mySlots", () => {
  it("lists every slot the person fills, in slot order", () => {
    expect(mySlots(ev({ event_date: "2026-10-01", writer_id: ME, photographer_id: ME, proofreader_id: "x" }), ME)).toEqual([
      "photographer",
      "writer",
    ]);
    expect(mySlots(ev({ event_date: "2026-10-01" }), ME)).toEqual([]);
  });
});

describe("months", () => {
  it("shifts across year boundaries", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-10", -12)).toBe("2025-10");
  });
  it("lists the months ending with one, oldest first", () => {
    expect(monthsEnding("2026-02", 4)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
  it("covers whole months", () => {
    expect(monthsRange(["2026-01", "2026-02"])).toEqual({ from: "2026-01-01", to: "2026-02-28" });
  });
  it("labels months", () => {
    expect(monthLabel("2026-10")).toBe("October 2026");
    expect(monthLabel("2026-10", "MMM")).toBe("Oct");
  });
});

describe("monthParam", () => {
  it("defaults to the current Manila month", () => {
    expect(monthParam(undefined, now)).toBe("2026-10");
    // 23:30 UTC on Oct 31 is already Nov 1 in Manila.
    expect(monthParam(undefined, new Date("2026-10-31T23:30:00Z"))).toBe("2026-11");
  });
  it("accepts past months, including arrays from repeated params", () => {
    expect(monthParam("2026-03", now)).toBe("2026-03");
    expect(monthParam(["2025-12", "2026-01"], now)).toBe("2025-12");
  });
  it("falls back for bad, future or out-of-range months", () => {
    for (const bad of ["2026-13", "2026-00", "2026-1", "nonsense", "2026-11", "1999-12", ""]) {
      expect(monthParam(bad, now)).toBe("2026-10");
    }
  });
});

describe("summaries and lists", () => {
  const events = [
    ev({ event_date: "2026-09-03", status: "posted", writer_id: ME }),
    ev({ event_date: "2026-09-10", status: "cancelled", writer_id: ME }),
    ev({ event_date: "2026-10-05", start_time: "14:00", photographer_id: ME, writer_id: ME }),
    ev({ event_date: "2026-10-05", start_time: "09:00", status: "posted", proofreader_id: ME }),
    ev({ event_date: "2026-10-02", videographer_id: ME }),
    ev({ event_date: "2026-10-05", editor_id: ME }),
  ];

  it("counts held and posted events per month, ignoring cancelled", () => {
    expect(monthSummaries(events, ["2026-08", "2026-09", "2026-10"])).toEqual([
      { month: "2026-08", events: 0, posted: 0 },
      { month: "2026-09", events: 1, posted: 1 },
      { month: "2026-10", events: 4, posted: 1 },
    ]);
  });

  it("lists a month's events by date then time, untimed last", () => {
    expect(eventsInMonth(events, "2026-10").map((e) => e.id)).toEqual(["2026-10-02", "2026-10-0509:00", "2026-10-0514:00", "2026-10-05"]);
    expect(eventsInMonth(events, "2026-09")).toHaveLength(2);
  });

  it("counts slots filled, skipping cancelled events and unused slots", () => {
    expect(slotCounts(eventsInMonth(events, "2026-09"), ME)).toEqual([{ slot: "writer", count: 1 }]);
    expect(slotCounts(eventsInMonth(events, "2026-10"), ME)).toEqual([
      { slot: "photographer", count: 1 },
      { slot: "videographer", count: 1 },
      { slot: "editor", count: 1 },
      { slot: "writer", count: 1 },
      { slot: "proofreader", count: 1 },
    ]);
  });
});
