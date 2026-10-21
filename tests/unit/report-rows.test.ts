import { describe, expect, it } from "vitest";
import { monthPeriod, weekPeriod } from "@/lib/metrics";
import { peopleRows, peopleTotals, periodSlug, postGroups } from "@/lib/report-rows";
import type { EventRow, Staff } from "@/lib/types";

const staff: Staff[] = [
  { id: "ana", full_name: "Ana R.", display_name: "Ana R.", roles: ["writer"], active: true },
  { id: "rico", full_name: "Rico M.", display_name: "Rico M.", roles: ["photographer"], active: true },
  { id: "paolo", full_name: "Paolo D.", display_name: "Paolo D.", roles: ["videographer"], active: false },
  { id: "grace", full_name: "Grace S.", display_name: "Grace S.", roles: ["head", "proofreader"], active: true },
  { id: "joel", full_name: "Joel B.", display_name: "Joel B.", roles: ["page_admin"], active: true },
  { id: "old", full_name: "Old W.", display_name: "Old W.", roles: ["writer"], active: false },
];

const ev = (o: Partial<EventRow>): EventRow =>
  ({
    id: Math.random().toString(36),
    title: "Event",
    status: "posted",
    event_date: "2026-10-10",
    due_date: "2026-10-12",
    posted_at: "2026-10-11T10:00:00Z",
    source: "community",
    municipality: "daet",
    photographer_id: "rico",
    videographer_id: null,
    editor_id: null,
    writer_id: "ana",
    proofreader_id: "grace",
    post_link: "https://fb.watch/x",
    ...o,
  }) as EventRow;

describe("report rows", () => {
  const october = monthPeriod("2026-10-01");

  it("formats grouped post rows in Manila time", () => {
    const groups = postGroups(
      [ev({ title: "A" }), ev({ title: "B", source: null, municipality: null, videographer_id: "paolo", writer_id: "gone", post_link: null })],
      october,
      staff,
    );
    expect(groups.map((g) => g.label)).toEqual(["Community", "No source"]);
    expect(groups[0].rows[0]).toMatchObject({
      postedAt: "Oct 11, 2026 6:00 PM",
      eventDate: "Oct 10, 2026",
      municipality: "Daet",
      writer: "Ana R.",
      photoVideo: "Rico M.",
      proofreader: "Grace S.",
    });
    expect(groups[1].rows[0]).toMatchObject({ municipality: "", writer: "Unknown", photoVideo: "Rico M. / Paolo D.", link: "" });
  });

  it("lists credited people and current role holders, with totals", () => {
    const rows = peopleRows([ev({}), ev({ videographer_id: "paolo", proofreader_id: null })], october, staff);
    expect(rows.map((r) => [r.name, r.written, r.proofread, r.photographed, r.videographed, r.total])).toEqual([
      ["Ana R.", 2, 0, 0, 0, 2],
      ["Rico M.", 0, 0, 2, 0, 2],
      ["Grace S.", 0, 1, 0, 0, 1],
      ["Paolo D. (inactive)", 0, 0, 0, 1, 1],
    ]);
    expect(rows.find((r) => r.name === "Grace S.")?.roles).toBe("proofreader");
    expect(peopleTotals(rows)).toEqual({ written: 2, proofread: 1, photographed: 2, videographed: 1, edited: 0, total: 6 });
  });

  it("names files by period", () => {
    expect(periodSlug(october)).toBe("2026-10");
    expect(periodSlug(weekPeriod("2026-10-21"))).toBe("week-of-2026-10-19");
  });
});
