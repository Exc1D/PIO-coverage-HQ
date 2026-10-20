import { describe, expect, it } from "vitest";
import { isBot, parseRequest } from "@/lib/request-form";

const today = "2026-10-20";
const good = {
  title: "  Barangay clean-up drive ",
  event_date: "2026-10-25",
  start_time: "08:00",
  venue: "Plaza Rizal",
  municipality: "daet",
  source: "community",
  requested_by: "Maria Santos",
  contact: "0917 123 4567",
  notes: "",
};

describe("public request form", () => {
  it("accepts a complete request and normalises it", () => {
    const r = parseRequest(good, today);
    expect(r).toEqual({
      ok: true,
      data: { ...good, title: "Barangay clean-up drive", notes: null },
    });
    expect(parseRequest({ ...good, start_time: "", contact: "maria@example.ph" }, today)).toMatchObject({
      ok: true,
      data: { start_time: null, contact: "maria@example.ph" },
    });
    expect(parseRequest({ ...good, event_date: today }, today).ok).toBe(true);
  });

  it("explains each problem in plain words", () => {
    const r = parseRequest(
      { ...good, title: " ", event_date: "2026-10-19", municipality: "manila", source: "", contact: "call me" },
      today,
    );
    expect(r).toEqual({
      ok: false,
      fieldErrors: {
        title: "Enter the event title.",
        event_date: "The event date can’t be in the past.",
        municipality: "Choose the municipality.",
        source: "Choose who is organising the event.",
        contact: "Enter a mobile number or an email address.",
      },
    });
  });

  it("rejects bad dates, far-future dates and odd times", () => {
    expect(parseRequest({ ...good, event_date: "2026-02-30" }, today)).toMatchObject({ ok: false, fieldErrors: { event_date: "Pick the event date." } });
    expect(parseRequest({ ...good, event_date: "2028-01-01" }, today)).toMatchObject({ ok: false, fieldErrors: { event_date: "Pick a date within the next year." } });
    expect(parseRequest({ ...good, start_time: "8am" }, today)).toMatchObject({ ok: false, fieldErrors: { start_time: "Use a time like 09:30." } });
    expect(parseRequest({ ...good, notes: "x".repeat(2001) }, today).ok).toBe(false);
  });

  it("spots the honeypot", () => {
    expect(isBot({ website: "http://spam.example" })).toBe(true);
    expect(isBot({ website: "  " })).toBe(false);
    expect(isBot({})).toBe(false);
  });
});
