import { describe, expect, it } from "vitest";
import { matchesFilters, readFilters } from "@/components/board/board-filters";
import { parseCommand } from "@/lib/commands";
import type { EventRow, Staff } from "@/lib/types";

const staff: Staff[] = [
  { id: "11111111-1111-4111-8111-111111111111", full_name: "Ana R.", display_name: "Ana R.", roles: ["writer"], active: true },
];

describe("parseCommand", () => {
  it("converts Manila wall-clock times to UTC instants", () => {
    const r = parseCommand({ type: "schedule_post", scheduledPostAt: "2026-10-21T18:00" }, staff);
    expect(r).toEqual({ ok: true, command: { type: "schedule_post", scheduledPostAt: new Date("2026-10-21T10:00:00Z") } });
    const p = parseCommand({ type: "mark_posted", postLink: "https://fb.watch/x", postedAt: "2026-10-20T07:15" }, staff);
    expect(p.ok && p.command.type === "mark_posted" && p.command.postedAt?.toISOString()).toBe("2026-10-19T23:15:00.000Z");
    const n = parseCommand({ type: "mark_posted", postLink: "https://fb.watch/x" }, staff);
    expect(n.ok && n.command.type === "mark_posted" && n.command.postedAt).toBeUndefined();
  });

  it("looks up assignees on the server's staff list", () => {
    const r = parseCommand({ type: "assign", slot: "writer", staffId: staff[0].id }, staff);
    expect(r.ok && r.command.type === "assign" && r.command.assignee).toEqual({ id: staff[0].id, roles: ["writer"], active: true });
    expect(parseCommand({ type: "assign", slot: "writer", staffId: null }, staff)).toMatchObject({ ok: true });
    expect(parseCommand({ type: "assign", slot: "writer", staffId: "22222222-2222-4222-8222-222222222222" }, staff)).toMatchObject({
      ok: false,
    });
  });

  it("normalises edited details", () => {
    const r = parseCommand(
      { type: "edit_details", changes: { title: "  New  ", venue: "", start_time: "", municipality: null } },
      staff,
    );
    expect(r.ok && r.command).toEqual({
      type: "edit_details",
      changes: { title: "New", venue: null, start_time: null, municipality: null },
    });
  });

  it("keeps non-empty optional text and times", () => {
    const r = parseCommand({ type: "edit_details", changes: { notes: " Bring ID ", start_time: "09:30", venue: "Capitol" } }, staff);
    expect(r.ok && r.command).toEqual({ type: "edit_details", changes: { notes: "Bring ID", start_time: "09:30", venue: "Capitol" } });
  });

  it("rejects malformed input with a readable message", () => {
    expect(parseCommand({ type: "cancel", reason: "  " }, staff)).toEqual({ ok: false, message: "A reason is required." });
    expect(parseCommand({ type: "schedule_post", scheduledPostAt: "tomorrow" }, staff)).toMatchObject({ ok: false });
    expect(parseCommand({ type: "schedule_post", scheduledPostAt: "2026-02-30T10:00" }, staff)).toMatchObject({ ok: false });
    expect(parseCommand({ type: "drop_tables" }, staff)).toMatchObject({ ok: false });
    expect(parseCommand(null, staff)).toMatchObject({ ok: false });
  });

  it("passes simple commands through", () => {
    expect(parseCommand({ type: "set_photos_done", value: true }, staff)).toEqual({
      ok: true,
      command: { type: "set_photos_done", value: true },
    });
  });
});

describe("board filters", () => {
  const ev = (o: Partial<EventRow>) =>
    ({
      status: "scheduled",
      source: "community",
      municipality: "daet",
      event_date: "2026-10-22",
      posted_at: null,
      photographer_id: "p",
      videographer_id: null,
      writer_id: "w",
      proofreader_id: null,
      ...o,
    }) as EventRow;
  const today = "2026-10-20";

  it("reads only valid values from the URL", () => {
    expect(readFilters(new URLSearchParams("source=bogus&municipality=labo&from=2026-13-01&to=2026-10-31&cancelled=1&person=x"))).toEqual({
      source: null,
      municipality: "labo",
      person: "x",
      from: null,
      to: "2026-10-31",
      cancelled: true,
    });
  });

  it("filters by source, place, person and dates", () => {
    const f = readFilters(new URLSearchParams("source=community&person=w&from=2026-10-21&to=2026-10-23"));
    expect(matchesFilters(ev({}), f, today)).toBe(true);
    expect(matchesFilters(ev({ source: "private" }), f, today)).toBe(false);
    expect(matchesFilters(ev({ writer_id: "z" }), f, today)).toBe(false);
    expect(matchesFilters(ev({ event_date: "2026-10-24" }), f, today)).toBe(false);
    expect(matchesFilters(ev({ municipality: "labo" }), readFilters(new URLSearchParams("municipality=daet")), today)).toBe(false);
  });

  it("hides cancelled unless asked, and old posts without a date range", () => {
    const none = readFilters(new URLSearchParams());
    expect(matchesFilters(ev({ status: "cancelled" }), none, today)).toBe(false);
    expect(matchesFilters(ev({ status: "cancelled" }), readFilters(new URLSearchParams("cancelled=1")), today)).toBe(true);
    expect(matchesFilters(ev({ status: "posted", posted_at: "2026-10-10T02:00:00Z" }), none, today)).toBe(true);
    expect(matchesFilters(ev({ status: "posted", posted_at: "2026-09-30T02:00:00Z" }), none, today)).toBe(false);
    expect(
      matchesFilters(ev({ status: "posted", posted_at: "2026-09-30T02:00:00Z", event_date: "2026-09-29" }), readFilters(new URLSearchParams("from=2026-09-01")), today),
    ).toBe(true);
  });
});

describe("previewCommand (client, no zod)", () => {
  it("matches the server conversion for normal payloads", async () => {
    const { previewCommand } = await import("@/lib/command-preview");
    expect(previewCommand({ type: "schedule_post", scheduledPostAt: "2026-10-21T18:00" }, staff)).toEqual(
      parseCommand({ type: "schedule_post", scheduledPostAt: "2026-10-21T18:00" }, staff),
    );
    expect(previewCommand({ type: "assign", slot: "writer", staffId: staff[0].id }, staff)).toEqual(
      parseCommand({ type: "assign", slot: "writer", staffId: staff[0].id }, staff),
    );
    expect(previewCommand({ type: "edit_details", changes: { title: " New ", venue: " ", municipality: null } }, staff)).toEqual(
      parseCommand({ type: "edit_details", changes: { title: " New ", venue: " ", municipality: null } }, staff),
    );
  });
});
