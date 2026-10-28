"use client";

import { useId } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import type { CommandPayload } from "@/lib/commands";
import { STATUS_LABELS } from "@/lib/constants";
import { formatManila } from "@/lib/time";
import { isFacebookPostUrl } from "@/lib/urls";
import type { EventRow } from "@/lib/types";
import { previousStatus, type CommandType } from "@/lib/workflow";

/** Commands that need extra input before they can run. */
export type InputCommand = Extract<
  CommandType,
  "schedule_post" | "reschedule_post" | "mark_posted" | "step_back" | "cancel" | "restore" | "request_caption_changes"
>;

export const INPUT_COMMANDS: readonly InputCommand[] = [
  "schedule_post",
  "reschedule_post",
  "mark_posted",
  "step_back",
  "cancel",
  "restore",
  "request_caption_changes",
];

const manilaLocalNow = () => formatManila(new Date(), "yyyy-MM-dd'T'HH:mm");

function defaultPostTime(event: Pick<EventRow, "scheduled_post_at">): string {
  if (event.scheduled_post_at) return formatManila(event.scheduled_post_at, "yyyy-MM-dd'T'HH:mm");
  // Tomorrow, 6 PM Manila
  const tomorrow = formatManila(new Date(Date.now() + 86_400_000), "yyyy-MM-dd");
  return `${tomorrow}T18:00`;
}

const TITLES: Record<InputCommand, string> = {
  schedule_post: "Schedule the Facebook post",
  reschedule_post: "Change the posting schedule",
  mark_posted: "Mark as posted",
  step_back: "Move back one step",
  cancel: "Cancel this event",
  restore: "Restore this event",
  request_caption_changes: "Request caption changes",
};

const SUBMIT: Record<InputCommand, string> = {
  schedule_post: "Schedule post",
  reschedule_post: "Save schedule",
  mark_posted: "Mark as posted",
  step_back: "Move back",
  cancel: "Cancel event",
  restore: "Restore",
  request_caption_changes: "Send back to writer",
};

export function CommandDialog({
  event,
  type,
  onClose,
  onSubmit,
}: {
  event: Pick<EventRow, "title" | "status" | "scheduled_post_at" | "cancelled_from_status">;
  type: InputCommand | null;
  onClose: () => void;
  onSubmit: (payload: CommandPayload) => void;
}) {
  const id = useId();
  const open = type !== null;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!type) return;
    const f = new FormData(e.currentTarget);
    const str = (k: string) => String(f.get(k) ?? "");
    let payload: CommandPayload;
    switch (type) {
      case "schedule_post":
      case "reschedule_post":
        payload = { type, scheduledPostAt: str("when") };
        break;
      case "mark_posted": {
        // The input's pattern can't express the exact hosts the server accepts; check here
        // so a rejected link keeps the dialog open instead of closing and losing it.
        const link = e.currentTarget.elements.namedItem("postLink") as HTMLInputElement;
        if (!isFacebookPostUrl(link.value)) {
          link.setCustomValidity("Paste the Facebook post link (facebook.com or fb.watch).");
          link.reportValidity();
          return;
        }
        payload = { type, postLink: str("postLink"), postedAt: str("when") || undefined };
        break;
      }
      case "step_back":
        payload = {
          type,
          reason: str("reason"),
          reset: event.status === "for_proofreading" ? (str("reset") as "caption" | "photos" | "both") : undefined,
        };
        break;
      default:
        payload = { type, reason: str("reason") };
    }
    onSubmit(payload);
    onClose();
  }

  const back = previousStatus(event.status);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        {type && (
          <form onSubmit={submit} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>{TITLES[type]}</DialogTitle>
              <DialogDescription className="line-clamp-2">{event.title}</DialogDescription>
            </DialogHeader>

            {(type === "schedule_post" || type === "reschedule_post") && (
              <div className="grid gap-2">
                <Label htmlFor={`${id}-when`}>Post on (Manila time)</Label>
                <Input id={`${id}-when`} name="when" type="datetime-local" required defaultValue={defaultPostTime(event)} className="h-11" />
              </div>
            )}

            {type === "mark_posted" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor={`${id}-link`}>Facebook post link</Label>
                  <Input
                    id={`${id}-link`}
                    name="postLink"
                    type="url"
                    inputMode="url"
                    required
                    placeholder="https://www.facebook.com/…"
                    pattern="https://.*(facebook\.com|fb\.watch)/.+"
                    title="A facebook.com or fb.watch link"
                    onChange={(e) => e.currentTarget.setCustomValidity("")}
                    className="h-11"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor={`${id}-when`}>Posted at (Manila time)</Label>
                  <Input id={`${id}-when`} name="when" type="datetime-local" required defaultValue={manilaLocalNow()} max={manilaLocalNow()} className="h-11" />
                </div>
              </>
            )}

            {type === "step_back" && back && (
              <p className="text-sm text-muted-foreground">
                From <strong>{STATUS_LABELS[event.status]}</strong> back to <strong>{STATUS_LABELS[back]}</strong>.
              </p>
            )}
            {type === "restore" && (
              <p className="text-sm text-muted-foreground">
                Returns to <strong>{STATUS_LABELS[event.cancelled_from_status ?? "requested"]}</strong>.
              </p>
            )}

            {type === "step_back" && event.status === "for_proofreading" && (
              <fieldset className="grid gap-2">
                <legend className="mb-1 text-sm font-medium">Send back for</legend>
                {(
                  [
                    ["caption", "Caption changes (unticks Caption done)"],
                    ["photos", "Photo/video changes (unticks Photos/Video done)"],
                    ["both", "Both"],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2 text-sm">
                    <input type="radio" name="reset" value={value} defaultChecked={value === "caption"} className="size-4 accent-primary" />
                    {label}
                  </label>
                ))}
              </fieldset>
            )}

            {type === "request_caption_changes" && (
              <p className="text-sm text-muted-foreground">
                Moves the event back to <strong>In production</strong> and unticks <strong>Caption done</strong>. The
                writer sees your note above the caption. For small typos, use <strong>Correct caption</strong> instead.
              </p>
            )}
            {type === "request_caption_changes" && (
              <div className="grid gap-2">
                <Label htmlFor={`${id}-reason`}>What needs changing</Label>
                <Textarea
                  id={`${id}-reason`}
                  name="reason"
                  required
                  maxLength={500}
                  rows={4}
                  placeholder="e.g. Use the governor's full title in the first line; confirm the barangay name"
                />
              </div>
            )}

            {(type === "step_back" || type === "cancel" || type === "restore") && (
              <div className="grid gap-2">
                <Label htmlFor={`${id}-reason`}>Reason</Label>
                <Textarea id={`${id}-reason`} name="reason" required maxLength={500} rows={3} placeholder="e.g. Caption needs the governor's full title" />
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Never mind
              </Button>
              <Button type="submit" variant={type === "cancel" ? "destructive" : "default"}>
                {SUBMIT[type]}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
