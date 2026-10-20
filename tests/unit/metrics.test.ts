import { describe, expect, it } from "vitest";
import {
  PIPELINE_STATUSES,
  countsAsCovered,
  countsAsPost,
  creditsByPerson,
  currentPeriod,
  customPeriod,
  dateInPeriod,
  inPipeline,
  instantInPeriod,
  isStuck,
  monthPeriod,
  needsAssignment,
  pipelineCounts,
  postsBySource,
  postsInPeriod,
  summarize,
  weekPeriod,
  type MetricEvent,
} from "@/lib/metrics";
import { addDays } from "@/lib/time";

function ev(o: Partial<MetricEvent> = {}): MetricEvent {
  const event_date = o.event_date ?? "2026-10-10";
  return {
    status: "posted",
    event_date,
    due_date: addDays(event_date, 2),
    posted_at: "2026-10-11T02:00:00Z",
    source: "provincial_government",
    photographer_id: "rico",
    videographer_id: null,
    writer_id: "ana",
    proofreader_id: "grace",
    ...o,
  };
}

describe("periods", () => {
  it("week runs Monday–Sunday in Manila", () => {
    const p = weekPeriod("2026-10-21"); // Wednesday
    expect(p).toMatchObject({ kind: "week", startDate: "2026-10-19", endDate: "2026-10-25" });
    expect(p.start.toISOString()).toBe("2026-10-18T16:00:00.000Z"); // Mon 00:00 +08:00
    expect(p.end.toISOString()).toBe("2026-10-25T16:00:00.000Z"); // next Mon 00:00 +08:00
    expect(p.label).toBe("Week of Oct 19, 2026");
    expect(weekPeriod("2026-10-25").startDate).toBe("2026-10-19"); // Sunday belongs to the same week
    expect(weekPeriod("2026-10-19").startDate).toBe("2026-10-19");
  });

  it("month covers the whole calendar month", () => {
    const p = monthPeriod("2026-02-14");
    expect(p).toMatchObject({ kind: "month", startDate: "2026-02-01", endDate: "2026-02-28", label: "February 2026" });
    expect(monthPeriod("2028-02-03").endDate).toBe("2028-02-29");
    expect(monthPeriod("2026-12-31").end.toISOString()).toBe("2026-12-31T16:00:00.000Z");
  });

  it("custom range is inclusive and validated", () => {
    const p = customPeriod("2026-10-01", "2026-10-15");
    expect(p.label).toBe("Oct 1, 2026 – Oct 15, 2026");
    expect(dateInPeriod("2026-10-15", p)).toBe(true);
    expect(dateInPeriod("2026-10-16", p)).toBe(false);
    expect(dateInPeriod("2026-09-30", p)).toBe(false);
    expect(() => customPeriod("2026-10-15", "2026-10-01")).toThrow(RangeError);
    expect(() => customPeriod("2026-13-01", "2026-10-01")).toThrow(RangeError);
    expect(() => customPeriod("2026-10-01", "nope")).toThrow(RangeError);
  });

  it("current week/month use the Manila date of now", () => {
    // 2026-10-31T16:30Z is already Sunday Nov 1, 00:30 in Manila
    const now = new Date("2026-10-31T16:30:00Z");
    expect(currentPeriod("month", now).startDate).toBe("2026-11-01");
    expect(currentPeriod("week", now).startDate).toBe("2026-10-26");
  });
});

describe("timezone edge cases", () => {
  const october = monthPeriod("2026-10-01");
  const november = monthPeriod("2026-11-01");

  it("11:30 PM Manila on the last day of the month counts in that month", () => {
    const e = ev({ posted_at: "2026-10-31T15:30:00Z" }); // Oct 31 23:30 +08:00
    expect(countsAsPost(e, october)).toBe(true);
    expect(countsAsPost(e, november)).toBe(false);
  });

  it("12:30 AM Manila on the 1st counts in the new month, though UTC is still the 31st", () => {
    const e = ev({ posted_at: "2026-10-31T16:30:00Z" });
    expect(countsAsPost(e, october)).toBe(false);
    expect(countsAsPost(e, november)).toBe(true);
  });

  it("exact boundaries: start inclusive, end exclusive", () => {
    expect(instantInPeriod("2026-09-30T16:00:00Z", october)).toBe(true);
    expect(instantInPeriod("2026-09-30T15:59:59.999Z", october)).toBe(false);
    expect(instantInPeriod("2026-10-31T16:00:00Z", october)).toBe(false);
  });

  it("Sunday 11:59 PM Manila stays in its week", () => {
    const week = weekPeriod("2026-10-19");
    expect(countsAsPost(ev({ posted_at: "2026-10-25T15:59:00Z" }), week)).toBe(true);
    expect(countsAsPost(ev({ posted_at: "2026-10-25T16:00:00Z" }), week)).toBe(false);
  });
});

describe("post counting", () => {
  const october = monthPeriod("2026-10-01");
  it("only posted events with posted_at inside the period", () => {
    expect(countsAsPost(ev(), october)).toBe(true);
    expect(countsAsPost(ev({ status: "scheduled_for_posting" }), october)).toBe(false);
    expect(countsAsPost(ev({ status: "cancelled" }), october)).toBe(false);
    expect(countsAsPost(ev({ posted_at: null }), october)).toBe(false);
    expect(countsAsPost(ev({ posted_at: "2026-11-05T02:00:00Z" }), october)).toBe(false);
  });

  it("splits by source", () => {
    const events = [
      ev(),
      ev({ source: "community" }),
      ev({ source: "community" }),
      ev({ source: "private", status: "approved" }),
      ev({ source: null }),
    ];
    expect(postsInPeriod(events, october)).toHaveLength(4);
    expect(postsBySource(events, october)).toEqual({
      provincial_government: 1,
      other_lgu: 0,
      community: 2,
      private: 0,
    });
  });
});

