"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { changedDetails } from "@/lib/command-preview";
import type { CommandPayload } from "@/lib/commands";
import type { EventRow } from "@/lib/types";
import { EventFields } from "./event-fields";

export function EditDetailsDialog({
  event,
  onClose,
  onSubmit,
}: {
  event: EventRow;
  onClose: () => void;
  /** Resolves to null once saved, otherwise to the reason it wasn't. */
  onSubmit: (payload: CommandPayload) => Promise<string | null>;
}) {
  // What the form opened with. A retry after a conflict gets a newer event, but the fields
  // keep what was typed, so comparing against this leaves other people's changes alone.
  const [opened] = useState(event);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const changes = changedDetails(opened, new FormData(e.currentTarget));
    setSaving(true);
    setError(null);
    const problem = await onSubmit({ type: "edit_details", changes });
    setSaving(false);
    if (problem) setError(problem);
    else onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={submit}>
          <fieldset disabled={saving} className="grid min-w-0 gap-4">
            <DialogHeader>
              <DialogTitle>Edit event details</DialogTitle>
            </DialogHeader>
            <EventFields values={opened} idPrefix="edit" requireSourceAndPlace={event.status !== "requested"} />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Discard changes
              </Button>
              <Button type="submit">
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  );
}
