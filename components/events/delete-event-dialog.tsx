"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteEventAction, restoreEventAction } from "@/app/actions/events";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OFFLINE_MESSAGE } from "@/lib/offline";
import type { EventRow } from "@/lib/types";

const CONFIRM_WORD = "delete";

/**
 * Confirms and runs a delete. The database keeps a copy for 30 days, so the
 * success toast offers Undo and the head can restore it later from Staff.
 * A posted event is on public record and counts in reports, so it also needs
 * the word "delete" typed. `inDrawer` decides where to go after: the drawer
 * closes back to the page underneath, the full page goes to the board.
 * `onCancelInstead` (when cancelling is allowed) offers the reversible option.
 */
export function DeleteEventDialog({
  event,
  open,
  inDrawer,
  onClose,
  onCancelInstead,
}: {
  event: Pick<EventRow, "id" | "title" | "version" | "status">;
  open: boolean;
  inDrawer: boolean;
  onClose: () => void;
  onCancelInstead?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [typed, setTyped] = useState("");
  const needsTyping = event.status === "posted";
  const confirmed = !needsTyping || typed.trim().toLowerCase() === CONFIRM_WORD;

  function close() {
    setTyped("");
    onClose();
  }

  function undo() {
    // Runs after navigation, from the toast; the event page is a fresh route.
    void restoreEventAction(event.id).then(
      (res) => {
        if (!res.ok) return void toast.error(res.message);
        toast.success("Event restored", {
          action: { label: "Open", onClick: () => router.push(`/events/${event.id}`) },
        });
      },
      () => toast.error(OFFLINE_MESSAGE),
    );
  }

  function confirm() {
    if (!confirmed) return;
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
        close();
        return;
      }
      if (res.ok) {
        toast.success("Event deleted", { duration: 10_000, action: { label: "Undo", onClick: undo } });
      } else {
        toast.success("This event was already deleted");
      }
      close();
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
    <Dialog open={open} onOpenChange={(o) => !o && !pending && close()}>
      <DialogContent className="sm:max-w-md">
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            confirm();
          }}
        >
          <DialogHeader>
            <DialogTitle>Delete this event?</DialogTitle>
            <DialogDescription className="line-clamp-2">{event.title}</DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This removes the event and its activity history from the board, calendar and reports. You can undo it
            right after, or restore it from <strong>Staff → Recently deleted</strong> for 30 days. After that
            it&apos;s gone for good.
          </p>
          {onCancelInstead && (
            <p className="text-sm text-muted-foreground">
              Not happening any more? Cancelling keeps it on record and can be reversed at any time.
            </p>
          )}
          {needsTyping && (
            <div className="grid gap-1.5">
              <Label htmlFor="delete-confirm">
                This event is posted and counts in reports. Type <strong>{CONFIRM_WORD}</strong> to confirm.
              </Label>
              <Input
                id="delete-confirm"
                className="h-11"
                autoComplete="off"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                disabled={pending}
              />
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={close} disabled={pending}>
              Never mind
            </Button>
            {onCancelInstead && (
              <Button
                type="button"
                variant="secondary"
                disabled={pending}
                onClick={() => {
                  close();
                  onCancelInstead();
                }}
              >
                Cancel event instead
              </Button>
            )}
            <Button type="submit" variant="destructive" disabled={pending || !confirmed}>
              {pending ? "Deleting…" : "Delete event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
