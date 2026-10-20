"use client";

import { CheckCircle2Icon } from "lucide-react";
import { useActionState, useState } from "react";
import { submitRequestAction, type RequestState } from "@/app/actions/request";
import { EventFields } from "@/components/events/event-fields";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { OFFLINE_MESSAGE } from "@/lib/offline";
import { HONEYPOT_FIELD } from "@/lib/request-constants";
import { formatManila, manilaStartOfDay } from "@/lib/time";

export function RequestForm() {
  const [state, action, pending] = useActionState<RequestState, FormData>(async (prev, formData) => {
    try {
      return await submitRequestAction(prev, formData);
    } catch {
      return { error: OFFLINE_MESSAGE, values: Object.fromEntries([...formData.entries()].map(([k, v]) => [k, String(v)])) };
    }
  }, undefined);
  // The action state can't be reset, so remember which confirmation was dismissed.
  const [dismissed, setDismissed] = useState<RequestState>(undefined);

  if (state?.submitted && state !== dismissed) {
    return (
      <div className="grid justify-items-center gap-3 py-6 text-center" role="status">
        <CheckCircle2Icon className="size-10 text-green-700" aria-hidden />
        <h2 className="text-lg font-semibold">Request received</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Thank you. The Provincial Information Office will review <strong className="text-foreground">{state.title}</strong>
          {state.date && <> on {formatManila(manilaStartOfDay(state.date), "MMMM d, yyyy")}</>} and contact you if they need more details.
        </p>
        <Button variant="outline" onClick={() => setDismissed(state)}>
          Send another request
        </Button>
      </div>
    );
  }

  const errors = (!state?.submitted && state?.fieldErrors) || {};
  const values = state?.submitted ? undefined : state?.values;
  return (
    // A fresh key after a dismissed confirmation gives an empty form.
    <form key={dismissed ? "again" : "first"} action={action} className="grid gap-5">
      {!state?.submitted && state?.error && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {Object.keys(errors).length > 0 && (
        <p role="alert" className="text-sm font-medium text-destructive">
          Please check the {Object.keys(errors).length === 1 ? "field" : `${Object.keys(errors).length} fields`} marked below.
        </p>
      )}
      {/* Keyed by the returned values: React's post-action form reset doesn't restore <select> defaults, a remount does. */}
      <EventFields key={JSON.stringify(values ?? {})} values={values} errors={errors} idPrefix="req" requireAll />

      {/* Honeypot: hidden from people and assistive tech; bots tend to fill it. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="req-website">Website</label>
        <input id="req-website" name={HONEYPOT_FIELD} type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <p className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
        <strong className="text-foreground">Privacy notice.</strong> We collect your name and contact detail only to
        coordinate coverage of this event, in line with the Data Privacy Act of 2012 (RA 10173). They are visible only to
        PIO staff and are not shared or used for anything else.
      </p>

      <Button type="submit" size="lg" className="h-11" disabled={pending}>
        {pending ? "Sending…" : "Send request"}
      </Button>
    </form>
  );
}
