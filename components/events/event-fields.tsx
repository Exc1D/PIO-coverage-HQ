"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { COVERAGE_LABELS, COVERAGES, MUNICIPALITIES, MUNICIPALITY_LABELS, SOURCES, SOURCE_COLORS, SOURCE_LABELS, type Coverage } from "@/lib/constants";
import { cn } from "@/lib/utils";

export type EventFieldValues = Partial<
  Record<
    | "title"
    | "event_date"
    | "start_time"
    | "venue"
    | "municipality"
    | "source"
    | "coverage"
    | "requested_by"
    | "contact"
    | "notes",
    string | null
  >
>;

const select =
  "h-11 w-full rounded-md border border-input bg-background px-3 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm";

/** What each coverage option means, shown under its name. */
const COVERAGE_HINTS: Record<Coverage, string> = {
  regular: "We cover the event and post photos, video and a write-up afterwards.",
  live: "We broadcast the event live on the PIO Facebook page.",
  live_and_regular: "Both: a live broadcast, then photos, video and a write-up.",
};

/**
 * The event form, shared by the public request form, "New event" and "Edit details".
 *
 * Laid out the way form-usability guidance recommends: one column, labels above
 * fields, questions grouped under a heading in the order people think about an
 * event (what and when, where, who, what coverage, contact), radio buttons for
 * short choices so every option is visible, and a hint under a label only where
 * the label alone isn't enough.
 */
export function EventFields({
  values = {},
  errors = {},
  requireSourceAndPlace = true,
  requireAll = false,
  idPrefix = "ev",
}: {
  values?: EventFieldValues;
  errors?: Record<string, string>;
  requireSourceAndPlace?: boolean;
  /** Public form: venue, requester and contact are required too, and wording speaks to the requester. */
  requireAll?: boolean;
  idPrefix?: string;
}) {
  const id = (k: string) => `${idPrefix}-${k}`;
  const hintId = (k: string) => `${id(k)}-hint`;
  const err = (k: string) =>
    errors[k] ? (
      <p id={`${id(k)}-error`} className="text-sm font-medium text-destructive">
        {errors[k]}
      </p>
    ) : null;
  /** aria-describedby for a field: its hint (if any), then its error. */
  const aria = (k: string, hint = false) => {
    const describedBy = [hint && hintId(k), errors[k] && `${id(k)}-error`].filter(Boolean).join(" ");
    return { "aria-invalid": errors[k] ? true : undefined, "aria-describedby": describedBy || undefined };
  };
  const v = (k: keyof EventFieldValues) => values[k] ?? "";
  // Staff start from the usual coverage; the public form makes the requester choose.
  const coverage = v("coverage") || (requireAll ? "" : "regular");
  const optional = (label: string) => (
    <>
      {label} <span className="font-normal text-muted-foreground">(optional)</span>
    </>
  );

  return (
    <div className="grid gap-6">
      <Section legend="The event">
        <div className="grid gap-2">
          <Label htmlFor={id("title")}>Event title</Label>
          <p id={hintId("title")} className="text-xs text-muted-foreground">
            For example, “Barangay clean-up drive”.
          </p>
          {err("title")}
          <Input id={id("title")} name="title" required maxLength={200} defaultValue={v("title")} className="h-11" {...aria("title", true)} />
        </div>
        {/* Date and time belong together, so they share a row. */}
        <div className="grid grid-cols-2 gap-3">
          <div className="grid content-start gap-2">
            <Label htmlFor={id("event_date")}>Date</Label>
            {err("event_date")}
            <Input id={id("event_date")} name="event_date" type="date" required defaultValue={v("event_date")} className="h-11" {...aria("event_date")} />
          </div>
          <div className="grid content-start gap-2">
            <Label htmlFor={id("start_time")}>{optional("Start time")}</Label>
            {err("start_time")}
            <Input id={id("start_time")} name="start_time" type="time" defaultValue={v("start_time")?.slice(0, 5)} className="h-11" {...aria("start_time")} />
          </div>
        </div>
      </Section>

      <Section legend="Where">
        <div className="grid gap-2">
          <Label htmlFor={id("venue")}>{requireAll ? "Venue" : optional("Venue")}</Label>
          {err("venue")}
          <Input id={id("venue")} name="venue" required={requireAll} maxLength={200} defaultValue={v("venue")} className="h-11" {...aria("venue")} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={id("municipality")}>{requireSourceAndPlace ? "Municipality" : optional("Municipality")}</Label>
          {err("municipality")}
          <select id={id("municipality")} name="municipality" required={requireSourceAndPlace} defaultValue={v("municipality")} className={select} {...aria("municipality")}>
            <option value="">Choose…</option>
            {MUNICIPALITIES.map((m) => (
              <option key={m} value={m}>
                {MUNICIPALITY_LABELS[m]}
              </option>
            ))}
          </select>
        </div>
      </Section>

      <RadioGroup
        name="source"
        legend={requireAll ? "Who is organising it?" : requireSourceAndPlace ? "Event source" : optional("Event source")}
        idPrefix={id("source")}
        error={err("source")}
        aria={aria("source")}
        required={requireSourceAndPlace}
        defaultValue={v("source")}
        options={SOURCES.map((s) => ({
          value: s,
          label: SOURCE_LABELS[s],
          swatch: SOURCE_COLORS[s],
        }))}
      />

      <RadioGroup
        name="coverage"
        legend={requireAll ? "What coverage do you need?" : "Coverage"}
        idPrefix={id("coverage")}
        error={err("coverage")}
        aria={aria("coverage")}
        required
        defaultValue={coverage}
        options={COVERAGES.map((c) => ({ value: c, label: COVERAGE_LABELS[c], hint: COVERAGE_HINTS[c] }))}
      />

      <Section legend={requireAll ? "Your contact details" : optional("Requester")}>
        {requireAll && (
          <p className="-mt-1 text-xs text-muted-foreground">So we can reach you if we need more details. Only PIO staff see these.</p>
        )}
        <div className="grid gap-2">
          <Label htmlFor={id("requested_by")}>{requireAll ? "Your name" : "Name"}</Label>
          {err("requested_by")}
          <Input id={id("requested_by")} name="requested_by" required={requireAll} autoComplete={requireAll ? "name" : undefined} maxLength={120} defaultValue={v("requested_by")} className="h-11" {...aria("requested_by")} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={id("contact")}>Mobile number or email</Label>
          {err("contact")}
          <Input id={id("contact")} name="contact" required={requireAll} autoComplete={requireAll ? "tel" : undefined} maxLength={120} defaultValue={v("contact")} className="h-11" {...aria("contact")} />
        </div>
      </Section>

      <div className="grid gap-2">
        <Label htmlFor={id("notes")}>{optional(requireAll ? "Anything else we should know?" : "Notes")}</Label>
        <p id={hintId("notes")} className="text-xs text-muted-foreground">
          For example, the program flow, guests of honour or who to look for on the day.
        </p>
        {err("notes")}
        <Textarea id={id("notes")} name="notes" maxLength={2000} rows={3} defaultValue={v("notes")} {...aria("notes", true)} />
      </div>
    </div>
  );
}

