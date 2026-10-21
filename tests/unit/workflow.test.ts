import { describe, expect, it } from "vitest";
import {
  COMMAND_TYPES,
  applyCommand,
  availability,
  canPerform,
  dropCommand,
  nextStatus,
  previousStatus,
  type Actor,
  type Command,
  type Result,
  type Success,
  type WorkflowEvent,
} from "@/lib/workflow";
import type { Status } from "@/lib/constants";

const NOW = new Date("2026-10-20T04:00:00Z");

const head: Actor = { id: "head", roles: ["head", "proofreader"] };
const photog: Actor = { id: "photog", roles: ["photographer"] };
const video: Actor = { id: "video", roles: ["videographer"] };
const editor: Actor = { id: "editor", roles: ["editor"] };
const writer: Actor = { id: "writer", roles: ["writer"] };
const proof: Actor = { id: "proof", roles: ["proofreader", "page_admin"] };
const admin: Actor = { id: "admin", roles: ["page_admin"] };
const stranger: Actor = { id: "stranger", roles: ["writer", "photographer"] };

function ev(overrides: Partial<WorkflowEvent> = {}): WorkflowEvent {
  return {
    title: "Provincial Board session",
    event_date: "2026-10-21",
    start_time: null,
    venue: "Capitol",
    municipality: "daet",
    source: "provincial_government",
    requested_by: null,
    contact: null,
    notes: null,
    status: "requested",
    cancelled_from_status: null,
    photographer_id: "photog",
    videographer_id: "video",
    editor_id: "editor",
    writer_id: "writer",
    proofreader_id: null,
    approved_by_id: null,
    coverage_confirmed: false,
    photos_done: false,
    caption_done: false,
    drive_folder_url: null,
    caption_text: null,
    scheduled_post_at: null,
    posted_at: null,
    post_link: null,
    ...overrides,
  };
}

function ok(r: Result): Success {
  if (!r.ok) throw new Error(`expected ok, got ${r.code}: ${r.message}`);
  return r;
}

function err(r: Result | ReturnType<typeof canPerform>, code: string) {
  expect(r.ok).toBe(false);
  if (!r.ok) {
    expect(r.code).toBe(code);
    expect(r.message.length).toBeGreaterThan(0);
  }
}

const run = (e: WorkflowEvent, c: Command, a: Actor) => applyCommand(e, c, a, NOW);

describe("pipeline helpers", () => {
  it("steps forward and back", () => {
    expect(nextStatus("requested")).toBe("scheduled");
    expect(nextStatus("scheduled_for_posting")).toBe("posted");
    expect(nextStatus("posted")).toBeNull();
    expect(nextStatus("cancelled")).toBeNull();
    expect(previousStatus("requested")).toBeNull();
    expect(previousStatus("posted")).toBe("scheduled_for_posting");
    expect(previousStatus("cancelled")).toBeNull();
  });
});

describe("schedule (requested → scheduled)", () => {
  it("head schedules when source and municipality are set", () => {
    const r = ok(run(ev(), { type: "schedule" }, head));
    expect(r.patch).toEqual({ status: "scheduled" });
    expect(r.activity).toEqual([
      { action: "transition", from_status: "requested", to_status: "scheduled", details: {} },
    ]);
  });
  it("requires source and municipality", () => {
    err(run(ev({ source: null }), { type: "schedule" }, head), "requirement");
    err(run(ev({ municipality: null }), { type: "schedule" }, head), "requirement");
  });
  it("only head", () => err(run(ev(), { type: "schedule" }, photog), "forbidden"));
  it("only from requested", () =>
    err(run(ev({ status: "scheduled" }), { type: "schedule" }, head), "wrong_status"));
});

