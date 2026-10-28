import { describe, expect, it } from "vitest";
import { partyKey, waitingByParty, waitingOn, type WaitingEvent } from "@/lib/waiting";

const TODAY = "2026-10-20";

const ev = (p: Partial<WaitingEvent> = {}): WaitingEvent => ({
  status: "scheduled",
  event_date: TODAY,
  source: "community",
  municipality: "daet",
  coverage_confirmed: true,
  photos_done: false,
  caption_done: false,
  photographer_id: "pho",
  videographer_id: null,
  editor_id: null,
  writer_id: "wri",
  proofreader_id: null,
  ...p,
});

const head = { kind: "role", role: "head" };
const pageAdmin = { kind: "role", role: "page_admin" };

describe("waitingOn", () => {
  it("requested: the head schedules, after adding missing details", () => {
    expect(waitingOn(ev({ status: "requested" }), TODAY)).toEqual([{ who: head, task: "Schedule the event" }]);
    expect(waitingOn(ev({ status: "requested", source: null }), TODAY)[0].task).toBe("Add source and municipality, then schedule");
    expect(waitingOn(ev({ status: "requested", municipality: null }), TODAY)[0].task).toBe("Add source and municipality, then schedule");
  });

  it("scheduled: the head assigns the missing team, then confirms coverage", () => {
    expect(waitingOn(ev({ writer_id: null, photographer_id: null }), TODAY)).toEqual([
      { who: head, task: "Assign a writer and photo/video" },
    ]);
    expect(waitingOn(ev({ writer_id: null }), TODAY)).toEqual([{ who: head, task: "Assign a writer" }]);
    expect(waitingOn(ev({ photographer_id: null }), TODAY)).toEqual([{ who: head, task: "Assign photo/video" }]);
    expect(waitingOn(ev({ coverage_confirmed: false }), TODAY)).toEqual([{ who: head, task: "Confirm coverage" }]);
  });

  it("scheduled: nobody before the event day, then the photographer/videographer marks it covered", () => {
    expect(waitingOn(ev({ event_date: "2026-10-21" }), TODAY)).toEqual([]);
    expect(waitingOn(ev({ videographer_id: "vid" }), TODAY)).toEqual([
      { who: { kind: "staff", id: "pho", slot: "photographer" }, task: "Mark as covered" },
      { who: { kind: "staff", id: "vid", slot: "videographer" }, task: "Mark as covered" },
    ]);
    expect(waitingOn(ev({ photographer_id: null, videographer_id: "vid" }), "2026-10-25")).toEqual([
      { who: { kind: "staff", id: "vid", slot: "videographer" }, task: "Mark as covered" },
    ]);
  });

  it("in production: whoever still owes photos/video and the caption", () => {
    expect(waitingOn(ev({ status: "in_production" }), TODAY)).toEqual([
      { who: { kind: "staff", id: "pho", slot: "photographer" }, task: "Finish photos/video" },
      { who: { kind: "staff", id: "wri", slot: "writer" }, task: "Finish the caption" },
    ]);
    expect(waitingOn(ev({ status: "covered", editor_id: "edi", caption_done: true }), TODAY)).toEqual([
      { who: { kind: "staff", id: "edi", slot: "editor" }, task: "Finish editing photos/video" },
    ]);
    expect(waitingOn(ev({ status: "in_production", photos_done: true }), TODAY, { changesRequested: true })).toEqual([
      { who: { kind: "staff", id: "wri", slot: "writer" }, task: "Revise the caption (changes requested)" },
    ]);
  });

  it("in production with a gap in the team: the head assigns", () => {
    expect(waitingOn(ev({ status: "in_production", photographer_id: null, writer_id: null }), TODAY)).toEqual([
      { who: head, task: "Assign photo/video" },
      { who: head, task: "Assign a writer" },
    ]);
  });

  it("later steps: proofreader, then page admin", () => {
    expect(waitingOn(ev({ status: "for_proofreading" }), TODAY)).toEqual([
      { who: { kind: "role", role: "proofreader" }, task: "Proofread the caption" },
    ]);
    expect(waitingOn(ev({ status: "for_proofreading", proofreader_id: "pro" }), TODAY)).toEqual([
      { who: { kind: "staff", id: "pro", slot: "proofreader" }, task: "Proofread the caption" },
    ]);
    expect(waitingOn(ev({ status: "approved" }), TODAY)).toEqual([{ who: pageAdmin, task: "Schedule the post" }]);
    expect(waitingOn(ev({ status: "scheduled_for_posting" }), TODAY)).toEqual([{ who: pageAdmin, task: "Publish the post" }]);
  });

  it("finished events wait on nobody", () => {
    expect(waitingOn(ev({ status: "posted" }), TODAY)).toEqual([]);
    expect(waitingOn(ev({ status: "cancelled" }), TODAY)).toEqual([]);
  });
});

describe("waitingByParty", () => {
  it("groups by who, busiest first, people before roles on ties", () => {
    const a = ev({ status: "in_production" }); // pho + wri
    const b = ev({ status: "in_production", photos_done: true }); // wri
    const c = ev({ status: "approved" }); // page admin
    const d = ev({ status: "posted" }); // nobody
    const e = ev({ status: "requested" }); // head
    const groups = waitingByParty([a, b, c, d, e], TODAY);
    expect(groups.map((g) => [partyKey(g.who), g.items.length])).toEqual([
      ["staff:wri", 2],
      ["staff:pho", 1],
      ["role:head", 1],
      ["role:page_admin", 1],
    ]);
    expect(groups[0].items.map((i) => i.event)).toEqual([a, b]);
  });

  it("orders roles after people even when the role sorts first", () => {
    const groups = waitingByParty([ev({ status: "approved" }), ev({ status: "for_proofreading", proofreader_id: "zzz" })], TODAY);
    expect(groups.map((g) => partyKey(g.who))).toEqual(["staff:zzz", "role:page_admin"]);
  });
});
