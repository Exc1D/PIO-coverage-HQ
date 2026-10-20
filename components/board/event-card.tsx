"use client";

import { useDraggable } from "@dnd-kit/core";
import { CheckCircle2Icon, GripVerticalIcon } from "lucide-react";
import Link from "next/link";
import { initials, OverdueFlag, SourceChip } from "@/components/app/labels";
import { MUNICIPALITY_LABELS } from "@/lib/constants";
import { isStuck } from "@/lib/metrics";
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

export function formatEventDate(e: Pick<EventRow, "event_date" | "start_time">): string {
  const day = formatManila(manilaStartOfDay(e.event_date), "EEE, MMM d");
  if (!e.start_time) return day;
  const [h, m] = e.start_time.split(":").map(Number);
  const t = `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  return `${day} · ${t}`;
}

function Assignee({ label, id, staffById }: { label: string; id: string | null; staffById: Map<string, Staff> }) {
  if (!id) return null;
  const name = staffById.get(id)?.display_name ?? "Unknown";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium"
      title={`${label}: ${name}`}
    >
      <span className="text-muted-foreground">{label[0]}</span>
      <span aria-hidden>{initials(name)}</span>
      <span className="sr-only">
        {label}: {name}
      </span>
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
        "group relative rounded-lg border bg-card p-3 shadow-xs transition-shadow",
        stuck && "border-red-300",
        isDragging && "opacity-40",
        overlay && "rotate-1 shadow-lg ring-2 ring-ring",
      )}
      aria-label={event.title}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Link
            href={`/events/${event.id}`}
            className="line-clamp-2 rounded-sm text-sm font-semibold leading-snug hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {event.title}
          </Link>
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
        <Assignee label="Photographer" id={event.photographer_id} staffById={staffById} />
        <Assignee label="Videographer" id={event.videographer_id} staffById={staffById} />
        <Assignee label="Writer" id={event.writer_id} staffById={staffById} />
        <Assignee label="Proofreader" id={event.proofreader_id} staffById={staffById} />
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
