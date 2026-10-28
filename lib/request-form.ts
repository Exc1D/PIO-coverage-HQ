// Public coverage request form: validation shared by the server action and tests.
// Collects only what RA 10173 data minimisation allows: the event, plus the
// requester's name and one contact detail.

import { z } from "zod";
import { COVERAGES, MUNICIPALITIES, SOURCES } from "./constants";
import { HONEYPOT_FIELD } from "./request-constants";
import { addDays, isDateString } from "./time";

export { HONEYPOT_FIELD };

/** Successful public requests allowed per IP per hour. */
export const REQUESTS_PER_HOUR = 5;
/** How far ahead a request may be dated. */
const MAX_DAYS_AHEAD = 366;

export const REQUEST_FIELDS = [
  "title",
  "event_date",
  "start_time",
  "venue",
  "municipality",
  "source",
  "coverage",
  "requested_by",
  "contact",
  "notes",
] as const;

const text = (label: string, max: number) =>
  z.string().trim().min(1, `Enter ${label}.`).max(max, `Keep ${label} under ${max} characters.`);

function schema(today: string) {
  return z.object({
    title: text("the event title", 200),
    event_date: z
      .string()
      .refine(isDateString, "Pick the event date.")
      .refine((d) => d >= today, "The event date can’t be in the past.")
      .refine((d) => d <= addDays(today, MAX_DAYS_AHEAD), "Pick a date within the next year."),
    start_time: z
      .string()
      .regex(/^(\d{2}:\d{2})?$/, "Use a time like 09:30.")
      .transform((v) => (v === "" ? null : v)),
    venue: text("the venue", 200),
    municipality: z.enum(MUNICIPALITIES, "Choose the municipality."),
    source: z.enum(SOURCES, "Choose who is organising the event."),
    coverage: z.enum(COVERAGES, "Choose the coverage you need."),
    requested_by: text("your name", 120),
    contact: text("a contact number or email", 120).refine(
      (v) => /\d{7,}/.test(v.replace(/[\s()+-]/g, "")) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      "Enter a mobile number or an email address.",
    ),
    notes: z
      .string()
      .trim()
      .max(2000, "Keep the notes under 2000 characters.")
      .transform((v) => (v === "" ? null : v)),
  });
}

export type RequestData = z.output<ReturnType<typeof schema>>;

export type ParsedRequest =
  | { ok: true; data: RequestData }
  | { ok: false; fieldErrors: Record<string, string> };

export function parseRequest(raw: Record<string, string>, today: string): ParsedRequest {
  const parsed = schema(today).safeParse(raw);
  if (parsed.success) return { ok: true, data: parsed.data };
  const fieldErrors: Record<string, string> = {};
  for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
  return { ok: false, fieldErrors };
}

/** Bots fill every field; people never see this one. */
export function isBot(raw: Record<string, string>): boolean {
  return (raw[HONEYPOT_FIELD] ?? "").trim() !== "";
}
