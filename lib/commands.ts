// The wire format for event commands. Browsers send a CommandPayload
// (JSON-safe: dates are Manila wall-clock strings, people are IDs); the server
// validates it with zod and turns it into a workflow Command. Server-only at
// runtime: browsers import just the types, and preview with command-preview.ts
// so zod never ships to the client.

import { z } from "zod";
import { MUNICIPALITIES, SLOTS, SOURCES } from "./constants";
import { toCommand, type ToCommandResult } from "./command-preview";
import { isDateString } from "./time";
import type { Staff } from "./types";

const reason = z.string().trim().min(1, "A reason is required.").max(500, "Keep the reason under 500 characters.");
/** "yyyy-MM-ddTHH:mm" as produced by <input type="datetime-local">, in Manila time. */
const manilaLocal = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Pick a date and time.")
  .refine((v) => isDateString(v.slice(0, 10)), "Pick a valid date.");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable();

export const detailsSchema = z.object({
  title: z.string().trim().min(1, "Enter a title.").max(200),
  event_date: z.string().refine(isDateString, "Pick a valid date."),
  start_time: z
    .string()
    .regex(/^(\d{2}:\d{2}(:\d{2})?)?$/, "Use HH:mm.")
    .transform((v) => (v === "" ? null : v))
    .nullable(),
  venue: optionalText(200),
  municipality: z.enum(MUNICIPALITIES).nullable(),
  source: z.enum(SOURCES).nullable(),
  requested_by: optionalText(120),
  contact: optionalText(120),
  notes: optionalText(2000),
});

export const commandPayloadSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("schedule") }),
  z.object({ type: z.literal("set_coverage_confirmed"), value: z.boolean() }),
  z.object({ type: z.literal("mark_covered") }),
  z.object({ type: z.literal("start_production") }),
  z.object({ type: z.literal("set_photos_done"), value: z.boolean() }),
  z.object({ type: z.literal("set_caption_done"), value: z.boolean() }),
  z.object({ type: z.literal("approve") }),
  z.object({ type: z.literal("schedule_post"), scheduledPostAt: manilaLocal }),
  z.object({ type: z.literal("reschedule_post"), scheduledPostAt: manilaLocal }),
  z.object({
    type: z.literal("mark_posted"),
    postLink: z.string().trim().min(1, "Paste the Facebook post link.").max(500),
    postedAt: manilaLocal.optional(),
  }),
  z.object({ type: z.literal("cancel"), reason }),
  z.object({ type: z.literal("restore"), reason }),
  z.object({ type: z.literal("step_back"), reason, reset: z.enum(["caption", "photos", "both"]).optional() }),
  z.object({ type: z.literal("assign"), slot: z.enum(SLOTS), staffId: z.uuid().nullable() }),
  z.object({ type: z.literal("edit_details"), changes: detailsSchema.partial() }),
  z.object({ type: z.literal("edit_caption_text"), value: z.string().max(20000).nullable() }),
  z.object({ type: z.literal("edit_drive_link"), value: z.string().max(1000).nullable() }),
]);

export type CommandPayload = z.input<typeof commandPayloadSchema>;
export type ParsedPayload = z.output<typeof commandPayloadSchema>;

/** Parse untrusted input; returns a Command or a readable error. */
export function parseCommand(input: unknown, staff: readonly Staff[]): ToCommandResult {
  const parsed = commandPayloadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid request." };
  return toCommand(parsed.data, staff);
}
