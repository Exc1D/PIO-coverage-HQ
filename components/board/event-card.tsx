"use client";

import { useDraggable } from "@dnd-kit/core";
import {
  CameraIcon,
  CheckCircle2Icon,
  GripVerticalIcon,
  PenLineIcon,
  ScissorsIcon,
  SpellCheckIcon,
  UserIcon,
  VideoIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { OverdueFlag, SourceChip } from "@/components/app/labels";
import { Peek } from "@/components/app/peek";
import { WaitingOn } from "@/components/app/waiting-on";
import { EventPeek, slotStaff } from "@/components/events/event-peek";
import { MUNICIPALITY_LABELS, SLOT_LABELS, SLOTS, SOURCE_COLORS, type Slot } from "@/lib/constants";
import { isStuck } from "@/lib/metrics";
import { formatEventDate } from "@/lib/format";
import type { EventRow, Staff } from "@/lib/types";
import { cn } from "@/lib/utils";
import { waitingOn } from "@/lib/waiting";
import { availability, type Actor } from "@/lib/workflow";

type Props = {
  event: EventRow;
  staffById: Map<string, Staff>;
  me: Actor | null;
  today: string;
  onToggle: (event: EventRow, field: "photos_done" | "caption_done", value: boolean) => void;
  overlay?: boolean;
};

// Partial so a new slot still renders (with the fallback icon and tone) before it gets its own.
const SLOT_ICON: Partial<Record<Slot, LucideIcon>> = {
  photographer: CameraIcon,
  videographer: VideoIcon,
  editor: ScissorsIcon,
  writer: PenLineIcon,
  proofreader: SpellCheckIcon,
};
const SLOT_TONE: Partial<Record<Slot, string>> = {
  photographer: "bg-sky-50 text-sky-900 ring-sky-200",
  videographer: "bg-violet-50 text-violet-900 ring-violet-200",
  editor: "bg-rose-50 text-rose-900 ring-rose-200",
  writer: "bg-amber-50 text-amber-900 ring-amber-200",
  proofreader: "bg-emerald-50 text-emerald-900 ring-emerald-200",
};
const FALLBACK_TONE = "bg-muted text-foreground ring-border";

function Assignee({ slot, event, staffById }: { slot: Slot; event: EventRow; staffById: Map<string, Staff> }) {
  const person = slotStaff(event, slot, staffById);
  if (!person) return null;
  const label = SLOT_LABELS[slot];
  const name = person === "unknown" ? "Unknown" : person.display_name;
  const Icon = SLOT_ICON[slot] ?? UserIcon;
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        SLOT_TONE[slot] ?? FALLBACK_TONE,
      )}
      title={`${label}: ${person === "unknown" ? name : person.full_name}`}
    >
      <Icon className="size-3 shrink-0 opacity-70" aria-hidden />
      <span className="sr-only">{label}: </span>
      <span className="truncate">{name}</span>
    </span>
  );
}

export function EventCard({ event, staffById, me, today, onToggle, overlay = false }: Props) {
  const canDrag = me !== null && event.status !== "cancelled";
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: event.id,
    disabled: !canDrag || overlay,
    data: { event },
  });
  const avail = availability(event, me);
  const stuck = isStuck(event, today);
  const showTicks = ["scheduled", "covered", "in_production", "for_proofreading"].includes(event.status);

  const tick = (field: "photos_done" | "caption_done", label: string, cmd: "set_photos_done" | "set_caption_done") => {
    const enabled = avail[cmd].state === "available";
    const id = `${event.id}-${field}${overlay ? "-overlay" : ""}`;
    return (
      <label htmlFor={id} className={cn("flex items-center gap-1.5 text-xs", !enabled && "text-muted-foreground")}>
        <input
          type="checkbox"
          id={id}
          checked={event[field]}
          disabled={!enabled}
          onChange={(e) => onToggle(event, field, e.target.checked)}
          aria-label={`${label} for ${event.title}`}
          className="size-4 accent-primary disabled:opacity-60"
        />
        {label}
      </label>
    );
  };

  return (
    <article
      ref={setNodeRef}
      className={cn(
        "group relative rounded-xl border border-l-4 bg-card p-3 shadow-xs transition-[box-shadow,transform,opacity] duration-200 ease-[var(--ease-ios)] hover:-translate-y-px hover:shadow-md",
        stuck && "border-red-300",
        isDragging && "scale-[0.98] opacity-40",
        // Picked up: lifts off the column with a little spring (globals.css).
        overlay && "ios-lift rotate-[1.5deg] scale-[1.03] cursor-grabbing shadow-2xl ring-1 ring-black/5",
      )}
      // Left stripe in the source colour; the source chip below carries the same information as text.
      style={{ borderLeftColor: event.source ? SOURCE_COLORS[event.source] : undefined }}
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
          <p className="mt-0.5 text-xs text-muted-foreground">
            {formatEventDate(event)}
            {event.municipality && <> · {MUNICIPALITY_LABELS[event.municipality]}</>}
          </p>
        </div>
        {canDrag && !overlay && (
          <button
            type="button"
            className="-mr-1 -mt-1 flex size-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
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
        {stuck && <OverdueFlag dueDate={event.due_date} />}
        {event.status === "scheduled" && event.coverage_confirmed && (
          <span className="inline-flex items-center gap-1 text-xs text-green-700">
            <CheckCircle2Icon className="size-3.5" aria-hidden /> Coverage confirmed
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {SLOTS.map((slot) => (
          <Assignee key={slot} slot={slot} event={event} staffById={staffById} />
        ))}
        {!event.writer_id && <span className="text-[11px] text-amber-700">No writer</span>}
        {!event.photographer_id && !event.videographer_id && <span className="text-[11px] text-amber-700">No photo/video</span>}
      </div>

      <WaitingOn items={waitingOn(event, today)} staffById={staffById} me={me} compact className="mt-2" />

      {showTicks && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t pt-2">
          {tick("photos_done", "Photos/Video", "set_photos_done")}
          {tick("caption_done", "Caption", "set_caption_done")}
        </div>
      )}
    </article>
  );
}
