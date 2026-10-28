"use client";

import { Undo2Icon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { restoreEventAction } from "@/app/actions/events";
import { StatusBadge } from "@/components/app/labels";
import { Button } from "@/components/ui/button";
import { formatEventDate } from "@/lib/format";
import { OFFLINE_MESSAGE } from "@/lib/offline";
import { formatManila } from "@/lib/time";
import type { DeletedEvent } from "@/lib/types";

const DAY = 86_400_000;
const KEEP_DAYS = 30; // prune_expired_data

/** Events deleted in the last 30 days, with who deleted them and a Restore button. */
export function RecentlyDeleted({ events, names, now }: { events: DeletedEvent[]; names: Record<string, string>; now: string }) {
  const [pending, startTransition] = useTransition();

  const restore = (e: DeletedEvent) =>
    startTransition(async () => {
      let res;
      try {
        res = await restoreEventAction(e.event_id);
      } catch {
        toast.error(OFFLINE_MESSAGE);
        return;
      }
      if (!res.ok) return void toast.error(res.message);
      toast.success(`“${e.title}” is back on the board`);
    });

  if (events.length === 0) {
    return <p className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">Nothing deleted in the last 30 days.</p>;
  }

  return (
    <ul className="divide-y rounded-xl border bg-card">
      {events.map((e) => {
        const daysLeft = Math.max(0, Math.ceil((Date.parse(e.deleted_at) + KEEP_DAYS * DAY - Date.parse(now)) / DAY));
        return (
          <li key={e.event_id} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                <span className="min-w-0 break-words">{e.title}</span>
                <StatusBadge status={e.status} />
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatEventDate({ event_date: e.event_date, start_time: null })} · deleted by {names[e.deleted_by_id] ?? "Unknown"}{" "}
                {formatManila(e.deleted_at, "MMM d, h:mm a")} · removed for good in {daysLeft} day{daysLeft === 1 ? "" : "s"}
              </p>
            </div>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => restore(e)} aria-label={`Restore ${e.title}`}>
              <Undo2Icon aria-hidden /> Restore
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