describe("coverage confirmation", () => {
  it("head ticks and unticks", () => {
    const r = ok(run(ev({ status: "scheduled" }), { type: "set_coverage_confirmed", value: true }, head));
    expect(r.patch).toEqual({ coverage_confirmed: true });
    expect(r.activity[0]).toMatchObject({ action: "coverage_confirmed", details: { value: true } });
    ok(run(ev({ coverage_confirmed: true }), { type: "set_coverage_confirmed", value: false }, head));
  });
  it("no-op is rejected", () =>
    err(run(ev(), { type: "set_coverage_confirmed", value: false }, head), "no_change"));
  it("only head", () =>
    err(run(ev({ status: "scheduled" }), { type: "set_coverage_confirmed", value: true }, photog), "forbidden"));
  it("only before covered", () =>
    err(
      run(ev({ status: "covered", coverage_confirmed: true }), { type: "set_coverage_confirmed", value: false }, head),
      "wrong_status",
    ));
});

describe("mark_covered (scheduled → covered)", () => {
  const scheduled = ev({ status: "scheduled", coverage_confirmed: true });
  it("assigned photographer, videographer or head", () => {
    for (const a of [photog, video, head]) {
      const r = ok(run(scheduled, { type: "mark_covered" }, a));
      expect(r.next.status).toBe("covered");
    }
  });
  it("does not auto-advance into production", () => {
    const r = ok(run({ ...scheduled, caption_done: true }, { type: "mark_covered" }, photog));
    expect(r.next.status).toBe("covered");
    expect(r.activity).toHaveLength(1);
  });
  it("requires the head's coverage confirmation", () =>
    err(run(ev({ status: "scheduled" }), { type: "mark_covered" }, photog), "requirement"));
  it("unassigned staff are forbidden", () => err(run(scheduled, { type: "mark_covered" }, stranger), "forbidden"));
  it("wrong status", () => err(run(ev(), { type: "mark_covered" }, head), "wrong_status"));
});

describe("start_production (covered → in_production)", () => {
  const covered = ev({ status: "covered", coverage_confirmed: true });
  it("any assigned team member or head", () => {
    for (const a of [photog, video, writer, head]) {
      expect(ok(run(covered, { type: "start_production" }, a)).next.status).toBe("in_production");
    }
  });
  it("auto-advances if both boxes were already done", () => {
    const r = ok(run({ ...covered, photos_done: true, caption_done: true }, { type: "start_production" }, head));
    expect(r.next.status).toBe("for_proofreading");
    expect(r.activity.map((a) => a.to_status)).toEqual(["in_production", "for_proofreading"]);
  });
  it("forbidden for others", () => err(run(covered, { type: "start_production" }, stranger), "forbidden"));
  it("wrong status", () => err(run(ev({ status: "scheduled" }), { type: "start_production" }, head), "wrong_status"));
});

