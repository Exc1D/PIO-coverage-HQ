"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { runEventCommand } from "@/app/actions/events";
import { parseCommand, type CommandPayload } from "@/lib/commands";
import { STATUS_LABELS } from "@/lib/constants";
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

  function run(event: EventRow, payload: CommandPayload, showOptimistic?: (next: Partial<EventRow>) => void) {
    if (!actor) {
      toast.error("Sign in with your PIN to make changes.");
      return;
    }
    const parsed = parseCommand(payload, staff);
    if (!parsed.ok) {
      toast.error(parsed.message);
      return;
    }
    const preview = applyCommand(event, parsed.command, actor, new Date());
    if (!preview.ok) {
      if (preview.code !== "no_change") toast.error(preview.message);
      return;
    }
    startTransition(async () => {
      showOptimistic?.(preview.next);
      const res = await runEventCommand(event.id, event.version, payload);
      if (!res.ok) toast.error(res.message);
      else if (preview.next.status !== event.status) toast.success(`Moved to ${STATUS_LABELS[preview.next.status]}`);
    });
  }

  return { run, pending, actor };
}
