// Turning a CommandPayload into a workflow Command, without zod, so the
// browser can preview optimistic changes cheaply. The server always
// re-validates with the zod schema in commands.ts.

import type { CommandPayload, ParsedPayload } from "./commands";
import { manilaDateTime } from "./time";
import type { Staff } from "./types";
import type { Command, EditableDetails } from "./workflow";

export type ToCommandResult = { ok: true; command: Command } | { ok: false; message: string };

/** Turn a validated payload into a workflow Command. */
export function toCommand(p: ParsedPayload, staff: readonly Staff[]): ToCommandResult {
  const at = (v: string) => manilaDateTime(v.slice(0, 10), v.slice(11));
  switch (p.type) {
    case "schedule_post":
    case "reschedule_post":
      return { ok: true, command: { type: p.type, scheduledPostAt: at(p.scheduledPostAt) } };
    case "mark_posted":
      return {
        ok: true,
        command: { type: "mark_posted", postLink: p.postLink, postedAt: p.postedAt ? at(p.postedAt) : undefined },
      };
    case "assign": {
      if (p.staffId === null) return { ok: true, command: { type: "assign", slot: p.slot, assignee: null } };
      const s = staff.find((x) => x.id === p.staffId);
      if (!s) return { ok: false, message: "That staff member no longer exists." };
      return { ok: true, command: { type: "assign", slot: p.slot, assignee: { id: s.id, roles: s.roles, active: s.active } } };
    }
    case "edit_details":
      return { ok: true, command: { type: "edit_details", changes: p.changes as Partial<EditableDetails> } };
    default:
      return { ok: true, command: p };
  }
}

const OPTIONAL_TEXT = new Set(["venue", "requested_by", "contact", "notes", "start_time"]);

/**
 * Client-side preview: the same conversion on an unvalidated payload, with
 * the schema's light normalisation (trim; blank optional text → null).
 */
export function previewCommand(p: CommandPayload, staff: readonly Staff[]): ToCommandResult {
  if (p.type !== "edit_details") return toCommand(p as ParsedPayload, staff);
  const changes: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(p.changes)) {
    const t = typeof v === "string" ? v.trim() : v;
    changes[k] = OPTIONAL_TEXT.has(k) && t === "" ? null : t;
  }
  return toCommand({ type: "edit_details", changes } as ParsedPayload, staff);
}

const DETAIL_FIELDS = ["title", "event_date", "start_time", "venue", "municipality", "source", "coverage", "requested_by", "contact", "notes"] as const;

/** The event form's fields that differ from what it opened with. Empty fields read as "", missing values as null. */
export function changedDetails(opened: Record<(typeof DETAIL_FIELDS)[number], string | null>, form: FormData) {
  const changes: Record<string, string | null> = {};
  for (const key of DETAIL_FIELDS) {
    const value = String(form.get(key) ?? "");
    // The time input shows minutes; the database keeps seconds too.
    const was = key === "start_time" ? opened[key]?.slice(0, 5) : opened[key];
    if (value !== (was ?? "")) changes[key] = value === "" && (key === "municipality" || key === "source") ? null : value;
  }
  return changes as Extract<CommandPayload, { type: "edit_details" }>["changes"];
}
