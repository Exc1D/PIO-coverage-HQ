import { describe, expect, it } from "vitest";
import { PIPELINE } from "@/lib/constants";
import { defaultView, isMyEvent, lensesFor, readView, stageLabel, stageStatuses, viewColumns, viewsFor } from "@/lib/focus";
import { isMe, type WaitingEvent } from "@/lib/waiting";

const TODAY = "2026-10-20";

const ev = (p: Partial<WaitingEvent> = {}): WaitingEvent => ({
  status: "scheduled",
  event_date: "2026-10-25",
  source: "community",
  municipality: "daet",
  coverage: "regular",
  coverage_confirmed: true,
  photos_done: false,
  caption_done: false,
  photographer_id: "pho",
  videographer_id: null,
  editor_id: null,
  writer_id: "wri",
  proofreader_id: null,
  cameraman_id: null,
  obs_tech_id: null,
  ...p,
});

const head = { id: "boss", roles: ["head", "proofreader"] as const };
const writer = { id: "wri", roles: ["writer"] as const };
const pageAdmin = { id: "pa", roles: ["page_admin"] as const };

describe("lenses", () => {
  it("groups roles into the part of the work they do, in a fixed order", () => {
    expect(lensesFor(["page_admin", "photographer", "obs_tech"])).toEqual(["field", "publishing"]);
    expect(lensesFor(["graphics", "video_editor", "writer"])).toEqual(["production"]);
    expect(lensesFor([])).toEqual([]);
  });

  it("maps lenses to the board columns they act on, in pipeline order", () => {
    expect(stageStatuses(["writer"])).toEqual(["covered", "in_production"]);
    expect(stageStatuses(["page_admin", "proofreader"])).toEqual(["for_proofreading", "approved", "scheduled_for_posting", "posted"]);
    expect(stageStatuses(["head"])).toEqual([...PIPELINE]);
  });

  it("names the stage", () => {
    expect(stageLabel(["writer"])).toBe("Production");
    expect(stageLabel(["proofreader", "page_admin"])).toBe("Proofreading and posting");
    expect(stageLabel(["photographer", "writer", "page_admin"])).toBe("Coverage, Production and posting");
    expect(stageLabel([])).toBe("");
  });
});

describe("board views", () => {
  it("offers views by who is signed in", () => {
    expect(viewsFor(null)).toEqual(["all"]);
    expect(viewsFor(head)).toEqual(["all", "mine"]);
    expect(viewsFor(writer)).toEqual(["all", "mine", "stage"]);
  });

  it("starts the head on everything and everyone else on their own events", () => {
    expect(defaultView(null)).toBe("all");
    expect(defaultView(head)).toBe("all");
    expect(defaultView(writer)).toBe("mine");
  });

  it("reads ?view= only when the person can use it", () => {
    expect(readView("stage", writer)).toBe("stage");
    expect(readView("all", writer)).toBe("all");
    expect(readView("stage", head)).toBe("all");
    expect(readView("mine", null)).toBe("all");
    expect(readView("bogus", writer)).toBe("mine");
    expect(readView(null, head)).toBe("all");
  });

  it("limits columns to the stage, and adds cancelled when asked", () => {
    expect(viewColumns("stage", writer, false)).toEqual(["covered", "in_production"]);
    expect(viewColumns("stage", writer, true)).toEqual(["covered", "in_production", "cancelled"]);
    expect(viewColumns("mine", writer, false)).toEqual([...PIPELINE]);
    expect(viewColumns("stage", null, false)).toEqual([...PIPELINE]);
  });
});

describe("isMyEvent", () => {
  it("counts events the person is on", () => {
    expect(isMyEvent(ev(), writer, TODAY)).toBe(true);
    expect(isMyEvent(ev({ writer_id: "other" }), writer, TODAY)).toBe(false);
  });

  it("counts events waiting on a role the person holds", () => {
    expect(isMyEvent(ev({ status: "approved" }), pageAdmin, TODAY)).toBe(true);
    expect(isMyEvent(ev({ status: "requested" }), head, TODAY)).toBe(true);
    expect(isMyEvent(ev({ status: "approved" }), head, TODAY)).toBe(false);
  });
});

describe("isMe", () => {
  it("matches by id for people and by role for roles", () => {
    expect(isMe({ kind: "staff", id: "wri", slot: "writer" }, writer)).toBe(true);
    expect(isMe({ kind: "role", role: "page_admin" }, pageAdmin)).toBe(true);
    expect(isMe({ kind: "role", role: "head" }, writer)).toBe(false);
    expect(isMe({ kind: "role", role: "head" }, null)).toBe(false);
  });
});
