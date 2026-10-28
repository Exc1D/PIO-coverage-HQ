import { describe, expect, it } from "vitest";
import { describeActivity, openCaptionFeedback } from "@/lib/activity";
import type { ActivityRow } from "@/lib/types";

let nextId = 1;
const row = (action: string, details: Record<string, unknown> = {}): ActivityRow => ({
  id: nextId++,
  event_id: "e",
  actor_id: "proof",
  action,
  from_status: "for_proofreading",
  to_status: "in_production",
  details,
  created_at: "2026-10-27T01:00:00Z",
});

describe("openCaptionFeedback (newest first)", () => {
  const request = row("request_changes", { reason: "Add the venue" });

  it("returns the latest request", () => {
    expect(openCaptionFeedback([row("edit"), request, row("transition")])).toBe(request);
  });
  it("is closed once Caption done is ticked again", () => {
    expect(openCaptionFeedback([row("tick", { field: "caption_done", value: true }), request])).toBeNull();
  });
  it("ignores other ticks and unticks", () => {
    expect(
      openCaptionFeedback([row("tick", { field: "photos_done", value: true }), row("tick", { field: "caption_done", value: false }), request]),
    ).toBe(request);
  });
  it("is null with no request", () => expect(openCaptionFeedback([row("transition")])).toBeNull());

  it("describes the request", () => {
    expect(describeActivity(request, () => "x")).toBe("Requested caption changes; moved back to In production");
  });
});

describe("describeActivity", () => {
  it("describes an event brought back after a delete", () => {
    expect(describeActivity(row("undelete"), () => "x")).toBe("Brought back after being deleted");
  });
});
