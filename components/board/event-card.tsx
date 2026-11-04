"use client";

import { useDraggable } from "@dnd-kit/core";
import { ArrowRightIcon, CheckCircle2Icon, GripVerticalIcon } from "lucide-react";
import Link from "next/link";
import { memo } from "react";
import { LiveChip, SourceChip } from "@/components/app/labels";
import { Peek } from "@/components/app/peek";
import { WaitingOn } from "@/components/app/waiting-on";
import { Button } from "@/components/ui/button";
import { EventPeek } from "@/components/events/event-peek";
import { hasRegular, MUNICIPALITY_LABELS, STATUS_LABELS, type Status } from "@/lib/constants";
import { daysOverdue, isStuck } from "@/lib/metrics";
import { formatEventDate } from "@/lib/format";
import type { EventRow, Staff } from "@/lib/types";
import { cn } from "@/lib/utils";
import { isMe, waitingOn } from "@/lib/waiting";
import { dropCommand, nextStatus, tickLockReason, type Actor } from "@/lib/workflow";

type Props = {
  event: EventRow;
  staffById: Map<string, Staff>;
  me: Actor | null;
  today: string;
  onToggle: (event: EventRow, field: "photos_done" | "caption_done", value: boolean) => void;
  onMove: (event: EventRow, to: Status) => void;
  /** A save is running. Tapping Move slides the next card under the finger, so a second tap mustn't land on it. */
  pending?: boolean;
  overlay?: boolean;
};

const TICKS = [
  { field: "photos_done", label: "Photos/Video", cmd: "set_photos_done" },
  { field: "caption_done", label: "Caption", cmd: "set_caption_done" },
] as const;

// ponytail: a fixed line for "badly late" so a board full of stuck cards isn't all red. Tune it here if it marks too many or too few.
const VERY_LATE_DAYS = 7;

/**
 * Memoised: starting or ending a drag re-renders the board, and its props stay
 * stable (React Compiler, plus onToggle defined outside the cards loop), so
 * cards that didn't change skip that render. On a board of ~160 cards this cut
 * the freeze when a card is picked up from ~670ms to ~150ms (4x CPU throttle).
 */
export const EventCard = memo(function EventCard({ event, staffById, me, today, onToggle, onMove, pending = false, overlay = false }: Props) {
  const canDrag = me !== null && event.status !== "cancelled";
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: event.id,
    disabled: !canDrag || overlay,
    data: { event },
  });
  const next = overlay ? null : nextStatus(event.status, event.coverage);
  const canMove = next !== null && dropCommand(event, next, me).ok;
  const stuck = isStuck(event, today);
  const late = stuck ? daysOverdue(event, today) : 0;
  // One line: what's on you if anything, otherwise who's next. Everything else is in the drawer.
  const waiting = waitingOn(event, today);
  const nextUp = waiting.find((w) => isMe(w.who, me)) ?? waiting[0];
  // Only ticks this person can use. The drawer explains the locked ones.
  const ticks =
    hasRegular(event.coverage) && ["scheduled", "covered", "in_production", "for_proofreading"].includes(event.status)
      ? TICKS.filter((t) => tickLockReason(event, t.cmd, me) === null)
      : [];

  return (
    <article
      ref={setNodeRef}
      data-flip-id={overlay ? undefined : event.id}
      className={cn(
        "group relative rounded-xl border bg-card p-3 shadow-xs transition-[box-shadow,translate,scale,opacity] duration-200 ease-[var(--ease-ios)] hover:-translate-y-px hover:shadow-md",
        late >= VERY_LATE_DAYS && "border-red-300",
        isDragging && "scale-[0.98] opacity-40",
        // Picked up: lifts off the column (globals.css).
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
                className="relative -my-3.5 block rounded-sm py-3.5 text-sm font-semibold leading-snug hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="line-clamp-2">{event.title}</span>
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
        {stuck && (
          <span className="text-[13px] font-medium text-red-700">
            {late} day{late === 1 ? "" : "s"} late
          </span>
        )}
        {event.status === "scheduled" && event.coverage_confirmed && (
          <span className="inline-flex items-center gap-1 text-[13px] text-green-700" title="Coverage confirmed">
            <CheckCircle2Icon className="size-3.5" aria-hidden /> Confirmed
          </span>
        )}
      </div>

      {nextUp && <WaitingOn items={[nextUp]} staffById={staffById} me={me} compact className="mt-2" />}
      {waiting.length > 1 && !overlay && (
        <Link href={`/events/${event.id}`} className="ml-5 inline-flex min-h-11 items-center rounded-sm text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          and {waiting.length - 1} more
        </Link>
      )}

      {ticks.length > 0 && (
        <div className="-mb-2 mt-2 flex flex-wrap gap-x-4 border-t">
          {ticks.map(({ field, label }) => {
            const id = `${event.id}-${field}${overlay ? "-overlay" : ""}`;
            return (
              <label key={field} htmlFor={id} className="flex min-h-11 items-center gap-2 text-[13px]">
                <input
                  type="checkbox"
                  id={id}
                  checked={event[field]}
                  onChange={(e) => onToggle(event, field, e.target.checked)}
                  aria-label={`${label} for ${event.title}`}
                  className="size-5 shrink-0 accent-primary"
                />
                {label}
              </label>
            );
          })}
        </div>
      )}

      {canMove && (
        <Button
          variant="outline"
          className="mt-3 h-11 w-full"
          disabled={pending}
          aria-label={`Move ${event.title} to ${STATUS_LABELS[next]}`}
          onClick={() => onMove(event, next)}
        >
          Move to {STATUS_LABELS[next]} <ArrowRightIcon aria-hidden />
        </Button>
      )}
    </article>
  );
});