describe("checkboxes and auto-advance", () => {
  const prod = ev({ status: "in_production", coverage_confirmed: true });

  it("photographer ticks photos; no advance until caption done", () => {
    const r = ok(run(prod, { type: "set_photos_done", value: true }, photog));
    expect(r.next).toMatchObject({ status: "in_production", photos_done: true });
    expect(r.activity).toEqual([
      {
        action: "tick",
        from_status: "in_production",
        to_status: "in_production",
        details: { field: "photos_done", value: true },
      },
    ]);
  });

  it("videographer can tick photos/video done", () =>
    ok(run(prod, { type: "set_photos_done", value: true }, video)));

  it("assigned editor can tick photos/video done", () => {
    const r = ok(run(prod, { type: "set_photos_done", value: true }, editor));
    expect(r.patch).toMatchObject({ photos_done: true });
    expect(r.next.photos_done).toBe(true);
  });

  it("an editor who isn't assigned can't tick photos/video done", () =>
    err(run({ ...prod, editor_id: null }, { type: "set_photos_done", value: true }, editor), "forbidden"));

  it("whichever is ticked last advances to for_proofreading", () => {
    const a = ok(run({ ...prod, caption_done: true }, { type: "set_photos_done", value: true }, photog));
    expect(a.next.status).toBe("for_proofreading");
    expect(a.activity[1]).toMatchObject({ action: "auto_advance", to_status: "for_proofreading" });
    const b = ok(run({ ...prod, photos_done: true }, { type: "set_caption_done", value: true }, writer));
    expect(b.next.status).toBe("for_proofreading");
  });

  it("ticking on a covered event starts production", () => {
    const covered = ev({ status: "covered", coverage_confirmed: true });
    const r = ok(run(covered, { type: "set_photos_done", value: true }, photog));
    expect(r.activity.map((x) => x.action)).toEqual(["tick", "auto_advance"]);
    expect(r.next.status).toBe("in_production");
    // ...and goes straight through if the caption was pre-written
    const r2 = ok(run({ ...covered, caption_done: true }, { type: "set_photos_done", value: true }, photog));
    expect(r2.next.status).toBe("for_proofreading");
    expect(r2.activity.map((x) => x.to_status)).toEqual(["covered", "in_production", "for_proofreading"]);
  });

  it("unticking on a covered event does not start production", () => {
    const r = ok(
      run(ev({ status: "covered", coverage_confirmed: true, photos_done: true }), { type: "set_photos_done", value: false }, head),
    );
    expect(r.next.status).toBe("covered");
  });

  it("writer may pre-tick caption while scheduled; no status change", () => {
    const r = ok(run(ev({ status: "scheduled" }), { type: "set_caption_done", value: true }, writer));
    expect(r.next.status).toBe("scheduled");
  });

  it("photos can't be ticked before coverage", () =>
    err(run(ev({ status: "scheduled" }), { type: "set_photos_done", value: true }, photog), "wrong_status"));
  it("caption can't be ticked after production", () =>
    err(run(ev({ status: "for_proofreading" }), { type: "set_caption_done", value: false }, writer), "wrong_status"));
  it("only assigned people (or head)", () => {
    err(run(prod, { type: "set_photos_done", value: true }, writer), "forbidden");
    err(run(prod, { type: "set_caption_done", value: true }, photog), "forbidden");
    ok(run(prod, { type: "set_caption_done", value: true }, head));
  });
  it("no-op is rejected", () => err(run(prod, { type: "set_caption_done", value: false }, writer), "no_change"));
});

describe("approve (for_proofreading → approved)", () => {
  const fp = ev({ status: "for_proofreading", coverage_confirmed: true, photos_done: true, caption_done: true });
  it("sets proofreader to the actor when empty", () => {
    const r = ok(run(fp, { type: "approve" }, proof));
    expect(r.patch).toEqual({ proofreader_id: "proof", approved_by_id: "proof", status: "approved" });
  });
  it("keeps an assigned proofreader", () => {
    const r = ok(run({ ...fp, proofreader_id: "proof" }, { type: "approve" }, head));
    expect(r.patch).toEqual({ approved_by_id: "head", status: "approved" });
  });
  it("forbidden for non-proofreaders", () => err(run(fp, { type: "approve" }, writer), "forbidden"));
  it("wrong status", () => err(run(ev(), { type: "approve" }, head), "wrong_status"));
});

