import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { CalendarView, type CalItem } from "@/components/calendar/calendar-view";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { gridRange, isMonthString, monthGrid, monthOf, shiftMonth } from "@/lib/calendar";
import { hasLive, MUNICIPALITY_LABELS, SOURCE_COLORS, SOURCE_LABELS, SOURCES } from "@/lib/constants";
import { listEventsByDate, listPostedInPeriod } from "@/lib/data/events";
import { listStaff } from "@/lib/data/staff";
import { formatTime, staffName } from "@/lib/format";
import { addDays, formatManila, manilaDate, manilaStartOfDay } from "@/lib/time";
import type { EventRow, Staff } from "@/lib/types";
import { segmentedItem, segmentedList } from "@/components/app/segmented";

export const metadata: Metadata = { title: "Calendar" };

type View = "events" | "published";

export default function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6">
      <Suspense fallback={<CalendarSkeleton />}>
        <CalendarLoader searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function toItem(e: EventRow, view: View, staff: Staff[]): CalItem {
  const name = (id: string | null) => staffName(staff, id);
  const people = [
    name(e.photographer_id) && `P: ${name(e.photographer_id)}`,
    name(e.videographer_id) && `V: ${name(e.videographer_id)}`,
    name(e.editor_id) && `E: ${name(e.editor_id)}`,
    name(e.writer_id) && `W: ${name(e.writer_id)}`,
    name(e.cameraman_id) && `Cam: ${name(e.cameraman_id)}`,
    name(e.obs_tech_id) && `OBS: ${name(e.obs_tech_id)}`,
  ].filter(Boolean);
  const posted = view === "published" && e.posted_at;
  return {
    id: e.id,
    title: hasLive(e.coverage) ? `${e.title} (live)` : e.title,
    day: posted ? manilaDate(e.posted_at as string) : e.event_date,
    time: posted ? formatManila(e.posted_at as string, "h:mm a") : e.start_time ? formatTime(e.start_time) : null,
    source: e.source,
    status: e.status,
    place: [e.venue, e.municipality && MUNICIPALITY_LABELS[e.municipality]].filter(Boolean).join(" · "),
    people: people.join(" · "),
  };
}

async function CalendarLoader({ searchParams }: { searchParams: PageProps<"/calendar">["searchParams"] }) {
  await connection();
  const params = await searchParams;
  const today = manilaDate(new Date());
  const view: View = params.view === "published" ? "published" : "events";
  const rawMonth = typeof params.month === "string" ? params.month : "";
  const month = isMonthString(rawMonth) ? rawMonth : monthOf(today);
  const { from, to } = gridRange(month);

  const [events, staff] = await Promise.all([
    view === "events"
      ? listEventsByDate(from, to)
      : listPostedInPeriod({ start: manilaStartOfDay(from), end: manilaStartOfDay(addDays(to, 1)) }),
    listStaff(),
  ]);
  const items = events.map((e) => toItem(e, view, staff));
  const href = (v: View, m: string) => `/calendar?${new URLSearchParams({ view: v, month: m })}`;
  const inMonth = items.filter((i) => i.day.startsWith(month)).length;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[2rem] font-bold leading-tight tracking-tight sm:text-3xl">Calendar</h1>
          <p className="text-sm text-muted-foreground">
            {view === "events" ? "By event date" : "By posting date"} ·{" "}
            {inMonth} in {formatManila(manilaStartOfDay(`${month}-01`), "MMMM")}
          </p>
        </div>
        <nav aria-label="Calendar type" className={segmentedList}>
          {(
            [
              ["events", "Events"],
              ["published", "Published"],
            ] as const
          ).map(([v, label]) => (
            <Link
              key={v}
              href={href(v, month)}
              transitionTypes={["tab-switch"]}
              aria-current={view === v ? "page" : undefined}
              className={segmentedItem(view === v)}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="icon" aria-label="Previous month" className="text-primary hover:text-primary">
            <Link href={href(view, shiftMonth(month, -1))} transitionTypes={["tab-switch"]}>
              <ChevronLeftIcon />
            </Link>
          </Button>
          <h2 className="min-w-36 text-center text-lg font-semibold">
            {formatManila(manilaStartOfDay(`${month}-01`), "MMMM yyyy")}
          </h2>
          <Button asChild variant="ghost" size="icon" aria-label="Next month" className="text-primary hover:text-primary">
            <Link href={href(view, shiftMonth(month, 1))} transitionTypes={["tab-switch"]}>
              <ChevronRightIcon />
            </Link>
          </Button>
          {month !== monthOf(today) && (
            <Button asChild variant="outline" size="sm" className="ml-1">
              <Link href={href(view, monthOf(today))} transitionTypes={["tab-switch"]}>
                Today
              </Link>
            </Button>
          )}
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Source colours">
          {SOURCES.map((s) => (
            <li key={s} className="flex items-center gap-1.5">
              <span aria-hidden className="size-2.5 rounded-[3px]" style={{ backgroundColor: SOURCE_COLORS[s] }} />
              {SOURCE_LABELS[s]}
            </li>
          ))}
        </ul>
      </div>

      <CalendarView
        key={`${view}-${month}`}
        weeks={monthGrid(month)}
        items={items}
        today={today}
        month={month}
        emptyLabel={view === "events" ? "No events on this day." : "Nothing was posted on this day."}
      />
    </div>
  );
}

function CalendarSkeleton() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Loading the calendar">
      <Skeleton className="h-12 w-56" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-[520px] w-full" />
    </div>
  );
}