describe("stuck", () => {
  it("not posted/cancelled and today > due date", () => {
    const e = ev({ status: "in_production", event_date: "2026-10-10" }); // due 10-12
    expect(isStuck(e, "2026-10-12")).toBe(false);
    expect(isStuck(e, "2026-10-13")).toBe(true);
    expect(isStuck({ ...e, status: "posted" }, "2026-10-13")).toBe(false);
    expect(isStuck({ ...e, status: "cancelled" }, "2026-10-13")).toBe(false);
  });
});

describe("needs assignment", () => {
  const today = "2026-10-20";
  const base = ev({ status: "scheduled", event_date: "2026-10-25", posted_at: null });
  it("requested/scheduled within today..today+14 missing writer or media", () => {
    expect(needsAssignment({ ...base, writer_id: null }, today)).toBe(true);
    expect(needsAssignment({ ...base, photographer_id: null, videographer_id: null }, today)).toBe(true);
    expect(needsAssignment({ ...base, photographer_id: null, videographer_id: "paolo" }, today)).toBe(false);
    expect(needsAssignment({ ...base, status: "requested", writer_id: null }, today)).toBe(true);
    expect(needsAssignment(base, today)).toBe(false);
  });
  it("window boundaries and status", () => {
    const missing = { ...base, writer_id: null };
    expect(needsAssignment({ ...missing, event_date: today }, today)).toBe(true);
    expect(needsAssignment({ ...missing, event_date: "2026-11-03" }, today)).toBe(true); // +14
    expect(needsAssignment({ ...missing, event_date: "2026-11-04" }, today)).toBe(false); // +15
    expect(needsAssignment({ ...missing, event_date: "2026-10-19" }, today)).toBe(false); // past
    expect(needsAssignment({ ...missing, status: "covered" }, today)).toBe(false);
  });
});

describe("covered in period and pipeline", () => {
  const october = monthPeriod("2026-10-01");
  it("event_date in period and covered or later", () => {
    expect(countsAsCovered(ev({ status: "covered" }), october)).toBe(true);
    expect(countsAsCovered(ev({ status: "posted" }), october)).toBe(true);
    expect(countsAsCovered(ev({ status: "scheduled" }), october)).toBe(false);
    expect(countsAsCovered(ev({ status: "cancelled" }), october)).toBe(false);
    expect(countsAsCovered(ev({ status: "covered", event_date: "2026-11-01" }), october)).toBe(false);
  });
  it("counts per in-progress status", () => {
    const counts = pipelineCounts([
      ev({ status: "requested" }),
      ev({ status: "requested" }),
      ev({ status: "for_proofreading" }),
      ev({ status: "posted" }),
      ev({ status: "cancelled" }),
    ]);
    expect(Object.keys(counts)).toEqual(PIPELINE_STATUSES);
    expect(counts.requested).toBe(2);
    expect(counts.for_proofreading).toBe(1);
    expect(counts.approved).toBe(0);
    expect(inPipeline(ev({ status: "posted" }))).toBe(false);
  });
});

describe("credits", () => {
  const october = monthPeriod("2026-10-01");
  it("credits each role only for events posted in the period", () => {
    const credits = creditsByPerson(
      [
        ev(),
        ev({ videographer_id: "paolo", writer_id: "liza", proofreader_id: null }),
        ev({ status: "approved" }), // not posted
        ev({ posted_at: "2026-09-30T15:59:00Z" }), // Sep 30 23:59 Manila
        ev({ status: "cancelled" }),
      ],
      october,
    );
    expect(Object.fromEntries(credits)).toEqual({
      ana: { written: 1, proofread: 0, photographed: 0, videographed: 0 },
      liza: { written: 1, proofread: 0, photographed: 0, videographed: 0 },
      grace: { written: 0, proofread: 1, photographed: 0, videographed: 0 },
      rico: { written: 0, proofread: 0, photographed: 2, videographed: 0 },
      paolo: { written: 0, proofread: 0, photographed: 0, videographed: 1 },
    });
  });
  it("one person in several roles gets each credit", () => {
    const c = creditsByPerson([ev({ writer_id: "x", proofreader_id: "x", photographer_id: "x", videographer_id: "x" })], october);
    expect(c.get("x")).toEqual({ written: 1, proofread: 1, photographed: 1, videographed: 1 });
  });
});

describe("summarize", () => {
  it("builds the dashboard numbers", () => {
    const period = monthPeriod("2026-10-01");
    const s = summarize(
      [
        ev(),
        ev({ status: "in_production", event_date: "2026-10-15", posted_at: null }),
        ev({ status: "scheduled", event_date: "2026-10-30", posted_at: null }),
      ],
      period,
      "2026-10-20",
    );
    expect(s).toMatchObject({ postsPublished: 1, eventsCovered: 2, inPipeline: 2, stuck: 1 });
    expect(s.bySource.provincial_government).toBe(1);
    expect(s.pipeline.in_production).toBe(1);
    expect(s.credits.get("ana")?.written).toBe(1);
  });
});
