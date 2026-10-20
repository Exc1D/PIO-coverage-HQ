import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  endOfMonth,
  formatManila,
  isDateString,
  isoWeekday,
  manilaDate,
  manilaDateTime,
  manilaStartOfDay,
  startOfMonth,
  startOfWeek,
} from "@/lib/time";
import { isFacebookPostUrl, isHttpsUrl } from "@/lib/urls";

describe("time", () => {
  it("validates date strings", () => {
    expect(isDateString("2026-02-28")).toBe(true);
    expect(isDateString("2026-02-30")).toBe(false);
    expect(isDateString("2026-2-3")).toBe(false);
  });
  it("converts between instants and Manila dates", () => {
    expect(manilaDate("2026-10-31T15:59:59Z")).toBe("2026-10-31");
    expect(manilaDate(new Date("2026-10-31T16:00:00Z"))).toBe("2026-11-01");
    expect(manilaStartOfDay("2026-11-01").toISOString()).toBe("2026-10-31T16:00:00.000Z");
    expect(manilaDateTime("2026-11-01", "09:30").toISOString()).toBe("2026-11-01T01:30:00.000Z");
    expect(manilaDateTime("2026-11-01", "09:30:15").toISOString()).toBe("2026-11-01T01:30:15.000Z");
    expect(formatManila("2026-10-31T15:30:00Z", "MMM d, h:mm a")).toBe("Oct 31, 11:30 PM");
  });
  it("does calendar arithmetic", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetween("2026-10-01", "2026-11-03")).toBe(33);
    expect(isoWeekday("2026-10-19")).toBe(1);
    expect(isoWeekday("2026-10-25")).toBe(7);
    expect(startOfWeek("2026-10-25")).toBe("2026-10-19");
    expect(startOfMonth("2026-10-25")).toBe("2026-10-01");
    expect(endOfMonth("2026-04-10")).toBe("2026-04-30");
  });
});

describe("urls", () => {
  it("accepts Facebook post links only", () => {
    expect(isFacebookPostUrl("https://www.facebook.com/PIO/posts/123")).toBe(true);
    expect(isFacebookPostUrl("https://m.facebook.com/story.php?id=1")).toBe(true);
    expect(isFacebookPostUrl("https://fb.watch/abc123/")).toBe(true);
    expect(isFacebookPostUrl("https://facebook.com/")).toBe(false);
    expect(isFacebookPostUrl("http://facebook.com/x")).toBe(false);
    expect(isFacebookPostUrl("https://facebook.com.evil.example/x")).toBe(false);
    expect(isFacebookPostUrl("https://notfacebook.com/x")).toBe(false);
    expect(isFacebookPostUrl("not a url")).toBe(false);
  });
  it("checks https", () => {
    expect(isHttpsUrl("https://drive.google.com/x")).toBe(true);
    expect(isHttpsUrl("ftp://x")).toBe(false);
  });
});
