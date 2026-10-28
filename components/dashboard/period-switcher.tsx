import Link from "next/link";
import type { Period } from "@/lib/metrics";
import { cn } from "@/lib/utils";
import { segmentedItem, segmentedList } from "@/components/app/segmented";

/** Plain links and a GET form: works before (and without) JavaScript. */
export function PeriodSwitcher({ period }: { period: Period }) {
  const tab = (kind: Period["kind"], label: string, href: string) => (
    <Link
      href={href}
      transitionTypes={["tab-switch"]}
      aria-current={period.kind === kind ? "page" : undefined}
      className={segmentedItem(period.kind === kind)}
    >
      {label}
    </Link>
  );
  const input =
    "h-9 rounded-md border border-input bg-background px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <nav aria-label="Period" className={segmentedList}>
        {tab("week", "This week", "/?period=week")}
        {tab("month", "This month", "/?period=month")}
      </nav>
      <details className="group relative" open={period.kind === "custom" || undefined}>
        <summary
          className={cn(
            "flex h-9 cursor-pointer list-none items-center rounded-md border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden",
            period.kind === "custom" && "border-primary font-medium",
          )}
        >
          Custom range
        </summary>
        <form action="/" method="get" className="mt-2 flex flex-wrap items-end gap-2 sm:absolute sm:right-0 sm:z-20 sm:rounded-lg sm:border sm:bg-popover sm:p-3 sm:shadow-md">
          <input type="hidden" name="period" value="custom" />
          <label className="grid gap-1 text-xs text-muted-foreground">
            From
            <input type="date" name="from" required defaultValue={period.kind === "custom" ? period.startDate : undefined} className={input} />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            To
            <input type="date" name="to" required defaultValue={period.kind === "custom" ? period.endDate : undefined} className={input} />
          </label>
          <button type="submit" className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            Apply
          </button>
        </form>
      </details>
    </div>
  );
}
