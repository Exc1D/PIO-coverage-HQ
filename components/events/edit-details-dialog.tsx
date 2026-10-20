"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CommandPayload } from "@/lib/commands";
import type { Municipality, Source } from "@/lib/constants";
import type { EventRow } from "@/lib/types";
import { EventFields } from "./event-fields";

export function EditDetailsDialog({
  event,
  onClose,
  onSubmit,
}: {
  event: EventRow;
  onClose: () => void;
  onSubmit: (payload: CommandPayload) => void;
}) {
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const str = (k: string) => String(f.get(k) ?? "");
    const orNull = <T extends string>(k: string) => (str(k) === "" ? null : (str(k) as T));
    onSubmit({
      type: "edit_details",
      changes: {
        title: str("title"),
        event_date: str("event_date"),
        // DB times carry seconds ("09:00:00"); keep them when the minute is unchanged.
        start_time: str("start_time") === event.start_time?.slice(0, 5) ? event.start_time : str("start_time"),
        venue: str("venue"),
        municipality: orNull<Municipality>("municipality"),
        source: orNull<Source>("source"),
        requested_by: str("requested_by"),
        contact: str("contact"),
        notes: str("notes"),
      },
    });
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Edit event details</DialogTitle>
          </DialogHeader>
          <EventFields values={event} idPrefix="edit" requireSourceAndPlace={event.status !== "requested"} />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Discard changes
            </Button>
            <Button type="submit">Save changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