describe("posting", () => {
  const approved = ev({ status: "approved", coverage_confirmed: true, photos_done: true, caption_done: true });
  const when = new Date("2026-10-21T10:00:00Z");

  it("page admin schedules the post", () => {
    const r = ok(run(approved, { type: "schedule_post", scheduledPostAt: when }, admin));
    expect(r.patch).toEqual({ scheduled_post_at: when.toISOString(), status: "scheduled_for_posting" });
  });
  it("rejects an invalid date", () =>
    err(run(approved, { type: "schedule_post", scheduledPostAt: new Date("nope") }, admin), "invalid_input"));
  it("only page admin or head", () =>
    err(run(approved, { type: "schedule_post", scheduledPostAt: when }, writer), "forbidden"));
  it("wrong status", () => err(run(ev(), { type: "schedule_post", scheduledPostAt: when }, head), "wrong_status"));

  const sfp = { ...approved, status: "scheduled_for_posting" as Status, scheduled_post_at: when.toISOString() };

  it("reschedules", () => {
    const later = new Date("2026-10-22T10:00:00Z");
    const r = ok(run(sfp, { type: "reschedule_post", scheduledPostAt: later }, admin));
    expect(r.next.status).toBe("scheduled_for_posting");
    expect(r.activity[0]).toMatchObject({ action: "edit" });
    err(run(sfp, { type: "reschedule_post", scheduledPostAt: when }, admin), "no_change");
    ok(run({ ...sfp, scheduled_post_at: null }, { type: "reschedule_post", scheduledPostAt: when }, admin));
    err(run(sfp, { type: "reschedule_post", scheduledPostAt: when }, writer), "forbidden");
    err(run(approved, { type: "reschedule_post", scheduledPostAt: when }, admin), "wrong_status");
  });

  it("marks posted with a Facebook link, defaulting posted_at to now", () => {
    const r = ok(run(sfp, { type: "mark_posted", postLink: " https://www.facebook.com/pio/posts/1 " }, admin));
    expect(r.patch).toEqual({
      post_link: "https://www.facebook.com/pio/posts/1",
      posted_at: NOW.toISOString(),
      status: "posted",
    });
  });
  it("accepts an explicit (past) posted_at and fb.watch links", () => {
    const at = new Date("2026-10-19T12:00:00Z");
    const r = ok(run(sfp, { type: "mark_posted", postLink: "https://fb.watch/abc", postedAt: at }, head));
    expect(r.next.posted_at).toBe(at.toISOString());
  });
  it("rejects non-Facebook links, future or invalid times", () => {
    err(run(sfp, { type: "mark_posted", postLink: "https://x.com/pio/1" }, admin), "invalid_input");
    err(
      run(sfp, { type: "mark_posted", postLink: "https://fb.watch/abc", postedAt: new Date("2026-10-21T00:00:00Z") }, admin),
      "invalid_input",
    );
    err(run(sfp, { type: "mark_posted", postLink: "https://fb.watch/abc", postedAt: new Date("x") }, admin), "invalid_input");
  });
  it("only page admin or head; only from scheduled_for_posting", () => {
    err(run(sfp, { type: "mark_posted", postLink: "https://fb.watch/a" }, writer), "forbidden");
    err(run(approved, { type: "mark_posted", postLink: "https://fb.watch/a" }, admin), "wrong_status");
  });
});

describe("cancel and restore", () => {
  it("head cancels with a reason, remembering the origin", () => {
    const r = ok(run(ev({ status: "scheduled" }), { type: "cancel", reason: "  Postponed  " }, head));
    expect(r.patch).toEqual({ cancelled_from_status: "scheduled", status: "cancelled" });
    expect(r.activity[0]).toMatchObject({ action: "cancel", details: { reason: "Postponed" } });
  });
  it("requires a reason of sensible length", () => {
    err(run(ev(), { type: "cancel", reason: "   " }, head), "invalid_input");
    err(run(ev(), { type: "cancel", reason: "x".repeat(501) }, head), "invalid_input");
  });
  it("can't cancel posted or cancelled events", () => {
    err(run(ev({ status: "posted" }), { type: "cancel", reason: "x" }, head), "wrong_status");
    err(run(ev({ status: "cancelled", cancelled_from_status: "requested" }), { type: "cancel", reason: "x" }, head), "wrong_status");
  });
  it("only head cancels", () => err(run(ev(), { type: "cancel", reason: "x" }, proof), "forbidden"));

  it("head restores to the previous status", () => {
    const c = ev({ status: "cancelled", cancelled_from_status: "approved", coverage_confirmed: true });
    const r = ok(run(c, { type: "restore", reason: "Back on" }, head));
    expect(r.patch).toEqual({ cancelled_from_status: null, status: "approved" });
  });
  it("restores to requested if the origin is missing", () => {
    const r = ok(run(ev({ status: "cancelled" }), { type: "restore", reason: "Back on" }, head));
    expect(r.next.status).toBe("requested");
  });
  it("restore needs reason, head, cancelled status", () => {
    const c = ev({ status: "cancelled", cancelled_from_status: "requested" });
    err(run(c, { type: "restore", reason: "" }, head), "invalid_input");
    err(run(c, { type: "restore", reason: "x" }, photog), "forbidden");
    err(run(ev(), { type: "restore", reason: "x" }, head), "wrong_status");
  });
});

