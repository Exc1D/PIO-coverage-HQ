"use client";

import { CheckCircle2Icon } from "lucide-react";
import Link from "next/link";
import { useOptimistic } from "react";
import { SourceChip, StatusBadge } from "@/components/app/labels";
import { Peek } from "@/components/app/peek";
import { EventPeek } from "@/components/events/event-peek";
import { useCommandRunner } from "@/components/events/use-command-runner";
import { MUNICIPALITY_LABELS, SLOT_LABELS, canFillSlot, type Slot } from "@/lib/constants";
import { formatEventDate } from "@/lib/format";
import type { EventRow, Staff } from "@/lib/types";
import { cn } from "@/lib/utils";
import { availability } from "@/lib/workflow";

type Props = {
  events: EventRow[];
  staff: Staff[];
  me: Staff | null;
  /** date → staff id → number of events that person is on that day */
  load: Record<string, Record<string, number>>;
};

const SLOTS: Slot[] = ["writer", "photographer", "videographer", "editor"];

const select =
  "h-11 w-full rounded-md border border-input bg-background px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-60";

export function NeedsAssignmentList({ events, staff, me, load }: Props) {
  const { run, actor } = useCommandRunner(staff, me);
  const staffById = new Map(staff.map((s) => [s.id, s]));
  const [items, patch] = useOptimistic(events, (state: EventRow[], p: { id: string; next: Partial<EventRow> }) =>
    state.map((e) => (e.id === p.id ? { ...e, ...p.next } : e)),
  );

  return (
    <ul className="grid gap-3">
      {items.map((e) => {
        const canAssign = availability(e, actor).assign.state === "available";
        const missingWriter = !e.writer_id;
        const missingMedia = !e.photographer_id && !e.videographer_id;
        const done = !missingWriter && !missingMedia;
        return (
          <li key={e.id} className={cn("rounded-xl border bg-card p-4", done && "border-green-300 bg-green-50/40")}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <Peek href={`/events/${e.id}`} label={e.title} preview={<EventPeek event={e} staffById={staffById} />}>
                  <Link href={`/events/${e.id}`} prefetch={false} className="font-semibold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {e.title}
                  </Link>
                </Peek>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {formatEventDate(e)}
                  {e.venue && <> · {e.venue}</>}
                  {e.municipality && <> · {MUNICIPALITY_LABELS[e.municipality]}</>}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <SourceChip source={e.source} short />
                <StatusBadge status={e.status} />
              </div>
            </div>
            <p className="mt-2 text-sm font-medium">
              {done ? (
                <span className="inline-flex items-center gap-1 text-green-800">
                  <CheckCircle2Icon className="size-4" aria-hidden /> Team assigned
                </span>
              ) : (
                <span className="text-amber-800">
                  Missing: {[missingWriter && "writer", missingMedia && "photographer or videographer"].filter(Boolean).join(" and ")}
                </span>
              )}
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {SLOTS.map((slot) => {
                const id = `${e.id}-${slot}`;
                const current = e[`${slot}_id`];
                const dayLoad = load[e.event_date] ?? {};
                const eligible = staff.filter((s) => (s.active && canFillSlot(s.roles, slot)) || s.id === current);
                const missing = slot === "writer" ? missingWriter : missingMedia && !current;
                return (
                  <div key={slot} className="grid gap-1.5">
                    <label htmlFor={id} className={cn("text-xs font-medium", missing ? "text-amber-800" : "text-muted-foreground")}>
                      {SLOT_LABELS[slot]}
                    </label>
                    {canAssign ? (
                      <select
                        id={id}
                        className={select}
                        value={current ?? ""}
                        onChange={(ev) => {
                          const staffId = ev.target.value || null;
                          const who = staff.find((s) => s.id === staffId)?.display_name;
                          run(
                            e,
                            { type: "assign", slot, staffId },
                            (next) => patch({ id: e.id, next }),
                            who ? `${who} assigned as ${SLOT_LABELS[slot].toLowerCase()}` : `${SLOT_LABELS[slot]} unassigned`,
                          );
                        }}
                      >
                        <option value="">Unassigned</option>
                        {eligible.map((s) => {
                          // Other events this person is already on that day (excluding this one).
                          const busy = (dayLoad[s.id] ?? 0) - (s.id === current ? 1 : 0);
                          return (
                            <option key={s.id} value={s.id}>
                              {s.display_name}
                              {busy > 0 ? ` · ${busy} other event${busy === 1 ? "" : "s"} that day` : ""}
                              {s.active ? "" : " (inactive)"}
                            </option>
                          );
                        })}
                      </select>
                    ) : (
                      <p className="flex h-11 items-center text-sm">
                        {current ? staff.find((s) => s.id === current)?.display_name : <span className="text-muted-foreground">Unassigned</span>}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
