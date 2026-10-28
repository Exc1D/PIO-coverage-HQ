"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  pointerWithin,
  rectIntersection,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { InboxIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useOptimistic, useState } from "react";
import { toast } from "sonner";
import { CommandDialog, type InputCommand } from "@/components/events/command-dialog";
import { useCommandRunner } from "@/components/events/use-command-runner";
import { STATUS_ACCENT } from "@/components/app/labels";
import type { CommandPayload } from "@/lib/commands";
import { PIPELINE, STATUS_LABELS, type Status } from "@/lib/constants";
import type { EventRow, Staff } from "@/lib/types";
import { cn } from "@/lib/utils";
import { dropCommand } from "@/lib/workflow";
import { matchesFilters, readFilters } from "./board-filters";
import { EventCard } from "./event-card";

type Props = {
  events: EventRow[];
  staff: Staff[];
  me: Staff | null;
  today: string;
};

type Patch = { id: string; next: Partial<EventRow> };

// The drop target is the column under the pointer. dnd-kit's default picks the
// column the dragged card overlaps most, and since the handle sits at the card's
// right edge, the card hangs over columns that are scrolled out of view (on a
// phone, a one-step move landed two columns away). Keyboard drags have no
// pointer, so they keep the default.
const collisionDetection: CollisionDetection = (args) =>
  args.pointerCoordinates ? pointerWithin(args) : rectIntersection(args);

// The default edge scroll (20% edge zone, up to ~2000px/s) races past the
// neighbouring column before the finger can stop. Slower and narrower, the next
// column has time to arrive under the pointer.
const AUTO_SCROLL = { acceleration: 2, threshold: { x: 0.15, y: 0.2 } };

export function Board({ events, staff, me, today }: Props) {
  const filters = readFilters(new URLSearchParams(useSearchParams()));
  const staffById = new Map(staff.map((s) => [s.id, s]));
  const { run: runCommand, actor } = useCommandRunner(staff, me);
  const [optimistic, applyOptimistic] = useOptimistic(events, (state: EventRow[], p: Patch) =>
    state.map((e) => (e.id === p.id ? { ...e, ...p.next } : e)),
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ event: EventRow; type: InputCommand } | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  function run(event: EventRow, payload: CommandPayload) {
    runCommand(event, payload, (next) => applyOptimistic({ id: event.id, next }));
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const event = optimistic.find((x) => x.id === e.active.id);
    const to = e.over?.id as Status | undefined;
    if (!event || !to) return;
    const r = dropCommand(event, to, actor);
    if (!r.ok) {
      if (r.code !== "no_change") toast.error(r.message);
      return;
    }
    if (r.needsInput) setDialog({ event, type: r.type as InputCommand });
    else run(event, { type: r.type } as CommandPayload);
  }

  const visible = optimistic.filter((e) => matchesFilters(e, filters, today));
  const columns: Status[] = filters.cancelled ? [...PIPELINE, "cancelled"] : [...PIPELINE];
  const active = activeId ? optimistic.find((e) => e.id === activeId) ?? null : null;

  return (
    <DndContext
      id="pipeline-board"
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
      collisionDetection={collisionDetection}
      autoScroll={AUTO_SCROLL}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) => `Picked up ${titleOf(optimistic, active.id)}.`,
          onDragOver: ({ active, over }) =>
            over ? `${titleOf(optimistic, active.id)} is over ${STATUS_LABELS[over.id as Status]}.` : undefined,
          onDragEnd: ({ active, over }) =>
            over ? `Dropped ${titleOf(optimistic, active.id)} on ${STATUS_LABELS[over.id as Status]}.` : "Dropped.",
          onDragCancel: ({ active }) => `Cancelled moving ${titleOf(optimistic, active.id)}.`,
        },
      }}
    >
      <div
        // Snapping is off while dragging: with mandatory snap, each small auto-scroll step
        // jumps a whole column, so the board flew to the first or last column.
        className={cn("-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-4 md:snap-none", active ? "snap-none" : "snap-mandatory")}
        role="list"
        aria-label="Pipeline columns"
      >
        {columns.map((status) => {
          const cards = visible.filter((e) => e.status === status);
          const legal = active ? dropCommand(active, status, actor).ok : null;
          return (
            <Column key={status} status={status} count={cards.length} legal={active?.status === status ? null : legal}>
              {cards.length === 0 ? (
                <p className="flex flex-col items-center gap-1 py-6 text-center text-xs text-muted-foreground">
                  <InboxIcon className="size-4" aria-hidden />
                  Nothing here
                </p>
              ) : (
                cards.map((e) => (
                  <EventCard
                    key={e.id}
                    event={e}
                    staffById={staffById}
                    me={actor}
                    today={today}
                    onToggle={(ev, field, value) =>
                      run(ev, { type: field === "photos_done" ? "set_photos_done" : "set_caption_done", value })
                    }
                  />
                ))
              )}
            </Column>
          );
        })}
      </div>

      <DragOverlay>
        {active ? (
          <EventCard event={active} staffById={staffById} me={actor} today={today} onToggle={() => {}} overlay />
        ) : null}
      </DragOverlay>

      {dialog && (
        <CommandDialog
          event={dialog.event}
          type={dialog.type}
          onClose={() => setDialog(null)}
          onSubmit={(payload) => run(dialog.event, payload)}
        />
      )}
    </DndContext>
  );
}

function titleOf(events: EventRow[], id: string | number): string {
  return events.find((e) => e.id === id)?.title ?? "event";
}

function Column({
  status,
  count,
  legal,
  children,
}: {
  status: Status;
  count: number;
  legal: boolean | null;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section
      ref={setNodeRef}
      role="listitem"
      aria-label={`${STATUS_LABELS[status]}, ${count} event${count === 1 ? "" : "s"}`}
      style={{ borderTopColor: STATUS_ACCENT[status] }}
      className={cn(
        "flex w-[82vw] max-w-[300px] shrink-0 snap-start flex-col rounded-xl border border-t-4 bg-muted/40 sm:w-72",
        legal === true && "border-green-500/60 bg-green-50/60",
        legal === false && "opacity-60",
        isOver && legal === true && "ring-2 ring-green-500",
        isOver && legal === false && "ring-2 ring-red-400",
      )}
    >
      <header className="flex items-center justify-between px-3 py-2.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: STATUS_ACCENT[status] }} />
          {STATUS_LABELS[status]}
        </h2>
        <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
          {count}
        </span>
      </header>
      <div className="flex flex-1 flex-col gap-2 px-2 pb-2">{children}</div>
    </section>
  );
}