describe("step back (head, with reason)", () => {
  const base = { coverage_confirmed: true, photos_done: true, caption_done: true };
  const back = (e: WorkflowEvent, reset?: "caption" | "photos" | "both") =>
    ok(run(e, { type: "step_back", reason: "Fix needed", reset }, head));

  it("scheduled → requested", () => {
    const r = back(ev({ status: "scheduled" }));
    expect(r.patch).toEqual({ status: "requested" });
    expect(r.activity[0]).toMatchObject({ action: "step_back", details: { reason: "Fix needed" } });
  });
  it("covered → scheduled clears coverage confirmation and photos", () => {
    const r = back(ev({ status: "covered", coverage_confirmed: true }));
    expect(r.patch).toEqual({ coverage_confirmed: false, photos_done: false, status: "scheduled" });
  });
  it("in_production → covered keeps the boxes", () => {
    expect(back(ev({ status: "in_production", coverage_confirmed: true, photos_done: true })).patch).toEqual({
      status: "covered",
    });
  });
  it("for_proofreading → in_production unticks caption by default", () => {
    const r = back(ev({ status: "for_proofreading", ...base }));
    expect(r.patch).toEqual({ caption_done: false, status: "in_production" });
    expect(r.activity[0].details).toEqual({ reason: "Fix needed", reset: "caption" });
  });
  it("for_proofreading → in_production can untick photos or both", () => {
    expect(back(ev({ status: "for_proofreading", ...base }), "photos").patch).toEqual({
      photos_done: false,
      status: "in_production",
    });
    expect(back(ev({ status: "for_proofreading", ...base }), "both").patch).toEqual({
      caption_done: false,
      photos_done: false,
      status: "in_production",
    });
  });
  it("approved → for_proofreading clears approver", () => {
    expect(back(ev({ status: "approved", ...base, approved_by_id: "proof" })).patch).toEqual({
      approved_by_id: null,
      status: "for_proofreading",
    });
  });
  it("scheduled_for_posting → approved clears the schedule", () => {
    expect(back(ev({ status: "scheduled_for_posting", ...base, scheduled_post_at: NOW.toISOString() })).patch).toEqual({
      scheduled_post_at: null,
      status: "approved",
    });
  });
  it("posted → scheduled_for_posting clears the post", () => {
    const posted = ev({
      status: "posted",
      ...base,
      scheduled_post_at: NOW.toISOString(),
      posted_at: NOW.toISOString(),
      post_link: "https://fb.watch/x",
    });
    expect(back(posted).patch).toEqual({ posted_at: null, post_link: null, status: "scheduled_for_posting" });
  });
  it("rejects requested/cancelled, non-heads, and empty reasons", () => {
    err(run(ev(), { type: "step_back", reason: "x" }, head), "wrong_status");
    err(run(ev({ status: "cancelled", cancelled_from_status: "requested" }), { type: "step_back", reason: "x" }, head), "wrong_status");
    err(run(ev({ status: "scheduled" }), { type: "step_back", reason: "x" }, proof), "forbidden");
    err(run(ev({ status: "scheduled" }), { type: "step_back", reason: " " }, head), "invalid_input");
  });
});

