import { ArrowDownRightIcon, ArrowUpRightIcon, MinusIcon } from "lucide-react";
import Link from "next/link";
import { SourceChip } from "@/components/app/labels";
import { formatEventDate } from "@/lib/format";
import { STATUS_LABELS } from "@/lib/constants";
import type { PipelineStatus } from "@/lib/metrics";
import type { EventRow } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BAR_COLOR } from "@/lib/chart-colors";

// ---------------------------------------------------------------------------
// Stat tile: label, value, optional delta vs the previous period
// ---------------------------------------------------------------------------

export function StatTile({
  label,
  value,
  hint,
  delta,
  tone = "default",
}: {
  label: string;
  value: number;
  hint?: string;
  /** Change vs previous period; up is good for these tiles. */
  delta?: { value: number; against: string };
  tone?: "default" | "alert";
}) {
  const d = delta?.value ?? 0;
  const Icon = d > 0 ? ArrowUpRightIcon : d < 0 ? ArrowDownRightIcon : MinusIcon;
  return (
    <div role="group" aria-label={label} className={cn("rounded-xl border bg-card p-4", tone === "alert" && value > 0 && "border-red-200 bg-red-50/40")}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight" data-value={value}>
        {value.toLocaleString("en-PH")}
      </p>
      {delta ? (
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <Icon
            aria-hidden
            className={cn("size-3.5", d > 0 && "text-green-700", d < 0 && "text-red-700")}
          />
          <span>
            {d > 0 ? "+" : ""}
            {d} vs {delta.against}
          </span>
        </p>
      ) : (
        hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card shell with an always-available table view
// ---------------------------------------------------------------------------

export function ChartCard({
  title,
  description,
  children,
  table,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  table?: { head: string[]; rows: (string | number)[][] };
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col rounded-xl border bg-card p-4", className)} aria-label={title}>
      <h2 className="text-sm font-semibold">{title}</h2>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      <div className="mt-3 flex-1">{children}</div>
      {table && table.rows.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer rounded-sm text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Show as table
          </summary>
          <table className="mt-2 w-full text-left text-xs">
            <thead>
              <tr className="border-b text-muted-foreground">
                {table.head.map((h, i) => (
                  <th key={h} scope="col" className={cn("py-1 font-medium", i > 0 && "text-right")}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r) => (
                <tr key={String(r[0])} className="border-b last:border-0">
                  {r.map((c, i) => (
                    <td key={i} className={cn("py-1", i > 0 && "text-right tabular-nums")}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </section>
  );
}

export function EmptyChart({ children }: { children: React.ReactNode }) {
  return <p className="flex h-full min-h-24 items-center justify-center text-center text-sm text-muted-foreground">{children}</p>;
}

// ---------------------------------------------------------------------------
// Pipeline now: server-rendered horizontal bars (no client JS)
// ---------------------------------------------------------------------------

export function PipelineBars({ counts }: { counts: Record<PipelineStatus, number> }) {
  const entries = Object.entries(counts) as [PipelineStatus, number][];
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <ul className="grid gap-1.5">
      {entries.map(([status, value]) => (
        <li key={status} className="grid grid-cols-[10.5rem_1fr_2rem] items-center gap-2 text-sm">
          <Link
            href={`/board`}
            className="truncate rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {STATUS_LABELS[status]}
          </Link>
          <span className="h-[14px]" aria-hidden>
            {value > 0 && (
              <span
                className="block h-full rounded-r-[4px]"
                style={{ width: `${(value / max) * 100}%`, minWidth: 4, backgroundColor: BAR_COLOR }}
              />
            )}
          </span>
          <span className="text-right font-semibold tabular-nums">{value}</span>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Event lists
// ---------------------------------------------------------------------------

export function EventList({
  title,
  description,
  events,
  empty,
  meta,
  href,
}: {
  title: string;
  description: string;
  events: EventRow[];
  empty: string;
  meta: (e: EventRow) => React.ReactNode;
  href?: { label: string; to: string };
}) {
  return (
    <section className="flex flex-col rounded-xl border bg-card" aria-label={title}>
      <header className="flex items-baseline justify-between gap-2 border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">
            {title} <span className="ml-1 font-normal text-muted-foreground tabular-nums">{events.length}</span>
          </h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        {href && (
          <Link href={href.to} className="shrink-0 rounded-sm text-xs font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {href.label}
          </Link>
        )}
      </header>
      {events.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y">
          {events.slice(0, 8).map((e) => (
            <li key={e.id}>
              <Link
                href={`/events/${e.id}`}
                // Many links; prefetching each would pull the drawer's code into the dashboard load.
                prefetch={false}
                className="grid gap-1 px-4 py-2.5 hover:bg-accent/60 focus-visible:bg-accent focus-visible:outline-none"
              >
                <span className="line-clamp-1 text-sm font-medium">{e.title}</span>
                <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  {formatEventDate(e)}
                  <SourceChip source={e.source} short />
                  {meta(e)}
                </span>
              </Link>
            </li>
          ))}
          {events.length > 8 && <li className="px-4 py-2 text-xs text-muted-foreground">and {events.length - 8} more</li>}
        </ul>
      )}
    </section>
  );
}

