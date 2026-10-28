import { describe, expect, it } from "vitest";
import {
  PIPELINE_STATUSES,
  countsAsCovered,
  countsAsPost,
  creditsByPerson,
  currentPeriod,
  customPeriod,
  dateInPeriod,
  daysOverdue,
  nextPeriod,
  postsGroupedBySource,
  previousPeriod,
  upcoming,
  inPipeline,
  instantInPeriod,
  isStuck,
  monthPeriod,
  needsAssignment,
  pipelineCounts,
  postsBySource,
  postsInPeriod,
  summarize,
  teamGaps,
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
    coverage: "regular",
    photographer_id: "rico",
    videographer_id: null,
    editor_id: null,
    writer_id: "ana",
    proofreader_id: "grace",
    cameraman_id: null,
    obs_tech_id: null,
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
      ana: { written: 1, proofread: 0, photographed: 0, videographed: 0, edited: 0, liveCamera: 0, liveObs: 0 },
      liza: { written: 1, proofread: 0, photographed: 0, videographed: 0, edited: 0, liveCamera: 0, liveObs: 0 },
      grace: { written: 0, proofread: 1, photographed: 0, videographed: 0, edited: 0, liveCamera: 0, liveObs: 0 },
      rico: { written: 0, proofread: 0, photographed: 2, videographed: 0, edited: 0, liveCamera: 0, liveObs: 0 },
      paolo: { written: 0, proofread: 0, photographed: 0, videographed: 1, edited: 0, liveCamera: 0, liveObs: 0 },
    });
  });
  it("one person in several roles gets each credit", () => {
    const c = creditsByPerson(
      [
        ev({
          coverage: "live_and_regular",
          writer_id: "x",
          proofreader_id: "x",
          photographer_id: "x",
          videographer_id: "x",
          editor_id: "x",
          cameraman_id: "x",
          obs_tech_id: "x",
        }),
      ],
      october,
    );
    expect(c.get("x")).toEqual({ written: 1, proofread: 1, photographed: 1, videographed: 1, edited: 1, liveCamera: 1, liveObs: 1 });
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

describe("period navigation and lists", () => {
  it("previous/next periods", () => {
    expect(previousPeriod(weekPeriod("2026-10-21")).startDate).toBe("2026-10-12");
    expect(previousPeriod(monthPeriod("2026-03-15"))).toMatchObject({ startDate: "2026-02-01", endDate: "2026-02-28" });
    expect(previousPeriod(customPeriod("2026-10-10", "2026-10-14"))).toMatchObject({
      kind: "custom",
      startDate: "2026-10-05",
      endDate: "2026-10-09",
    });
    expect(nextPeriod(weekPeriod("2026-10-21")).startDate).toBe("2026-10-26");
    expect(nextPeriod(monthPeriod("2026-12-05")).startDate).toBe("2027-01-01");
  });

  it("days overdue", () => {
    expect(daysOverdue({ due_date: "2026-10-12" }, "2026-10-15")).toBe(3);
    expect(daysOverdue({ due_date: "2026-10-16" }, "2026-10-15")).toBe(0);
  });

  it("upcoming: today through 6 days ahead, no cancelled, ordered by date then time", () => {
    const list = upcoming(
      [
        { ...ev({ status: "scheduled", event_date: "2026-10-22" }), start_time: "14:00:00" },
        { ...ev({ status: "scheduled", event_date: "2026-10-22" }), start_time: null },
        { ...ev({ status: "scheduled", event_date: "2026-10-22" }), start_time: "08:00:00" },
        { ...ev({ status: "requested", event_date: "2026-10-20" }), start_time: null },
        { ...ev({ status: "cancelled", event_date: "2026-10-21" }), start_time: null },
        { ...ev({ status: "scheduled", event_date: "2026-10-27" }), start_time: null },
        { ...ev({ status: "scheduled", event_date: "2026-10-19" }), start_time: null },
      ],
      "2026-10-20",
    );
    expect(list.map((e) => `${e.event_date} ${e.start_time}`)).toEqual([
      "2026-10-20 null",
      "2026-10-22 08:00:00",
      "2026-10-22 14:00:00",
      "2026-10-22 null",
    ]);
  });

  it("groups posts by source in fixed order, oldest first, with unknown last", () => {
    const october = monthPeriod("2026-10-01");
    const groups = postsGroupedBySource(
      [
        ev({ source: "private", posted_at: "2026-10-05T02:00:00Z" }),
        ev({ source: "provincial_government", posted_at: "2026-10-09T02:00:00Z" }),
        ev({ source: "provincial_government", posted_at: "2026-10-03T02:00:00Z" }),
        ev({ source: null, posted_at: "2026-10-04T02:00:00Z" }),
        ev({ source: "community", status: "approved" }),
      ],
      october,
    );
    expect(groups.map((g) => [g.source, g.posts.map((p) => p.posted_at!.slice(8, 10))])).toEqual([
      ["provincial_government", ["03", "09"]],
      ["private", ["05"]],
      [null, ["04"]],
    ]);
    expect(postsGroupedBySource([ev({ source: "community" })], october).map((g) => g.source)).toEqual(["community"]);
  });
});

describe("live coverage", () => {
  const today = "2026-10-20";
  const october = monthPeriod("2026-10-01");
  const regular = { photographer_id: null, videographer_id: null, editor_id: null, writer_id: null, proofreader_id: null };

  it("a live stream needs a cameraman and an OBS tech; regular coverage, a writer and photo/video", () => {
    expect(teamGaps(ev({ coverage: "live", ...regular }))).toEqual(["cameraman", "obs_tech"]);
    expect(teamGaps(ev({ coverage: "live", ...regular, cameraman_id: "ben", obs_tech_id: "kim" }))).toEqual([]);
    expect(teamGaps(ev({ coverage: "live_and_regular", writer_id: null, obs_tech_id: "kim" }))).toEqual(["writer", "cameraman"]);
    expect(teamGaps(ev({ ...regular }))).toEqual(["writer", "photo_video"]);
  });

  it("needs assignment counts a missing live crew", () => {
    const scheduled = { status: "scheduled" as const, event_date: "2026-10-22" };
    expect(needsAssignment(ev({ ...scheduled, coverage: "live_and_regular", cameraman_id: "ben" }), today)).toBe(true);
    expect(needsAssignment(ev({ ...scheduled, coverage: "live", ...regular, cameraman_id: "ben", obs_tech_id: "kim" }), today)).toBe(false);
  });

  it("counts livestreamed events among those covered", () => {
    const s = summarize(
      [
        ev({ coverage: "live", status: "covered" }),
        ev({ coverage: "live_and_regular" }),
        ev({ coverage: "live", status: "scheduled" }), // not covered yet
        ev(),
      ],
      october,
      today,
    );
    expect(s.eventsCovered).toBe(3);
    expect(s.liveStreams).toBe(2);
  });
});