describe("assign", () => {
  const ana = { id: "ana", roles: ["writer"] as const, active: true };
  it("head assigns a writer", () => {
    const r = ok(run(ev({ writer_id: null }), { type: "assign", slot: "writer", assignee: ana }, head));
    expect(r.patch).toEqual({ writer_id: "ana" });
    expect(r.activity[0]).toMatchObject({ action: "assign", details: { slot: "writer", from: null, to: "ana" } });
  });
  it("head unassigns", () => {
    expect(ok(run(ev(), { type: "assign", slot: "photographer", assignee: null }, head)).patch).toEqual({
      photographer_id: null,
    });
  });
  it("works after posting (credit correction)", () =>
    ok(run(ev({ status: "posted", proofreader_id: null }), { type: "assign", slot: "proofreader", assignee: { id: "p", roles: ["proofreader"], active: true } }, head)));
  it("a multi-role person can fill several slots, including editor", () => {
    const multi = { id: "m", roles: ["photographer", "editor", "writer"] as const, active: true };
    const a = ok(run(ev({ editor_id: null }), { type: "assign", slot: "editor", assignee: multi }, head));
    expect(a.patch).toEqual({ editor_id: "m" });
    const b = ok(run(a.next, { type: "assign", slot: "photographer", assignee: multi }, head));
    const c = ok(run(b.next, { type: "assign", slot: "writer", assignee: multi }, head));
    expect(c.next).toMatchObject({ photographer_id: "m", editor_id: "m", writer_id: "m" });
  });
  it("validates the assignee", () => {
    err(run(ev(), { type: "assign", slot: "writer", assignee: { ...ana, active: false } }, head), "invalid_input");
    err(run(ev(), { type: "assign", slot: "photographer", assignee: ana }, head), "invalid_input");
  });
  it("rejects no-ops, non-heads and cancelled events", () => {
    err(run(ev(), { type: "assign", slot: "writer", assignee: { id: "writer", roles: ["writer"], active: true } }, head), "no_change");
    err(run(ev(), { type: "assign", slot: "writer", assignee: ana }, writer), "forbidden");
    err(run(ev({ status: "cancelled", cancelled_from_status: "requested" }), { type: "assign", slot: "writer", assignee: ana }, head), "wrong_status");
  });
});

describe("edit_details", () => {
  it("head edits changed fields only and logs a diff", () => {
    const r = ok(run(ev(), { type: "edit_details", changes: { title: "New", venue: "Capitol", notes: undefined } }, head));
    expect(r.patch).toEqual({ title: "New" });
    expect(r.activity[0].details).toEqual({ changes: { title: { from: "Provincial Board session", to: "New" } } });
  });
  it("source/municipality can be cleared only while requested", () => {
    ok(run(ev(), { type: "edit_details", changes: { source: null } }, head));
    err(run(ev({ status: "scheduled" }), { type: "edit_details", changes: { source: null } }, head), "invalid_input");
    err(run(ev({ status: "scheduled" }), { type: "edit_details", changes: { municipality: null } }, head), "invalid_input");
  });
  it("rejects empty titles, no-ops, non-heads, cancelled", () => {
    err(run(ev(), { type: "edit_details", changes: { title: "  " } }, head), "invalid_input");
    err(run(ev(), { type: "edit_details", changes: {} }, head), "no_change");
    err(run(ev(), { type: "edit_details", changes: { title: "x" } }, writer), "forbidden");
    err(run(ev({ status: "cancelled", cancelled_from_status: "requested" }), { type: "edit_details", changes: { title: "x" } }, head), "wrong_status");
  });
});

