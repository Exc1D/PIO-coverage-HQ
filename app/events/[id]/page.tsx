import { ArrowLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { EventDetail, EventDetailSkeleton } from "@/components/events/event-detail";

export const metadata: Metadata = { title: "Event" };

export default function EventPage({ params }: PageProps<"/events/[id]">) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-6">
      <Link
        href="/board"
        className="mb-4 inline-flex items-center gap-1.5 rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeftIcon className="size-4" aria-hidden /> Board
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
