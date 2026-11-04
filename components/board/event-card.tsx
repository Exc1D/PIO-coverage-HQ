"use client";

import { useDraggable } from "@dnd-kit/core";
import {
  CameraIcon,
  CheckCircle2Icon,
  ClapperboardIcon,
  GripVerticalIcon,
  MonitorPlayIcon,
  PenLineIcon,
  ScissorsIcon,
  SpellCheckIcon,
  UserIcon,
  VideoIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { memo } from "react";
import { LiveChip, OverdueFlag, SourceChip } from "@/components/app/labels";
import { Peek } from "@/components/app/peek";
import { WaitingOn } from "@/components/app/waiting-on";
import { EventPeek, slotStaff } from "@/components/events/event-peek";
import { hasRegular, MUNICIPALITY_LABELS, SLOT_LABELS, slotsFor, type Slot } from "@/lib/constants";
import { isStuck, TEAM_GAP_LABELS, teamGaps } from "@/lib/metrics";
import { formatEventDate } from "@/lib/format";
import type { EventRow, Staff } from "@/lib/types";
import { cn } from "@/lib/utils";
import { waitingOn } from "@/lib/waiting";
import { tickLockReason, type Actor } from "@/lib/workflow";

type Props = {
  event: EventRow;
  staffById: Map<string, Staff>;
  me: Actor | null;
  today: string;
  onToggle: (event: EventRow, field: "photos_done" | "caption_done", value: boolean) => void;
  overlay?: boolean;
};

// Partial so a new slot still renders (with the fallback icon) before it gets its own.
const SLOT_ICON: Partial<Record<Slot, LucideIcon>> = {
  photographer: CameraIcon,
  videographer: VideoIcon,
  editor: ScissorsIcon,
  writer: PenLineIcon,
  proofreader: SpellCheckIcon,
  cameraman: ClapperboardIcon,
  obs_tech: MonitorPlayIcon,
};
function Assignee({ slot, event, staffById }: { slot: Slot; event: EventRow; staffById: Map<string, Staff> }) {
  const person = slotStaff(event, slot, staffById);
  if (!person) return null;
  const label = SLOT_LABELS[slot];
  const name = person === "unknown" ? "Unknown" : person.display_name;
  const Icon = SLOT_ICON[slot] ?? UserIcon;
  return (
    // Plain icon + name, not a coloured pill: colour on the card is kept for status (source, overdue, gaps).
    <span
      className="inline-flex max-w-full items-center gap-1"
      title={`${label}: ${person === "unknown" ? name : person.full_name}`}
    >
      <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="sr-only">{label}: </span>
      <span className="truncate">{name}</span>
    </span>
  );
}

/**
 * Memoised: starting or ending a drag re-renders the board, and its props stay
 * stable (React Compiler, plus onToggle defined outside the cards loop), so
 * cards that didn't change skip that render. On a board of ~160 cards this cut
 * the freeze when a card is picked up from ~670ms to ~150ms (4x CPU throttle).
 */
export const EventCard = memo(function EventCard({ event, staffById, me, today, onToggle, overlay = false }: Props) {
  const canDrag = me !== null && event.status !== "cancelled";
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: event.id,
    disabled: !canDrag || overlay,
    data: { event },
  });
  const stuck = isStuck(event, today);
  const gaps = teamGaps(event);
  const showTicks =
    hasRegular(event.coverage) && ["scheduled", "covered", "in_production", "for_proofreading"].includes(event.status);

  const tick = (field: "photos_done" | "caption_done", label: string, cmd: "set_photos_done" | "set_caption_done") => {
    const locked = tickLockReason(event, cmd, me);
    const id = `${event.id}-${field}${overlay ? "-overlay" : ""}`;
    return (
      <label htmlFor={id} className={cn("flex min-h-11 items-center gap-2 text-[13px]", locked && "text-muted-foreground")}>
        <input
          type="checkbox"
          id={id}
          checked={event[field]}
          disabled={locked !== null}
          onChange={(e) => onToggle(event, field, e.target.checked)}
          aria-label={`${label} for ${event.title}`}
          aria-describedby={locked ? `${id}-why` : undefined}
          className="size-5 shrink-0 accent-primary disabled:opacity-60"
        />
        <span className="grid">
          {label}
          {locked && (
            <span id={`${id}-why`} className="text-xs">
              {locked}
            </span>
          )}
        </span>
      </label>
    );
  };

  return (
    <article
      ref={setNodeRef}
      className={cn(
        "group relative rounded-xl border bg-card p-3 shadow-xs transition-[box-shadow,transform,opacity] duration-200 ease-[var(--ease-ios)] hover:-translate-y-px hover:shadow-md",
        stuck && "border-red-300",
        isDragging && "scale-[0.98] opacity-40",
        // Picked up: lifts off the column with a little spring (globals.css).
        overlay && "ios-lift rotate-[1.5deg] scale-[1.03] cursor-grabbing shadow-2xl ring-1 ring-black/5",
      )}
      aria-label={event.title}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          {overlay ? (
            <span className="line-clamp-2 text-sm font-semibold leading-snug">{event.title}</span>
          ) : (
            <Peek href={`/events/${event.id}`} label={event.title} preview={<EventPeek event={event} staffById={staffById} />}>
              <Link
                href={`/events/${event.id}`}
                className="line-clamp-2 rounded-sm text-sm font-semibold leading-snug hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {event.title}
              </Link>
            </Peek>
          )}
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {formatEventDate(event)}
            {event.municipality && <> · {MUNICIPALITY_LABELS[event.municipality]}</>}
          </p>
        </div>
        {canDrag && !overlay && (
          <button
            type="button"
            className="-mr-2 -mt-2 flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
            aria-label={`Move ${event.title}`}
            {...listeners}
            {...attributes}
          >
            <GripVerticalIcon className="size-4" aria-hidden />
          </button>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <SourceChip source={event.source} short />
        <LiveChip coverage={event.coverage} />
        {stuck && <OverdueFlag dueDate={event.due_date} />}
        {event.status === "scheduled" && event.coverage_confirmed && (
          <span className="inline-flex items-center gap-1 text-[13px] text-green-700" title="Coverage confirmed">
            <CheckCircle2Icon className="size-3.5" aria-hidden /> Confirmed
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[13px]">
        {slotsFor(event.coverage).map((slot) => (
          <Assignee key={slot} slot={slot} event={event} staffById={staffById} />
        ))}
        {gaps.length > 0 && (
          <span className="font-medium text-amber-800">
            No {gaps.map((gap) => TEAM_GAP_LABELS[gap]).join(", no ")}
          </span>
        )}
      </div>

      <WaitingOn items={waitingOn(event, today)} staffById={staffById} me={me} compact className="mt-2" />

      {showTicks && (
        <div className="-mb-2 mt-2 flex flex-wrap gap-x-4 border-t">
          {tick("photos_done", "Photos/Video", "set_photos_done")}
          {tick("caption_done", "Caption", "set_caption_done")}
        </div>
      )}
    </article>
  );
});
