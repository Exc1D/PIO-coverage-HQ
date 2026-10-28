import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Board } from "@/components/board/board";
import { FiltersBar } from "@/components/board/filters-bar";
import { NewEventDialog } from "@/components/events/new-event-dialog";
import { ViewOnlyNotice } from "@/components/app/view-only-notice";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentStaff } from "@/lib/auth/session";
import { PIPELINE } from "@/lib/constants";
import { listBoardEvents } from "@/lib/data/events";
import { listStaff } from "@/lib/data/staff";
import { manilaDate } from "@/lib/time";

export const metadata: Metadata = { title: "Pipeline board" };

export default function BoardPage() {
  return (
    <main className="mx-auto w-full max-w-[2000px] px-4 py-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[2rem] font-bold leading-tight tracking-tight sm:text-3xl">Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            Every event from request to posted. Drag a card by its handle to move it one step.
          </p>
        </div>
        <Suspense fallback={null}>
          <NewEventButton />
        </Suspense>
      </div>
      <Suspense fallback={<BoardSkeleton />}>
        <BoardLoader />
      </Suspense>
    </main>
  );
}

async function NewEventButton() {
  const me = await getCurrentStaff();
  if (!me?.roles.includes("head")) return null;
  return <NewEventDialog />;
}

async function BoardLoader() {
  await connection();
  const me = await getCurrentStaff();
  const today = manilaDate(new Date());
  const [events, staff] = await Promise.all([listBoardEvents(today), listStaff()]);
  return (
    <div className="grid gap-4">
      <FiltersBar staff={staff} />
      {!me && <ViewOnlyNotice returnTo="/board" />}
      <Board events={events} staff={staff} me={me} today={today} />
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Loading the board">
      <Skeleton className="h-11 w-full" />
      <div className="flex gap-3 overflow-hidden">
        {PIPELINE.slice(0, 5).map((s) => (
          <div key={s} className="grid w-72 shrink-0 gap-2 rounded-xl border bg-muted/40 p-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
