"use client";

import { useDraggable } from "@dnd-kit/core";
import {
  CalendarIcon,
  CameraIcon,
  CheckCircle2Icon,
  GripVerticalIcon,
  MapPinIcon,
  PenLineIcon,
  ScissorsIcon,
  SpellCheckIcon,
  UserIcon,
  VideoIcon,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";
import { OverdueFlag, SourceChip, StatusBadge } from "@/components/app/labels";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { MUNICIPALITY_LABELS, ROLE_LABELS, SLOTS, SOURCE_COLORS, type Slot } from "@/lib/constants";
import { isStuck } from "@/lib/metrics";
import { formatEventDate } from "@/lib/format";
import { formatManila, manilaStartOfDay } from "@/lib/time";
import type { EventRow, Staff } from "@/lib/types";
import { cn } from "@/lib/utils";
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

function slotStaff(event: EventRow, slot: Slot, staffById: Map<string, Staff>): Staff | "unknown" | null {
  const id = event[`${slot}_id`];
  if (!id) return null;
  return staffById.get(id) ?? "unknown";
}

function Assignee({ slot, event, staffById }: { slot: Slot; event: EventRow; staffById: Map<string, Staff> }) {
  const person = slotStaff(event, slot, staffById);
  if (!person) return null;
  const label = ROLE_LABELS[slot];
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

/** The hover peek: everything a head usually opens the event for, without leaving the board. */
function EventPeek({ event, staffById }: { event: EventRow; staffById: Map<string, Staff> }) {
  const place = [event.venue, event.municipality && MUNICIPALITY_LABELS[event.municipality]].filter(Boolean).join(", ");
  return (
    <div className="grid gap-3 text-xs">
      <div className="grid gap-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold leading-snug">{event.title}</p>
          <StatusBadge status={event.status} className="shrink-0" />
        </div>
        <p className="flex items-center gap-1.5 text-muted-foreground">
          <CalendarIcon className="size-3.5 shrink-0" aria-hidden />
          {formatEventDate(event)}
        </p>
        {place && (
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <MapPinIcon className="size-3.5 shrink-0" aria-hidden />
            {place}
          </p>
        )}
        {(event.requested_by || event.contact) && (
          <p className="flex items-center gap-1.5 text-muted-foreground">
            <UserIcon className="size-3.5 shrink-0" aria-hidden />
            {[event.requested_by && `Requested by ${event.requested_by}`, event.contact].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-t pt-2">
        {SLOTS.map((slot) => {
          const person = slotStaff(event, slot, staffById);
          return (
            <Fragment key={slot}>
              <dt className="text-muted-foreground">{ROLE_LABELS[slot]}</dt>
              <dd className={cn("min-w-0 truncate", !person && "text-muted-foreground italic")}>
                {person === "unknown" ? "Unknown" : (person?.full_name ?? "Unassigned")}
              </dd>
            </Fragment>
          );
        })}
      </dl>

      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-2">
        <span className={event.photos_done ? "text-green-700" : "text-muted-foreground"}>
          {event.photos_done ? "✓" : "○"} Photos/Video
        </span>
        <span className={event.caption_done ? "text-green-700" : "text-muted-foreground"}>
          {event.caption_done ? "✓" : "○"} Caption
        </span>
        <span className="text-muted-foreground">Due {formatManila(manilaStartOfDay(event.due_date), "MMM d")}</span>
      </div>

      {event.notes && <p className="line-clamp-4 whitespace-pre-line border-t pt-2 text-muted-foreground">{event.notes}</p>}
    </div>
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
        "group relative rounded-lg border border-l-4 bg-card p-3 shadow-xs transition-[box-shadow,transform] hover:-translate-y-px hover:shadow-md",
        stuck && "border-red-300",
        isDragging && "opacity-40",
        overlay && "rotate-1 shadow-lg ring-2 ring-ring",
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
            <HoverCard>
              <HoverCardTrigger asChild>
                <Link
                  href={`/events/${event.id}`}
                  className="line-clamp-2 rounded-sm text-sm font-semibold leading-snug hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {event.title}
                </Link>
              </HoverCardTrigger>
              <HoverCardContent side="right" align="start" className="w-72">
                <EventPeek event={event} staffById={staffById} />
              </HoverCardContent>
            </HoverCard>
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

      {showTicks && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t pt-2">
          {tick("photos_done", "Photos/Video", "set_photos_done")}
          {tick("caption_done", "Caption", "set_caption_done")}
        </div>
      )}
    </article>
  );
}
