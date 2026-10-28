import { CalendarIcon, MapPinIcon, UserIcon } from "lucide-react";
import { Fragment } from "react";
import { StatusBadge } from "@/components/app/labels";
import { MUNICIPALITY_LABELS, SLOT_LABELS, SLOTS, type Slot } from "@/lib/constants";
import { formatEventDate } from "@/lib/format";
import { formatManila, manilaStartOfDay } from "@/lib/time";
import type { EventRow, Staff } from "@/lib/types";
import { cn } from "@/lib/utils";

// No "use client": the dashboard renders peeks on the server, the board on the client.

export function slotStaff(event: EventRow, slot: Slot, staffById: Map<string, Staff>): Staff | "unknown" | null {
  const id = event[`${slot}_id`];
  if (!id) return null;
  return staffById.get(id) ?? "unknown";
}

/** The peek: everything a head usually opens the event for, without leaving the page. */
export function EventPeek({ event, staffById }: { event: EventRow; staffById: Map<string, Staff> }) {
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
              <dt className="text-muted-foreground">{SLOT_LABELS[slot]}</dt>
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
