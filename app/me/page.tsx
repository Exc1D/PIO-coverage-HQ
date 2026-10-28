import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { initials, OverdueFlag, SourceChip, StatusBadge } from "@/components/app/labels";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentStaff } from "@/lib/auth/session";
import { MUNICIPALITY_LABELS, ROLE_LABELS, SLOT_LABELS } from "@/lib/constants";
import { isMe } from "@/components/app/waiting-on";
import { listEventsForStaff, listInProgressEvents } from "@/lib/data/events";
import { isStuck } from "@/lib/metrics";
import { waitingOn } from "@/lib/waiting";
import { formatEventDate } from "@/lib/format";
import {
  eventsInMonth,
  HISTORY_MONTHS,
  monthLabel,
  monthParam,
  monthsEnding,
  monthsRange,
  monthSummaries,
  mySlots,
  shiftMonth,
  slotCounts,
} from "@/lib/my-work";
import { manilaDate } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "My work" };

export default function MyWorkPage({ searchParams }: PageProps<"/me">) {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6">
      <Suspense fallback={<MyWorkSkeleton />}>
        <MyWork searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function MyWork({ searchParams }: { searchParams: PageProps<"/me">["searchParams"] }) {
  await connection();
  const me = await getCurrentStaff();
  if (!me) {
    return (
      <div className="grid gap-4">
        <Title />
        <p className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
          <Link href="/login?next=/me" className="font-medium text-foreground underline underline-offset-4">
            Sign in
          </Link>{" "}
          to see the events you’ve worked on.
        </p>
      </div>
    );
  }

  const now = new Date();
  const today = manilaDate(now);
  const current = today.slice(0, 7);
  const month = monthParam((await searchParams).month, now);
  const months = monthsEnding(month, HISTORY_MONTHS);
  const { from, to } = monthsRange(months);
  const [events, inProgress] = await Promise.all([listEventsForStaff(me.id, from, to), listInProgressEvents()]);
  // Everything waiting on me: by assignment, or on a role I hold (head, proofreader, page admin).
  const onMe = inProgress
    .map((e) => ({ event: e, tasks: waitingOn(e, today).filter((w) => isMe(w.who, me)).map((w) => w.task) }))
    .filter((x) => x.tasks.length > 0)
    .sort((a, b) => Number(isStuck(b.event, today)) - Number(isStuck(a.event, today)) || a.event.due_date.localeCompare(b.event.due_date));
  const summaries = monthSummaries(events, months);
  const list = eventsInMonth(events, month);
  const selected = summaries[summaries.length - 1];
  const slots = slotCounts(list, me.id);
  const href = (m: string) => (m === current ? "/me" : `/me?month=${m}`);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center gap-4">
        <span aria-hidden className="inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground">
          {initials(me.display_name)}
        </span>
        <div className="min-w-0">
          <Title />
          <p className="text-sm text-muted-foreground">
            {me.full_name} · {me.roles.map((r) => ROLE_LABELS[r]).join(", ")}
          </p>
        </div>
      </div>

      <section aria-labelledby="on-me-h" className="grid gap-2">
        <h2 id="on-me-h" className="text-lg font-semibold tracking-tight">
          Waiting on you <span className="ml-1 text-base font-normal text-muted-foreground tabular-nums">{onMe.length}</span>
        </h2>
        {onMe.length === 0 ? (
          <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">Nothing is waiting on you right now.</p>
        ) : (
          <ul className="divide-y overflow-hidden rounded-xl border border-primary/30 bg-card">
            {onMe.map(({ event: e, tasks }) => (
              <li key={e.id}>
                <Link
                  href={`/events/${e.id}`}
                  className="grid gap-1 px-3 py-2.5 transition-colors duration-200 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[1fr_auto] sm:items-center sm:gap-4"
                >
                  <span className="grid min-w-0 gap-0.5">
                    <span className="font-medium">{e.title}</span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span className="font-medium text-primary">{tasks.join(" · ")}</span>
                      <span>· {formatEventDate(e)}</span>
                      {isStuck(e, today) && <OverdueFlag dueDate={e.due_date} />}
                    </span>
                  </span>
                  <StatusBadge status={e.status} className="justify-self-start sm:justify-self-end" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Past months at a glance; each one opens that month below. */}
      <section aria-labelledby="months-h" className="grid gap-3 rounded-xl border bg-card p-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id="months-h" className="text-sm font-semibold">
            Last {HISTORY_MONTHS} months
          </h2>
          <div className="flex items-center gap-1">
            <Button asChild variant="ghost" size="icon" aria-label="Earlier month">
              <Link href={href(shiftMonth(month, -1))} scroll={false}>
                <ChevronLeftIcon />
              </Link>
            </Button>
            {month === current ? (
              <Button variant="ghost" size="icon" disabled aria-label="Later month">
                <ChevronRightIcon />
              </Button>
            ) : (
              <Button asChild variant="ghost" size="icon" aria-label="Later month">
                <Link href={href(shiftMonth(month, 1))} scroll={false}>
                  <ChevronRightIcon />
                </Link>
              </Button>
            )}
          </div>
        </div>
        <ol className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {summaries.map((s) => {
            const isSelected = s.month === month;
            return (
              <li key={s.month}>
                <Link
                  href={href(s.month)}
                  scroll={false}
                  aria-current={isSelected ? "page" : undefined}
                  aria-label={`${monthLabel(s.month)}: ${s.events} event${s.events === 1 ? "" : "s"}, ${s.posted} posted`}
                  className={cn(
                    "grid gap-0.5 rounded-lg border p-2.5 transition-colors duration-200 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:opacity-60",
                    isSelected && "border-primary bg-primary/[0.06] hover:bg-primary/[0.08]",
                  )}
                >
                  <span className={cn("text-xs text-muted-foreground", isSelected && "font-medium text-primary")}>
                    {monthLabel(s.month, s.month.endsWith("-01") || s.month === months[0] ? "MMM yyyy" : "MMM")}
                  </span>
                  <span className="text-2xl font-semibold tabular-nums">{s.events}</span>
                  <span className="text-xs text-muted-foreground">{s.posted} posted</span>
                </Link>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="list-h" className="grid gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="list-h" className="text-lg font-semibold tracking-tight">
            {monthLabel(month)}
          </h2>
          <p className="text-sm text-muted-foreground">
            {selected.events} event{selected.events === 1 ? "" : "s"} · {selected.posted} posted
            {slots.length > 0 && <> · {slots.map((s) => `${SLOT_LABELS[s.slot]} ${s.count}`).join(", ")}</>}
          </p>
        </div>
        {list.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            You weren’t assigned to any events in {monthLabel(month)}.
          </p>
        ) : (
          <ul className="divide-y overflow-hidden rounded-xl border">
            {list.map((e) => (
              <li key={e.id}>
                <Link
                  href={`/events/${e.id}`}
                  className={cn(
                    "grid gap-1.5 px-3 py-3 transition-colors duration-200 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[9.5rem_1fr_auto] sm:items-center sm:gap-4",
                    e.status === "cancelled" && "text-muted-foreground",
                  )}
                >
                  <span className="text-xs tabular-nums text-muted-foreground sm:text-sm">{formatEventDate(e)}</span>
                  <span className="grid min-w-0 gap-1">
                    <span className={cn("font-medium", e.status === "cancelled" && "line-through decoration-1")}>{e.title}</span>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span>You: {mySlots(e, me.id).map((s) => SLOT_LABELS[s]).join(", ")}</span>
                      {e.municipality && <span>· {MUNICIPALITY_LABELS[e.municipality]}</span>}
                      <SourceChip source={e.source} short />
                    </span>
                  </span>
                  <StatusBadge status={e.status} className="justify-self-start sm:justify-self-end" />
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          Events are grouped by the month they were held. Reports credit work by the month it was posted.
        </p>
      </section>
    </div>
  );
}

function Title() {
  return <h1 className="text-[2rem] font-bold leading-tight tracking-tight sm:text-3xl">My work</h1>;
}

function MyWorkSkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Loading your work">
      <Skeleton className="h-14 w-72" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}
