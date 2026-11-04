import { HourglassIcon } from "lucide-react";
import type { Role } from "@/lib/constants";
import type { Staff } from "@/lib/types";
import { cn } from "@/lib/utils";
import { isMe, type Party, type Waiting } from "@/lib/waiting";

// No "use client": rendered by the board (client) and the dashboard (server).

const ROLE_PARTY: Record<Extract<Party, { kind: "role" }>["role"], string> = {
  head: "the head",
  proofreader: "a proofreader",
  page_admin: "a page admin",
};

/** "Ana R.", "Ana R. (inactive)", "the head", "a page admin". */
export function partyName(p: Party, staffById: Map<string, Staff>): string {
  if (p.kind === "role") return ROLE_PARTY[p.role];
  const s = staffById.get(p.id);
  if (!s) return "Unknown";
  return s.active ? s.display_name : `${s.display_name} (inactive)`;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * "Waiting on Ana R. · Finish the caption". `compact` (board cards) drops the
 * box and heading and lists "Ana R.: Finish the caption" one per line.
 */
export function WaitingOn({
  items,
  staffById,
  me = null,
  compact = false,
  className,
}: {
  items: Waiting[];
  staffById: Map<string, Staff>;
  me?: { id: string; roles: readonly Role[] } | null;
  compact?: boolean;
  className?: string;
}) {
  if (items.length === 0) return null;
  const name = (w: Waiting) => (isMe(w.who, me) ? "you" : partyName(w.who, staffById));

  if (compact) {
    // Tasks shown inline, not in a tooltip: phones can't hover.
    return (
      <ul className={cn("grid gap-0.5 text-[13px] text-muted-foreground", className)}>
        {items.map((w, i) => (
          <li key={i} className={cn("flex min-w-0 items-start gap-1.5", isMe(w.who, me) && "text-primary")}>
            <HourglassIcon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            <span className="min-w-0">
              <span className="sr-only">Waiting on </span>
              <span className="font-medium">{isMe(w.who, me) ? "You" : cap(name(w))}:</span> {w.task}
            </span>
          </li>
        ))}
      </ul>
    );
  }

  const mine = items.some((w) => isMe(w.who, me));
  return (
    <div className={cn("grid gap-1.5 rounded-lg border bg-muted/40 px-3 py-2", mine && "border-primary/40 bg-primary/[0.05]", className)}>
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <HourglassIcon aria-hidden className="size-3.5" /> Waiting on
      </p>
      <ul className="grid gap-1 text-sm">
        {items.map((w, i) => (
          <li key={i} className="flex flex-wrap items-baseline gap-x-2">
            <span className={cn("font-semibold", isMe(w.who, me) && "text-primary")}>{isMe(w.who, me) ? "You" : cap(partyName(w.who, staffById))}</span>
            <span className="text-muted-foreground">{w.task}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
