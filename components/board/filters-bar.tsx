"use client";

import { FilterIcon, XIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MUNICIPALITIES, MUNICIPALITY_LABELS, SOURCES, SOURCE_LABELS } from "@/lib/constants";
import type { Staff } from "@/lib/types";
import { hasFilters, readFilters, RECENT_POSTED_DAYS } from "./board-filters";

const field =
  "h-10 w-full rounded-md border border-input bg-background px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** Updates the query string in place; the board re-filters instantly without a server round trip. */
function setParam(key: string, value: string | null) {
  const params = new URLSearchParams(window.location.search);
  if (value) params.set(key, value);
  else params.delete(key);
  const qs = params.toString();
  window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
}

export function FiltersBar({ staff }: { staff: Staff[] }) {
  const f = readFilters(new URLSearchParams(useSearchParams()));
  const active = hasFilters(f);
  // Opens by itself when the page loads filtered; after that only the person opens or
  // closes it, so clearing the last filter doesn't fold the panel away mid-edit.
  const [open, setOpen] = useState(active);

  return (
    <details className="group rounded-lg border bg-card" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <FilterIcon className="size-4" aria-hidden />
        Filters
        {active && <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">On</span>}
        <span className="ml-auto text-xs text-muted-foreground group-open:hidden">Source, place, person, dates</span>
      </summary>
      <div className="grid gap-3 border-t p-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="grid gap-1.5">
          <Label htmlFor="f-source">Source</Label>
          <select id="f-source" className={field} value={f.source ?? ""} onChange={(e) => setParam("source", e.target.value || null)}>
            <option value="">All sources</option>
            {SOURCES.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="f-muni">Municipality</Label>
          <select id="f-muni" className={field} value={f.municipality ?? ""} onChange={(e) => setParam("municipality", e.target.value || null)}>
            <option value="">All municipalities</option>
            {MUNICIPALITIES.map((m) => (
              <option key={m} value={m}>
                {MUNICIPALITY_LABELS[m]}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="f-person">Person</Label>
          <select id="f-person" className={field} value={f.person ?? ""} onChange={(e) => setParam("person", e.target.value || null)}>
            <option value="">Everyone</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.display_name}
                {s.active ? "" : " (inactive)"}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="f-from">Event date from</Label>
          <input id="f-from" type="date" className={field} value={f.from ?? ""} max={f.to ?? undefined} onChange={(e) => setParam("from", e.target.value || null)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="f-to">to</Label>
          <input id="f-to" type="date" className={field} value={f.to ?? ""} min={f.from ?? undefined} onChange={(e) => setParam("to", e.target.value || null)} />
        </div>
        <div className="flex items-end justify-between gap-2 lg:flex-col lg:items-stretch">
          <label className="flex h-10 items-center gap-2 text-sm">
            <input type="checkbox" className="size-4 accent-primary" checked={f.cancelled} onChange={(e) => setParam("cancelled", e.target.checked ? "1" : null)} />
            Show cancelled
          </label>
          {active && (
            <Button variant="ghost" size="sm" onClick={() => window.history.replaceState(null, "", window.location.pathname)}>
              <XIcon aria-hidden /> Clear
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-6">
          Without a date range, Posted shows the last {RECENT_POSTED_DAYS} days.
        </p>
      </div>
    </details>
  );
}