describe("caption text and Drive link (optional references)", () => {
  it("writer edits caption; body is not copied into the log", () => {
    const r = ok(run(ev(), { type: "edit_caption_text", value: "  Hello  " }, writer));
    expect(r.patch).toEqual({ caption_text: "Hello" });
    expect(r.activity[0].details).toEqual({ changes: { caption_text: { changed: true } } });
  });
  it("blank clears; same value is a no-op", () => {
    expect(ok(run(ev({ caption_text: "x" }), { type: "edit_caption_text", value: " " }, head)).patch).toEqual({
      caption_text: null,
    });
    err(run(ev(), { type: "edit_caption_text", value: null }, head), "no_change");
  });
  it("media edits Drive link, must be https", () => {
    const r = ok(run(ev(), { type: "edit_drive_link", value: "https://drive.google.com/x" }, video));
    expect(r.activity[0].details).toEqual({
      changes: { drive_folder_url: { from: null, to: "https://drive.google.com/x" } },
    });
    err(run(ev(), { type: "edit_drive_link", value: "http://drive.google.com/x" }, photog), "invalid_input");
    ok(run(ev({ drive_folder_url: "https://a.b/c" }), { type: "edit_drive_link", value: null }, photog));
  });
  it("permissions and cancelled", () => {
    err(run(ev(), { type: "edit_caption_text", value: "x" }, photog), "forbidden");
    err(run(ev(), { type: "edit_drive_link", value: "https://a.b" }, writer), "forbidden");
    const c = ev({ status: "cancelled", cancelled_from_status: "requested" });
    err(run(c, { type: "edit_caption_text", value: "x" }, head), "wrong_status");
    err(run(c, { type: "edit_drive_link", value: "https://a.b" }, head), "wrong_status");
  });
});

describe("availability (UI)", () => {
  it("hides everything when signed out", () => {
    const a = availability(ev(), null);
    expect(Object.keys(a).sort()).toEqual([...COMMAND_TYPES].sort());
    expect(Object.values(a).every((x) => x.state === "hidden")).toBe(true);
  });
  it("marks available, blocked (with reason) and hidden", () => {
    const a = availability(ev({ status: "scheduled" }), photog);
    expect(a.mark_covered).toEqual({ state: "blocked", reason: expect.stringContaining("Coverage confirmed") });
    expect(a.edit_drive_link.state).toBe("available");
    expect(a.schedule.state).toBe("hidden");
  });
});

describe("dropCommand (board)", () => {
  it("requires sign-in", () => err(dropCommand(ev(), "scheduled", null) as Result, "forbidden"));
  it("same column is a no-op", () => err(dropCommand(ev(), "requested", head) as Result, "no_change"));
  it("cancelled column points to the drawer", () =>
    err(dropCommand(ev(), "cancelled", head) as Result, "invalid_input"));
  it("cancelled cards must be restored first", () =>
    err(dropCommand(ev({ status: "cancelled", cancelled_from_status: "requested" }), "requested", head) as Result, "wrong_status"));

  it("maps forward steps to commands", () => {
    expect(dropCommand(ev(), "scheduled", head)).toEqual({ ok: true, type: "schedule", needsInput: false });
    expect(dropCommand(ev({ status: "scheduled", coverage_confirmed: true }), "covered", photog)).toEqual({
      ok: true,
      type: "mark_covered",
      needsInput: false,
    });
    expect(dropCommand(ev({ status: "approved" }), "scheduled_for_posting", admin)).toEqual({
      ok: true,
      type: "schedule_post",
      needsInput: true,
    });
  });
  it("explains why a forward step is illegal", () => {
    err(dropCommand(ev(), "scheduled", photog) as Result, "forbidden");
    err(dropCommand(ev({ status: "in_production" }), "for_proofreading", head) as Result, "requirement");
  });
  it("maps a backward step to step_back for the head only", () => {
    expect(dropCommand(ev({ status: "approved" }), "for_proofreading", head)).toEqual({
      ok: true,
      type: "step_back",
      needsInput: true,
    });
    err(dropCommand(ev({ status: "approved" }), "for_proofreading", proof) as Result, "forbidden");
  });
  it("rejects jumps", () => err(dropCommand(ev(), "posted", head) as Result, "invalid_input"));
});
