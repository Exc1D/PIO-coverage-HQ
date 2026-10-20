"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MUNICIPALITIES, MUNICIPALITY_LABELS, SOURCES, SOURCE_LABELS } from "@/lib/constants";

export type EventFieldValues = Partial<
  Record<
    "title" | "event_date" | "start_time" | "venue" | "municipality" | "source" | "requested_by" | "contact" | "notes",
    string | null
  >
>;

const select =
  "h-11 w-full rounded-md border border-input bg-background px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm";

/** The editable event fields, shared by "New event", "Edit details" and (later) the public request form. */
export function EventFields({
  values = {},
  errors = {},
  requireSourceAndPlace = true,
  idPrefix = "ev",
}: {
  values?: EventFieldValues;
  errors?: Record<string, string>;
  requireSourceAndPlace?: boolean;
  idPrefix?: string;
}) {
  const id = (k: string) => `${idPrefix}-${k}`;
  const err = (k: string) =>
    errors[k] ? (
      <p id={`${id(k)}-error`} className="text-sm text-destructive">
        {errors[k]}
      </p>
    ) : null;
  const aria = (k: string) => ({
    "aria-invalid": errors[k] ? true : undefined,
    "aria-describedby": errors[k] ? `${id(k)}-error` : undefined,
  });
  const v = (k: keyof EventFieldValues) => values[k] ?? "";

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor={id("title")}>Event title</Label>
        <Input id={id("title")} name="title" required maxLength={200} defaultValue={v("title")} className="h-11" {...aria("title")} />
        {err("title")}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor={id("event_date")}>Date</Label>
          <Input id={id("event_date")} name="event_date" type="date" required defaultValue={v("event_date")} className="h-11" {...aria("event_date")} />
          {err("event_date")}
        </div>
        <div className="grid gap-2">
          <Label htmlFor={id("start_time")}>Start time (optional)</Label>
          <Input id={id("start_time")} name="start_time" type="time" defaultValue={v("start_time")?.slice(0, 5)} className="h-11" {...aria("start_time")} />
          {err("start_time")}
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={id("venue")}>Venue</Label>
        <Input id={id("venue")} name="venue" maxLength={200} defaultValue={v("venue")} className="h-11" {...aria("venue")} />
        {err("venue")}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={id("municipality")}>Municipality</Label>
          <select id={id("municipality")} name="municipality" required={requireSourceAndPlace} defaultValue={v("municipality")} className={select} {...aria("municipality")}>
            <option value="">Choose…</option>
            {MUNICIPALITIES.map((m) => (
              <option key={m} value={m}>
                {MUNICIPALITY_LABELS[m]}
              </option>
            ))}
          </select>
          {err("municipality")}
        </div>
        <div className="grid gap-2">
          <Label htmlFor={id("source")}>Event source</Label>
          <select id={id("source")} name="source" required={requireSourceAndPlace} defaultValue={v("source")} className={select} {...aria("source")}>
            <option value="">Choose…</option>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABELS[s]}
              </option>
            ))}
          </select>
          {err("source")}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor={id("requested_by")}>Requested by (optional)</Label>
          <Input id={id("requested_by")} name="requested_by" maxLength={120} defaultValue={v("requested_by")} className="h-11" {...aria("requested_by")} />
          {err("requested_by")}
        </div>
        <div className="grid gap-2">
          <Label htmlFor={id("contact")}>Contact (optional)</Label>
          <Input id={id("contact")} name="contact" maxLength={120} defaultValue={v("contact")} className="h-11" {...aria("contact")} />
          {err("contact")}
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={id("notes")}>Notes (optional)</Label>
        <Textarea id={id("notes")} name="notes" maxLength={2000} rows={3} defaultValue={v("notes")} {...aria("notes")} />
        {err("notes")}
      </div>
    </div>
  );
}
