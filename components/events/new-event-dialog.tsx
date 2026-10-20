"use client";

import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { toast } from "sonner";
import { createEventAction, type CreateEventState } from "@/app/actions/events";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EventFields } from "./event-fields";

/** Head-only: add an event. On save it opens in the drawer for scheduling and assigning. */
export function NewEventDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [state, action, pending] = useActionState(async (prev: CreateEventState, formData: FormData) => {
    const result = await createEventAction(prev, formData);
    if (result?.createdId) {
      setOpen(false);
      setFormKey((k) => k + 1);
      toast.success("Event added");
      router.push(`/events/${result.createdId}`);
    }
    return result;
  }, undefined);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusIcon aria-hidden /> New event
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <form key={formKey} action={action} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>New event</DialogTitle>
            <DialogDescription>
              It starts as Requested. Schedule it and assign the team in the panel that opens next.
            </DialogDescription>
          </DialogHeader>
          {state?.error && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <EventFields
            key={JSON.stringify(state?.values ?? {})}
            values={state?.createdId ? {} : state?.values} errors={state?.fieldErrors} idPrefix="new" />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Discard
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Add event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
