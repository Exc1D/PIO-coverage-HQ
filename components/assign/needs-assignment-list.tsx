"use client";

import { CheckCircle2Icon } from "lucide-react";
import Link from "next/link";
import { useOptimistic } from "react";
import { LiveChip, SourceChip, StatusBadge } from "@/components/app/labels";
import { Peek } from "@/components/app/peek";
import { EventPeek } from "@/components/events/event-peek";
import { useCommandRunner } from "@/components/events/use-command-runner";
import { hasLive, hasRegular, LIVE_SLOTS, MUNICIPALITY_LABELS, SLOT_LABELS, canFillSlot, type Coverage, type Slot } from "@/lib/constants";
import { formatEventDate, staffName } from "@/lib/format";
import { TEAM_GAP_LABELS, teamGaps, type TeamGap } from "@/lib/metrics";
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

const REGULAR_SLOTS: Slot[] = ["writer", "photographer", "videographer", "editor"];

/** The slots to pick on this page: the usual team, the live crew, or both. */
const slotsToAssign = (c: Coverage): Slot[] => [...(hasRegular(c) ? REGULAR_SLOTS : []), ...(hasLive(c) ? LIVE_SLOTS : [])];

/** The gap a slot helps fill (photographer and videographer share one). */
const SLOT_GAP: Partial<Record<Slot, TeamGap>> = {
  writer: "writer",
  photographer: "photo_video",
  videographer: "photo_video",
  cameraman: "cameraman",
  obs_tech: "obs_tech",
};

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
        const gaps = teamGaps(e);
        const done = gaps.length === 0;
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
                <LiveChip coverage={e.coverage} />
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
                  Missing: {gaps.map((g) => (g === "photo_video" ? "photographer or videographer" : TEAM_GAP_LABELS[g])).join(", ")}
                </span>
              )}
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {slotsToAssign(e.coverage).map((slot) => {
                const id = `${e.id}-${slot}`;
                const current = e[`${slot}_id`];
                const dayLoad = load[e.event_date] ?? {};
                const eligible = staff.filter((s) => (s.active && canFillSlot(s.roles, slot)) || s.id === current);
                const gap = SLOT_GAP[slot];
                const missing = gap !== undefined && gaps.includes(gap) && !current;
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
                          const who = staffName(staff, staffId);
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
                        {staffName(staff, current) ?? <span className="text-muted-foreground">Unassigned</span>}
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
