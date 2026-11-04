import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { OverdueFlag, StatusBadge } from "@/components/app/labels";
import { LazyPersonBars, LazySourceDonut } from "@/components/dashboard/lazy-charts";
import { ChartCard, EmptyChart, EventList, PipelineBars, StatTile, WaitingBoard } from "@/components/dashboard/parts";
import { PeriodSwitcher } from "@/components/dashboard/period-switcher";
import { PersonTabs, type PersonTab } from "@/components/dashboard/person-tabs";
import { ViewOnlyNotice } from "@/components/app/view-only-notice";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentStaff } from "@/lib/auth/session";
import { SOURCE_COLORS, SOURCE_LABELS, SOURCES, STATUS_LABELS, type Role } from "@/lib/constants";
import { listEventsByDate, listEventsForDashboard } from "@/lib/data/events";
import { listStaff } from "@/lib/data/staff";
import {
  daysOverdue,
  isStuck,
  needsAssignment,
  previousPeriod,
  summarize,
  TEAM_GAP_LABELS,
  teamGaps,
  upcoming,
  type Credit,
  type Period,
} from "@/lib/metrics";
import { staffForViewer, staffName } from "@/lib/format";
import { dashboardPeriod } from "@/lib/period-params";
import { addDays, manilaDate } from "@/lib/time";
import type { Staff } from "@/lib/types";
import { cn } from "@/lib/utils";
import { isMe, waitingOn } from "@/lib/waiting";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getCurrentStaff()) ? "HQ Dashboard" : "Coverage this week" };
}

export default function DashboardPage({ searchParams }: PageProps<"/">) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6">
      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

const NOW_LINK =
  "inline-flex min-h-11 items-center rounded-sm tabular-nums underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const againstLabel = (p: Period) => (p.kind === "week" ? "last week" : p.kind === "month" ? "last month" : "previous period");

function personSeries(credits: Map<string, Credit>, staff: Staff[], pick: (c: Credit) => number, detail?: (c: Credit) => string) {
  return [...credits.entries()]
    .map(([id, c]) => ({ name: staffName(staff, id) ?? "Unknown", value: pick(c), detail: detail?.(c) }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));
}

