import { HourglassIcon } from "lucide-react";
import type { Role } from "@/lib/constants";
import type { Staff } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { Party, Waiting } from "@/lib/waiting";

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

/** Is this party the signed-in person (by assignment, or by holding the role)? */
export function isMe(p: Party, me: { id: string; roles: readonly Role[] } | null): boolean {
  if (!me) return false;
  return p.kind === "staff" ? p.id === me.id : me.roles.includes(p.role);
}

/**
 * "Waiting on Ana R. · Finish the caption". `compact` (board cards) shows
 * only the names on one line, with the tasks in the tooltip.
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
  const mine = items.some((w) => isMe(w.who, me));

  if (compact) {
    const names = [...new Set(items.map(name))];
    return (
      <p
        className={cn("flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground", mine && "font-medium text-primary", className)}
        title={items.map((w) => `${name(w)}: ${w.task}`).join("\n")}
      >
        <HourglassIcon aria-hidden className="size-3 shrink-0" />
        <span className="truncate">Waiting on {names.join(", ")}</span>
      </p>
    );
  }

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
