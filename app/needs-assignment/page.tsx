import { CheckCircle2Icon } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { ViewOnlyNotice } from "@/components/app/view-only-notice";
import { NeedsAssignmentList } from "@/components/assign/needs-assignment-list";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentStaff } from "@/lib/auth/session";
import { NEEDS_ASSIGNMENT_DAYS, SLOTS } from "@/lib/constants";
import { listEventsByDate } from "@/lib/data/events";
import { listStaff } from "@/lib/data/staff";
import { needsAssignment } from "@/lib/metrics";
import { addDays, manilaDate } from "@/lib/time";
import type { EventRow } from "@/lib/types";

export const metadata: Metadata = { title: "Needs assignment" };

export default function NeedsAssignmentPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6">
      <h1 className="text-[2rem] font-bold leading-tight tracking-tight sm:text-3xl">Needs assignment</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Requested or scheduled events in the next {NEEDS_ASSIGNMENT_DAYS} days with no writer, or no photographer or
        videographer, or, for a live stream, no cameraman or OBS tech. Pick people right here; each name shows how many
        other events they already have that day.
      </p>
      <Suspense fallback={<ListSkeleton />}>
        <Loader />
      </Suspense>
    </main>
  );
}

/** date → staff id → events that person is on that day (any role). */
function workload(events: EventRow[]): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const e of events) {
    const day = (out[e.event_date] ??= {});
    const people = new Set(SLOTS.map((s) => e[`${s}_id`]).filter(Boolean) as string[]);
    for (const id of people) day[id] = (day[id] ?? 0) + 1;
  }
  return out;
}

async function Loader() {
  await connection();
  const me = await getCurrentStaff();
  const today = manilaDate(new Date());
  const [events, staff] = await Promise.all([listEventsByDate(today, addDays(today, NEEDS_ASSIGNMENT_DAYS)), listStaff()]);
  const load = workload(events);
  const needs = events.filter((e) => needsAssignment(e, today));
  const assigned = events.filter(
    (e) => (e.status === "requested" || e.status === "scheduled") && !needsAssignment(e, today),
  );

  return (
    <div className="grid gap-6">
      {!me && <ViewOnlyNotice returnTo="/needs-assignment" />}
      {me && !me.roles.includes("head") && (
        <p className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">Only the head can assign people. You can see who’s missing below.</p>
      )}

      {needs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center">
          <CheckCircle2Icon className="size-8 text-green-700" aria-hidden />
          <p className="font-medium">Everyone is assigned for the next {NEEDS_ASSIGNMENT_DAYS} days.</p>
        </div>
      ) : (
        <section aria-labelledby="needs-h" className="grid gap-3">
          <h2 id="needs-h" className="text-sm font-semibold">
            Missing people <span className="font-normal text-muted-foreground">· {needs.length}</span>
          </h2>
          <NeedsAssignmentList events={needs} staff={staff} me={me} load={load} />
        </section>
      )}

      {assigned.length > 0 && (
        <details className="group grid gap-3">
          <summary className="cursor-pointer rounded-sm text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Already assigned <span className="font-normal text-muted-foreground">· {assigned.length}</span>
          </summary>
          <div className="mt-3">
            <NeedsAssignmentList events={assigned} staff={staff} me={me} load={load} />
          </div>
        </details>
      )}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="grid gap-3" aria-busy="true" aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-40 w-full" />
      ))}
    </div>
  );
}
