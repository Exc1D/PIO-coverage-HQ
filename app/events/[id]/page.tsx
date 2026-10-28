import { ChevronLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EventDetail, EventDetailSkeleton } from "@/components/events/event-detail";

export const metadata: Metadata = { title: "Event" };

export default function EventPage({ params }: PageProps<"/events/[id]">) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      {/* An iOS back button: the board slides back in from the left. */}
      <Link
        href="/board"
        transitionTypes={["nav-back"]}
        className="-ml-1.5 mb-3 inline-flex items-center rounded-sm text-[17px] text-primary transition-opacity active:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronLeftIcon className="size-6" strokeWidth={2.25} aria-hidden /> Board
      </Link>
      <Suspense fallback={<EventDetailSkeleton />}>
        <EventLoader params={params} />
      </Suspense>
    </main>
  );
}

async function EventLoader({ params }: { params: PageProps<"/events/[id]">["params"] }) {
  const { id } = await params;
  return <EventDetail id={id} headingLevel="h1" />;
}
