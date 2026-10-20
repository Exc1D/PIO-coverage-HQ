import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { PrintButton } from "@/components/reports/print-button";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SOURCE_COLORS } from "@/lib/constants";
import { loadReport } from "@/lib/data/reports";
import { nextPeriod, previousPeriod, type Period } from "@/lib/metrics";
import { reportPeriod } from "@/lib/period-params";
import { formatManila, manilaDate } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage({ searchParams }: PageProps<"/reports">) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 print:max-w-none print:px-0 print:py-0">
      <Suspense fallback={<ReportSkeleton />}>
        <Report searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

const qs = (p: Period, extra: Record<string, string> = {}) =>
  new URLSearchParams({ kind: p.kind, date: p.startDate, ...extra }).toString();

const th = "px-2 py-2 text-left font-medium text-muted-foreground print:text-black";
const td = "px-2 py-1.5 align-top";

async function Report({ searchParams }: { searchParams: PageProps<"/reports">["searchParams"] }) {
  await connection();
  const now = new Date();
  const period = reportPeriod(await searchParams, now);
  const prev = previousPeriod(period);
  const next = nextPeriod(period);
  const isFuture = next.startDate > manilaDate(now);
  const report = await loadReport(period);
  const t = report.peopleTotals;
  // Switching Monthly <-> Weekly keeps today's week/month when it's in view, else the period start.
  const today = manilaDate(now);
  const anchor = today >= period.startDate && today <= period.endDate ? today : period.startDate;
  const switchTo = (kind: "week" | "month") => new URLSearchParams({ kind, date: anchor }).toString();

  return (
    <div className="grid gap-6 print:gap-4">
      {/* Print-only letterhead */}
      <div className="hidden print:block">
        <p className="text-sm">Provincial Information Office · Camarines Norte</p>
        <h1 className="text-xl font-semibold">Coverage report: {period.label}</h1>
        <p className="text-xs">
          {period.startDate} to {period.endDate} (Asia/Manila) · Generated {formatManila(now, "MMM d, yyyy h:mm a")}
        </p>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground">Posted events and who did the work, by week or month.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={`/reports/export?${qs(period, { table: "posts" })}`} download>
              <DownloadIcon aria-hidden /> Posts CSV
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={`/reports/export?${qs(period, { table: "people" })}`} download>
              <DownloadIcon aria-hidden /> People CSV
            </a>
          </Button>
          <PrintButton />
        </div>
      </div>

      {/* Period picker */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3 print:hidden">
        <nav aria-label="Report type" className="inline-flex rounded-lg bg-muted p-1">
          {(["month", "week"] as const).map((k) => (
            <Link
              key={k}
              href={`/reports?${switchTo(k)}`}
              aria-current={period.kind === k ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                period.kind === k && "bg-background font-medium text-foreground shadow-xs",
              )}
            >
              {k === "month" ? "Monthly" : "Weekly"}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="icon" aria-label={`Previous ${period.kind}`}>
            <Link href={`/reports?${qs(prev)}`}>
              <ChevronLeftIcon />
            </Link>
          </Button>
          <span className="min-w-40 text-center text-sm font-semibold">{period.label}</span>
          {isFuture ? (
            <Button variant="ghost" size="icon" disabled aria-label={`Next ${period.kind}`}>
              <ChevronRightIcon />
            </Button>
          ) : (
            <Button asChild variant="ghost" size="icon" aria-label={`Next ${period.kind}`}>
              <Link href={`/reports?${qs(next)}`}>
                <ChevronRightIcon />
              </Link>
            </Button>
          )}
        </div>
        <form action="/reports" method="get" className="flex items-end gap-2">
          <input type="hidden" name="kind" value={period.kind} />
          <label className="grid gap-1 text-xs text-muted-foreground">
            Jump to the {period.kind} containing
            <input
              type="date"
              name="date"
              required
              defaultValue={period.startDate}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          </label>
          <Button type="submit" size="sm" variant="secondary">
            Go
          </Button>
        </form>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5 print:grid-cols-5">
        <div className="rounded-xl border p-3">
          <p className="text-xs text-muted-foreground">Total posts</p>
          <p className="text-2xl font-semibold">{report.totalPosts}</p>
        </div>
        {report.groups.map((g) => (
          <div key={g.label} className="rounded-xl border p-3">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {g.source && <span aria-hidden className="size-2.5 rounded-[3px] print:hidden" style={{ backgroundColor: SOURCE_COLORS[g.source] }} />}
              {g.label}
            </p>
            <p className="text-2xl font-semibold">{g.rows.length}</p>
          </div>
        ))}
      </div>

      {/* Posts by source */}
      <section aria-labelledby="posts-h" className="grid gap-2 print:break-inside-auto">
        <h2 id="posts-h" className="text-lg font-semibold tracking-tight">
          Posted events by source
        </h2>
        {report.totalPosts === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            No events were posted in {period.label}.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border print:overflow-visible print:rounded-none print:border-0">
            <table className="w-full min-w-[760px] text-sm print:min-w-0 print:text-[10pt]">
              <thead className="border-b bg-muted/50 print:bg-transparent">
                <tr>
                  <th scope="col" className={th}>Posted</th>
                  <th scope="col" className={th}>Event</th>
                  <th scope="col" className={th}>Event date</th>
                  <th scope="col" className={th}>Municipality</th>
                  <th scope="col" className={th}>Writer</th>
                  <th scope="col" className={th}>Photo / Video</th>
                  <th scope="col" className={th}>Proofreader</th>
                  <th scope="col" className={cn(th, "print:hidden")}>Post</th>
                </tr>
              </thead>
              {report.groups.map((g) => (
                <tbody key={g.label} className="border-b last:border-0">
                  <tr className="bg-muted/30 print:bg-transparent">
                    <th scope="rowgroup" colSpan={8} className="px-2 py-2 text-left font-semibold">
                      <span className="inline-flex items-center gap-2">
                        {g.source && <span aria-hidden className="size-2.5 rounded-[3px] print:hidden" style={{ backgroundColor: SOURCE_COLORS[g.source] }} />}
                        {g.label}
                      </span>
                    </th>
                  </tr>
                  {g.rows.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className={cn(td, "whitespace-nowrap tabular-nums")}>{r.postedAt}</td>
                      <td className={td}>
                        <Link href={`/events/${r.id}`} className="hover:underline print:no-underline">
                          {r.title}
                        </Link>
                      </td>
                      <td className={cn(td, "whitespace-nowrap")}>{r.eventDate}</td>
                      <td className={td}>{r.municipality}</td>
                      <td className={cn(td, "whitespace-nowrap print:whitespace-normal")}>{r.writer}</td>
                      <td className={cn(td, "whitespace-nowrap print:whitespace-normal")}>{r.photoVideo}</td>
                      <td className={cn(td, "whitespace-nowrap print:whitespace-normal")}>{r.proofreader}</td>
                      <td className={cn(td, "print:hidden")}>
                        {r.link && (
                          <a href={r.link} target="_blank" rel="noopener noreferrer" className="-my-1 inline-flex min-h-7 items-center px-1 text-sm underline underline-offset-4">
                            Open
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t">
                    <td colSpan={8} className="px-2 py-1.5 text-right text-xs font-medium text-muted-foreground print:text-black">
                      {g.label} subtotal: <span className="tabular-nums text-foreground">{g.rows.length}</span>
                    </td>
                  </tr>
                </tbody>
              ))}
              {/* A tbody, not tfoot: browsers repeat tfoot on every printed page. */}
              <tbody className="border-t-2">
                <tr>
                  <td colSpan={8} className="px-2 py-2 text-right font-semibold">
                    Total posts: <span className="tabular-nums">{report.totalPosts}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* People */}
      <section aria-labelledby="people-h" className="grid gap-2 print:break-inside-avoid">
        <h2 id="people-h" className="text-lg font-semibold tracking-tight">
          Work by person
        </h2>
        <p className="text-sm text-muted-foreground print:text-black">Counted only from events posted in {period.label}.</p>
        <div className="overflow-x-auto rounded-xl border print:overflow-visible print:rounded-none print:border-0">
          <table className="w-full min-w-[560px] text-sm print:min-w-0 print:text-[10pt]">
            <thead className="border-b bg-muted/50 print:bg-transparent">
              <tr>
                <th scope="col" className={th}>Person</th>
                <th scope="col" className={cn(th, "text-right")}>Written</th>
                <th scope="col" className={cn(th, "text-right")}>Proofread</th>
                <th scope="col" className={cn(th, "text-right")}>Photographed</th>
                <th scope="col" className={cn(th, "text-right")}>Videographed</th>
                <th scope="col" className={cn(th, "text-right")}>Total</th>
              </tr>
            </thead>
            <tbody>
              {report.people.map((p) => (
                <tr key={p.id} className="border-t">
                  <th scope="row" className={cn(td, "text-left font-medium")}>
                    {p.name}
                    <span className="block text-xs font-normal text-muted-foreground print:hidden">{p.roles}</span>
                  </th>
                  {[p.written, p.proofread, p.photographed, p.videographed].map((v, i) => (
                    <td key={i} className={cn(td, "text-right tabular-nums", v === 0 && "text-muted-foreground")}>
                      {v}
                    </td>
                  ))}
                  <td className={cn(td, "text-right font-semibold tabular-nums")}>{p.total}</td>
                </tr>
              ))}
            </tbody>
            <tbody className="border-t-2 font-semibold">
              <tr>
                <th scope="row" className={cn(td, "text-left")}>Total</th>
                {[t.written, t.proofread, t.photographed, t.videographed, t.total].map((v, i) => (
                  <td key={i} className={cn(td, "text-right tabular-nums")}>
                    {v}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Print-only sign-off */}
      <div className="mt-10 hidden grid-cols-2 gap-16 text-sm print:grid">
        <div>
          <div className="h-10 border-b border-black" />
          <p className="mt-1">Prepared by</p>
        </div>
        <div>
          <div className="h-10 border-b border-black" />
          <p className="mt-1">Noted by (Head, PIO)</p>
        </div>
      </div>
    </div>
  );
}

function ReportSkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Loading the report">
      <Skeleton className="h-12 w-64" />
      <Skeleton className="h-16 w-full" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
