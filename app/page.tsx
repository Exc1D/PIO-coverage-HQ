import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { StatusBadge } from "@/components/app/labels";
import { LazyPersonBars, LazySourceDonut } from "@/components/dashboard/lazy-charts";
import { ChartCard, EmptyChart, EventList, PipelineBars, StatTile } from "@/components/dashboard/parts";
import { PeriodSwitcher } from "@/components/dashboard/period-switcher";
import { Skeleton } from "@/components/ui/skeleton";
import { SOURCE_COLORS, SOURCE_LABELS, SOURCES, STATUS_LABELS } from "@/lib/constants";
import { listEventsForDashboard } from "@/lib/data/events";
import { listStaff } from "@/lib/data/staff";
import {
  daysOverdue,
  isStuck,
  needsAssignment,
  previousPeriod,
  summarize,
  upcoming,
  type Credit,
  type Period,
} from "@/lib/metrics";
import { dashboardPeriod } from "@/lib/period-params";
import { manilaDate } from "@/lib/time";
import type { Staff } from "@/lib/types";

export const metadata: Metadata = { title: "HQ Dashboard" };

export default function DashboardPage({ searchParams }: PageProps<"/">) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6">
      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

const againstLabel = (p: Period) => (p.kind === "week" ? "last week" : p.kind === "month" ? "last month" : "previous period");

function personSeries(credits: Map<string, Credit>, staff: Staff[], pick: (c: Credit) => number, detail?: (c: Credit) => string) {
  const name = (id: string) => staff.find((s) => s.id === id)?.display_name ?? "Unknown";
  return [...credits.entries()]
    .map(([id, c]) => ({ name: name(id), value: pick(c), detail: detail?.(c) }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
}

async function Dashboard({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  await connection();
  const now = new Date();
  const today = manilaDate(now);
  const period = dashboardPeriod(await searchParams, now);
  const prev = previousPeriod(period);
  const [events, staff] = await Promise.all([listEventsForDashboard([period, prev]), listStaff()]);

  const s = summarize(events, period, today);
  const p = summarize(events, prev, today);

  const total = s.postsPublished;
  const donut = SOURCES.map((src) => ({ key: src, label: SOURCE_LABELS[src], value: s.bySource[src], fill: SOURCE_COLORS[src] }));
  const pct = (v: number) => (total ? `${Math.round((v / total) * 100)}%` : "0%");

  const written = personSeries(s.credits, staff, (c) => c.written);
  const proofread = personSeries(s.credits, staff, (c) => c.proofread);
  const media = personSeries(
    s.credits,
    staff,
    (c) => c.photographed + c.videographed,
    (c) => `${c.photographed} photographed · ${c.videographed} videographed`,
  );
  const edited = personSeries(s.credits, staff, (c) => c.edited);

  const needs = events.filter((e) => needsAssignment(e, today));
  const stuck = events.filter((e) => isStuck(e, today)).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const next7 = upcoming(events, today);

  const personCard = (title: string, description: string, data: typeof written) => (
    <ChartCard
      title={title}
      description={description}
      table={{ head: ["Person", "Count"], rows: data.map((d) => [d.name, d.detail ? `${d.value} (${d.detail})` : d.value]) }}
    >
      {data.length ? <LazyPersonBars data={data} /> : <EmptyChart>No posted events in this period yet.</EmptyChart>}
    </ChartCard>
  );

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">HQ Dashboard</h1>
          <p className="text-sm text-muted-foreground">{period.label} · Asia/Manila</p>
        </div>
        <PeriodSwitcher period={period} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Posts published" value={s.postsPublished} delta={{ value: s.postsPublished - p.postsPublished, against: againstLabel(period) }} />
        <StatTile label="Events covered" value={s.eventsCovered} delta={{ value: s.eventsCovered - p.eventsCovered, against: againstLabel(period) }} />
        <StatTile label="In the pipeline now" value={s.inPipeline} hint="Not yet posted or cancelled" />
        <StatTile label="Stuck" value={s.stuck} hint="Past the 2-day posting target" tone="alert" />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <ChartCard
          title="Posts by source"
          description="Published in this period"
          table={{ head: ["Source", "Posts", "Share"], rows: donut.map((d) => [d.label, d.value, pct(d.value)]) }}
        >
          {total === 0 ? (
            <EmptyChart>No posts published in this period yet.</EmptyChart>
          ) : (
            <div className="grid items-center gap-4 sm:grid-cols-[200px_1fr]">
              <LazySourceDonut data={donut} total={total} />
              <ul className="grid gap-2 text-sm" aria-label="Legend">
                {donut.map((d) => (
                  <li key={d.key} className="flex items-center gap-2">
                    <span aria-hidden className="size-3 shrink-0 rounded-[3px]" style={{ backgroundColor: d.fill }} />
                    <span className="flex-1">{d.label}</span>
                    <span className="font-semibold tabular-nums">{d.value}</span>
                    <span className="w-10 text-right text-xs text-muted-foreground tabular-nums">{pct(d.value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Pipeline now"
          description="Events at each step today"
          table={{ head: ["Step", "Events"], rows: Object.entries(s.pipeline).map(([k, v]) => [STATUS_LABELS[k as keyof typeof STATUS_LABELS], v]) }}
        >
          <PipelineBars counts={s.pipeline} />
        </ChartCard>
      </div>

      <section aria-labelledby="work-h" className="grid gap-3">
        <div>
          <h2 id="work-h" className="text-lg font-semibold tracking-tight">
            Work by person
          </h2>
          <p className="text-sm text-muted-foreground">Counted from events posted in this period.</p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
          {personCard("Articles written", "Writer credits", written)}
          {personCard("Captions proofread", "Proofreader credits", proofread)}
          {personCard("Events photographed / videographed", "Photographer and videographer credits", media)}
          {personCard("Photos and video edited", "Editor credits", edited)}
        </div>
      </section>

      <div className="grid gap-3 lg:grid-cols-3">
        <EventList
          title="Needs assignment"
          description="Next 14 days, missing a writer or photo/video"
          events={needs}
          empty="Everyone is assigned for the next 14 days."
          meta={(e) => (
            <span className="font-medium text-amber-800">
              {[!e.writer_id && "No writer", !e.photographer_id && !e.videographer_id && "No photo/video"].filter(Boolean).join(" · ")}
            </span>
          )}
          href={{ label: "Assign people", to: "/needs-assignment" }}
        />
        <EventList
          title="Stuck"
          description="Past the posting target and not yet posted"
          events={stuck}
          empty="Nothing is overdue."
          meta={(e) => (
            <>
              <StatusBadge status={e.status} />
              <span className="font-medium text-red-700">{daysOverdue(e, today)} day{daysOverdue(e, today) === 1 ? "" : "s"} late</span>
            </>
          )}
        />
        <EventList
          title="Next 7 days"
          description="Coming up, today onwards"
          events={next7}
          empty="No events in the next 7 days."
          meta={(e) => <StatusBadge status={e.status} />}
        />
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Loading the dashboard">
      <div className="flex justify-between">
        <Skeleton className="h-12 w-56" />
        <Skeleton className="h-10 w-64" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}
