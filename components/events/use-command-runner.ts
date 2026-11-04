"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { runEventCommand } from "@/app/actions/events";
import { previewCommand } from "@/lib/command-preview";
import type { CommandPayload } from "@/lib/commands";
import { STATUS_LABELS } from "@/lib/constants";
import { OFFLINE_MESSAGE } from "@/lib/offline";
import type { EventRow, Staff } from "@/lib/types";
import { applyCommand, type Actor } from "@/lib/workflow";

/**
 * Run a command with an optimistic preview: the workflow module computes the
 * result locally, `showOptimistic` displays it inside a transition, and the
 * server confirms. If the server rejects, the transition ends without new
 * props and the optimistic state rolls back on its own.
 */
export function useCommandRunner(staff: readonly Staff[], me: Staff | null) {
  const [pending, startTransition] = useTransition();
  const actor: Actor | null = me ? { id: me.id, roles: me.roles } : null;

  /**
   * Resolves to null once saved (or nothing changed), otherwise to the reason it
   * wasn't. Forms use this to stay open with what was typed until the save lands.
   */
  function attempt(
    event: EventRow,
    payload: CommandPayload,
    showOptimistic?: (next: Partial<EventRow>) => void,
    successMessage?: string,
  ): Promise<string | null> {
    if (!actor) return Promise.resolve("Sign in with your PIN to make changes.");
    const parsed = previewCommand(payload, staff);
    if (!parsed.ok) return Promise.resolve(parsed.message);
    const preview = applyCommand(event, parsed.command, actor, new Date());
    if (!preview.ok) return Promise.resolve(preview.code === "no_change" ? null : preview.message);
    return new Promise((resolve) => {
      startTransition(async () => {
        // The server bumps the version once per saved command; mirror that so a second
        // quick action on the same event (e.g. ticking both boxes) sends the right one.
        showOptimistic?.({ ...preview.next, version: event.version + 1 });
        let res;
        try {
          res = await runEventCommand(event.id, event.version, payload);
        } catch {
          // Network failure: the optimistic change rolls back when the transition ends.
          resolve(OFFLINE_MESSAGE);
          return;
        }
        if (!res.ok) {
          resolve(res.message);
          return;
        }
        if (successMessage) toast.success(successMessage);
        else if (preview.next.status !== event.status) toast.success(`Moved to ${STATUS_LABELS[preview.next.status]}`);
        resolve(null);
      });
    });
  }

  /** For one-tap actions with nothing typed to protect: failures show as a toast. */
  function run(...args: Parameters<typeof attempt>) {
    void attempt(...args).then((problem) => {
      if (problem) toast.error(problem);
    });
  }

  return { run, attempt, pending, actor };
}
