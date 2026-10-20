import { FlagIcon } from "lucide-react";
import { SOURCE_COLORS, SOURCE_LABELS, STATUS_LABELS, type Source, type Status } from "@/lib/constants";
import { cn } from "@/lib/utils";

export const SOURCE_SHORT: Record<Source, string> = {
  provincial_government: "Provincial Gov't",
  other_lgu: "Other LGU",
  community: "Community",
  private: "Private",
};

/** Source chip: colour plus a text label, so colour is never the only signal. */
export function SourceChip({ source, short = false, className }: { source: Source | null; short?: boolean; className?: string }) {
  if (!source) {
    return (
      <span className={cn("inline-flex items-center rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground", className)}>
        No source
      </span>
    );
  }
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium", className)}
      style={{ borderColor: `${SOURCE_COLORS[source]}55`, backgroundColor: `${SOURCE_COLORS[source]}14` }}
      title={SOURCE_LABELS[source]}
    >
      <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: SOURCE_COLORS[source] }} />
      {short ? SOURCE_SHORT[source] : SOURCE_LABELS[source]}
    </span>
  );
}

const STATUS_TONE: Record<Status, string> = {
  requested: "bg-slate-100 text-slate-800 border-slate-300",
  scheduled: "bg-sky-50 text-sky-900 border-sky-200",
  covered: "bg-indigo-50 text-indigo-900 border-indigo-200",
  in_production: "bg-amber-50 text-amber-900 border-amber-200",
  for_proofreading: "bg-yellow-50 text-yellow-900 border-yellow-300",
  approved: "bg-teal-50 text-teal-900 border-teal-200",
  scheduled_for_posting: "bg-cyan-50 text-cyan-900 border-cyan-200",
  posted: "bg-green-50 text-green-900 border-green-300",
  cancelled: "bg-zinc-100 text-zinc-700 border-zinc-300 line-through decoration-1",
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium", STATUS_TONE[status], className)}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export function OverdueFlag({ dueDate, className }: { dueDate: string; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-md bg-red-50 px-1.5 py-0.5 text-xs font-semibold text-red-700", className)}
      title={`Past its posting target (${dueDate})`}
    >
      <FlagIcon aria-hidden className="size-3.5" />
      Overdue
    </span>
  );
}

/** "Ana R." → "AR"; "Grace Santos" → "GS". */
export function initials(displayName: string): string {
  const parts = displayName.replace(/\./g, "").trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