/** A group of related questions under one heading. */
function Section({ legend, children }: { legend: React.ReactNode; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-4">
      <legend className="mb-3 text-base font-semibold">{legend}</legend>
      {children}
    </fieldset>
  );
}

/** One question with a few answers, all visible at once. */
function RadioGroup({
  name,
  legend,
  idPrefix,
  options,
  defaultValue,
  required,
  error,
  aria,
}: {
  name: string;
  legend: React.ReactNode;
  idPrefix: string;
  options: { value: string; label: string; hint?: string; swatch?: string }[];
  defaultValue: string;
  required?: boolean;
  error: React.ReactNode;
  aria: { "aria-invalid"?: boolean; "aria-describedby"?: string };
}) {
  return (
    <fieldset className="grid gap-2" aria-invalid={aria["aria-invalid"]} aria-describedby={aria["aria-describedby"]}>
      <legend className="mb-3 text-base font-semibold">{legend}</legend>
      {error}
      <div className={cn("grid gap-2", options.every((o) => !o.hint) && "sm:grid-cols-2")}>
        {options.map((o) => {
          const optId = `${idPrefix}-${o.value}`;
          return (
            <label
              key={o.value}
              htmlFor={optId}
              className={cn(
                "flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:bg-accent has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
                aria["aria-invalid"] && "border-destructive",
              )}
            >
              <input
                type="radio"
                id={optId}
                name={name}
                value={o.value}
                required={required}
                defaultChecked={defaultValue === o.value}
                aria-describedby={o.hint ? `${optId}-hint` : undefined}
                className="mt-0.5 size-4 shrink-0 accent-primary"
              />
              <span className="grid gap-0.5">
                <span className="flex items-center gap-2 text-sm font-medium">
                  {o.swatch && <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: o.swatch }} />}
                  {o.label}
                </span>
                {o.hint && (
                  <span id={`${optId}-hint`} className="text-xs text-muted-foreground">
                    {o.hint}
                  </span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
