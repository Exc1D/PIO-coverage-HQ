"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { deleteEventAction } from "@/app/actions/events";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { OFFLINE_MESSAGE } from "@/lib/offline";
import type { EventRow } from "@/lib/types";

/**
 * Confirms and runs a permanent delete. `inDrawer` decides where to go after:
 * the drawer closes back to the page underneath, the full page goes to the board.
 */
export function DeleteEventDialog({
  event,
  open,
  inDrawer,
  onClose,
}: {
  event: Pick<EventRow, "id" | "title" | "version">;
  open: boolean;
  inDrawer: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      let res;
      try {
        res = await deleteEventAction(event.id, event.version);
      } catch {
        toast.error(OFFLINE_MESSAGE);
        return;
      }
      // Already gone (another tab or person deleted it): same outcome as success.
      if (!res.ok && res.code !== "not_found") {
        // Close so a conflict shows the reloaded event before anyone retries.
        toast.error(res.message);
        onClose();
        return;
      }
      toast.success(res.ok ? "Event deleted" : "This event was already deleted");
      onClose();
      if (inDrawer) {
        // Refresh the page underneath once back() has landed on it, not the drawer route.
        window.addEventListener("popstate", () => router.refresh(), { once: true });
        router.back();
      } else {
        router.replace("/board");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && !pending && onClose()}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete this event?</DialogTitle>
          <DialogDescription className="line-clamp-2">{event.title}</DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          This permanently removes the event and its activity history from the board, calendar and reports. It
          can&apos;t be undone. To keep a record, use <strong>Cancel event</strong> instead.
        </p>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Never mind
          </Button>
          <Button type="button" variant="destructive" onClick={confirm} disabled={pending}>
            {pending ? "Deleting…" : "Delete event"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
