import type { Metadata } from "next";
import { Suspense } from "react";
import { EventDetail, EventDetailSkeleton, EventTitle, eventTitle } from "@/components/events/event-detail";
import { EventDrawer } from "@/components/events/event-drawer";

export async function generateMetadata({ params }: PageProps<"/events/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: (await eventTitle(id)) ?? "Event" };
}

// Intercepts /events/[id] on client-side navigation (board, calendars,
// dashboard) and shows it in a drawer. Direct visits render the full page.
export default function EventDrawerPage({ params }: PageProps<"/events/[id]">) {
  return (
    <Suspense fallback={null}>
      <DrawerLoader params={params} />
    </Suspense>
  );
}

async function DrawerLoader({ params }: { params: PageProps<"/events/[id]">["params"] }) {
  const { id } = await params;
  return (
    <EventDrawer
      id={id}
      title={
        <Suspense fallback="Event">
          <EventTitle id={id} />
        </Suspense>
      }
    >
      <Suspense fallback={<EventDetailSkeleton />}>
        <div className="ios-reveal">
          <EventDetail id={id} headingLevel="h2" />
        </div>
      </Suspense>
    </EventDrawer>
  );
}
