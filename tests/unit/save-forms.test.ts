import { describe, expect, it, vi } from "vitest";
import { changedDetails } from "@/lib/command-preview";
import { withTimeLimit } from "@/lib/offline";

const opened = {
  title: "Clean-up drive",
  event_date: "2026-11-10",
  start_time: "09:00:00",
  venue: "Plaza",
  municipality: "daet",
  source: null,
  coverage: "regular",
  requested_by: null,
  contact: null,
  notes: null,
};

/** The form as it would submit if nothing had been touched. */
function untouched() {
  const f = new FormData();
  f.set("title", "Clean-up drive");
  f.set("event_date", "2026-11-10");
  f.set("start_time", "09:00");
  f.set("venue", "Plaza");
  f.set("municipality", "daet");
  f.set("coverage", "regular");
  f.set("requested_by", "");
  f.set("contact", "");
  f.set("notes", "");
  return f;
}

describe("changedDetails", () => {
  it("is empty when nothing was touched, so a retry can't overwrite anyone else's change", () => {
    expect(changedDetails(opened, untouched())).toEqual({});
  });
  it("carries only the field that was edited", () => {
    const f = untouched();
    f.set("title", "New title");
    expect(changedDetails(opened, f)).toEqual({ title: "New title" });
  });
  it("sends a cleared municipality as null and a cleared time as empty", () => {
    const f = untouched();
    f.set("municipality", "");
    f.set("start_time", "");
    expect(changedDetails(opened, f)).toEqual({ municipality: null, start_time: "" });
  });
});

describe("withTimeLimit", () => {
  it("gives the fallback when the work stalls", async () => {
    vi.useFakeTimers();
    const result = withTimeLimit(new Promise<string>(() => {}), 1000, "gave up");
    await vi.advanceTimersByTimeAsync(1000);
    await expect(result).resolves.toBe("gave up");
    vi.useRealTimers();
  });
  it("gives the work's result when it finishes in time", async () => {
    await expect(withTimeLimit(Promise.resolve("saved"), 1000, "gave up")).resolves.toBe("saved");
  });
  it("passes a failure through", async () => {
    await expect(withTimeLimit(Promise.reject(new Error("offline")), 1000, "gave up")).rejects.toThrow("offline");
  });
});