async function Dashboard({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  await connection();
  const now = new Date();
  const today = manilaDate(now);
  const me = await getCurrentStaff();
  if (!me) return <SignedOutHome today={today} />;
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
  const live = personSeries(
    s.credits,
    staff,
    (c) => c.liveCamera + c.liveObs,
    (c) => `${c.liveCamera} on camera · ${c.liveObs} on OBS`,
  );

  const needs = events.filter((e) => needsAssignment(e, today));
  const stuck = events.filter((e) => isStuck(e, today)).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const next7 = upcoming(events, today);

  const personCard = (title: string, description: string, data: typeof written) => (
    <ChartCard
      title={title}
      description={description}
      table={{ head: ["Person", "Count"], rows: data.map((d) => [d.name, d.detail ? `${d.value} (${d.detail})` : d.value]) }}
    >
      {data.length ? <LazyPersonBars data={data} /> : <EmptyChart>Nothing posted in this period yet.</EmptyChart>}
    </ChartCard>
  );
  const personTabs: (PersonTab & { roles: Role[] })[] = [
    { value: "written", roles: ["writer"], label: "Writing", content: personCard("Articles written", "Writer credits", written) },
    { value: "proofread", roles: ["proofreader"], label: "Proofreading", content: personCard("Captions proofread", "Proofreader credits", proofread) },
    {
      value: "media",
      roles: ["photographer", "videographer"],
      label: "Photo & video",
      content: personCard("Events photographed / videographed", "Photographer and videographer credits", media),
    },
    { value: "edited", roles: ["photo_editor", "video_editor"], label: "Editing", content: personCard("Photos and video edited", "Editor credits", edited) },
    { value: "live", roles: ["cameraman", "obs_tech"], label: "Live", content: personCard("Live streams", "Cameraman and OBS tech credits", live) },
  ];
  // Opens on the viewer's own kind of work.
  const myTab = personTabs.find((t) => me.roles.some((r) => t.roles.includes(r)));

  // Assigning is the head's job, so others don't need the list.
  const showNeeds = me.roles.includes("head");
  const onMe = events
    .map((e) => ({ event: e, tasks: waitingOn(e, today).filter((w) => isMe(w.who, me)).map((w) => w.task) }))
    .filter((x) => x.tasks.length > 0)
    .sort((a, b) => Number(isStuck(b.event, today)) - Number(isStuck(a.event, today)) || a.event.due_date.localeCompare(b.event.due_date));
  const tasksFor = new Map(onMe.map((x) => [x.event.id, x.tasks]));

  return (
    // minmax(0,1fr): an auto grid track grows to fit its widest child, which pushed the page sideways on phones.
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[2rem] font-bold leading-tight tracking-tight sm:text-3xl">HQ Dashboard</h1>
          <p className="text-sm text-muted-foreground">{period.label}</p>
        </div>
        <PeriodSwitcher period={period} />
      </div>

      {/* What needs you comes first. */}
      <EventList
        title="Waiting on you"
        description="Most days late first"
        events={onMe.map((x) => x.event)}
        staff={staff}
        empty="Nothing is waiting on you right now."
        meta={(e) => (
          <>
            <span className="font-medium text-primary">{tasksFor.get(e.id)?.join(" · ")}</span>
            {isStuck(e, today) && <OverdueFlag dueDate={e.due_date} />}
          </>
        )}
        href={{ label: "My work", to: "/me" }}
        className="border-primary/30"
      />

      {/* What's next, in one line. The period's results sit lower down, above the charts. */}
      <p className="flex flex-wrap gap-x-5 text-sm">
        <Link href="/board?view=all&stuck=1" className={cn(NOW_LINK, stuck.length > 0 && "font-semibold text-red-700")}>
          {stuck.length} late
        </Link>
        {showNeeds && (
          <Link href="/needs-assignment" className={cn(NOW_LINK, needs.length > 0 && "font-semibold text-amber-800")}>
            {needs.length} {needs.length === 1 ? "needs" : "need"} assignment
          </Link>
        )}
        <Link href="/board?view=all" className={NOW_LINK}>
          {s.inPipeline} in progress
        </Link>
      </p>

      <div className={cn("grid gap-3", showNeeds ? "lg:grid-cols-3" : "md:grid-cols-2")}>
        {showNeeds && (
          <EventList
            title="Needs assignment"
            description="Next 14 days"
            events={needs}
            staff={staff}
            empty="Everyone is assigned."
            meta={(e) => (
              <span className="font-medium text-amber-800">
                {teamGaps(e).map((g) => `No ${TEAM_GAP_LABELS[g]}`).join(" · ")}
              </span>
            )}
            href={{ label: "Assign people", to: "/needs-assignment" }}
            moreHref="/needs-assignment"
          />
        )}
        <EventList
          title="Late"
          description="Past the posting target, not yet posted"
          events={stuck}
          staff={staff}
          empty="Nothing is late."
          moreHref="/board?view=all&stuck=1"
          meta={(e) => (
            <>
              <StatusBadge status={e.status} />
              <span className="font-medium text-red-700">{daysOverdue(e, today)} day{daysOverdue(e, today) === 1 ? "" : "s"} late</span>
            </>
          )}
        />
        <EventList
          title="Next 7 days"
          description="From today"
          events={next7}
          staff={staff}
          empty="No events in the next 7 days."
          meta={(e) => <StatusBadge status={e.status} />}
        />
      </div>

      {/* The whole team's queue: the head's tool. Staff have their own list at the top, so theirs starts folded. */}
      <details open={showNeeds || undefined} className="group grid gap-3" aria-labelledby="waiting-h">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <h2 id="waiting-h" className="text-lg font-semibold tracking-tight">
            Waiting on
          </h2>
          <span className="text-sm text-muted-foreground">
            <span className="group-open:hidden">Show the whole team</span>
            <span className="hidden group-open:inline">Who acts next, most days late first</span>
          </span>
        </summary>
        <div className="mt-3">
          <WaitingBoard events={events} staff={staff} today={today} />
        </div>
      </details>

      <section aria-labelledby="results-h" className="grid grid-cols-[minmax(0,1fr)] gap-3">
        <div>
          <h2 id="results-h" className="text-lg font-semibold tracking-tight">
            Results
          </h2>
          <p className="text-sm text-muted-foreground">{period.label}</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <StatTile label="Posts published" value={s.postsPublished} delta={{ value: s.postsPublished - p.postsPublished, against: againstLabel(period) }} />
          <StatTile
            label="Events covered"
            value={s.eventsCovered}
            delta={{ value: s.eventsCovered - p.eventsCovered, against: againstLabel(period) }}
            hint={s.liveStreams ? `${s.liveStreams} livestreamed` : undefined}
          />
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-2">
        <ChartCard
          title="Posts by source"
          description="Published this period"
          table={{ head: ["Source", "Posts", "Share"], rows: donut.map((d) => [d.label, d.value, pct(d.value)]) }}
        >
          {total === 0 ? (
            <EmptyChart>Nothing published in this period yet.</EmptyChart>
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

      <section aria-labelledby="work-h" className="grid grid-cols-[minmax(0,1fr)] gap-3">
        <div>
          <h2 id="work-h" className="text-lg font-semibold tracking-tight">
            Work by person
          </h2>
          <p className="text-sm text-muted-foreground">From events posted this period.</p>
        </div>
        <PersonTabs tabs={personTabs} initial={myTab?.value ?? "written"} />
      </section>
    </div>
  );
}

/** Staff who haven't signed in and organisers checking on an event: what's coming up, and the way to the board. */
async function SignedOutHome({ today }: { today: string }) {
  const [events, staff] = await Promise.all([listEventsByDate(today, addDays(today, 6)), listStaff()]);
  return (
    <div className="mx-auto grid w-full max-w-2xl grid-cols-[minmax(0,1fr)] gap-4">
      <h1 className="text-[2rem] font-bold leading-tight tracking-tight sm:text-3xl">Coverage this week</h1>
      <EventList
        title="Next 7 days"
        description="Events the office is covering, and the stage each is at"
        events={upcoming(events, today)}
        staff={staffForViewer(staff, false)}
        empty="No events in the next 7 days."
        moreHref="/calendar"
        meta={(e) => <StatusBadge status={e.status} />}
      />
      <div className="flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link href="/board">See the pipeline board</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/request">Request coverage</Link>
        </Button>
      </div>
      <ViewOnlyNotice returnTo="/" />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6" aria-busy="true" aria-label="Loading the dashboard">
      <div className="flex flex-wrap justify-between gap-3">
        <Skeleton className="h-12 w-56" />
        <Skeleton className="h-10 w-64" />
      </div>
      <Skeleton className="h-11 w-72 max-w-full" />
      <div className="grid gap-3 md:grid-cols-2">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
    </div>
  );
}
