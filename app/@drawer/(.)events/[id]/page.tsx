import { Suspense } from "react";
import { EventDetail, EventDetailSkeleton } from "@/components/events/event-detail";
import { EventDrawer } from "@/components/events/event-drawer";

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
    <EventDrawer id={id}>
      <Suspense fallback={<EventDetailSkeleton />}>
        <EventDetail id={id} headingLevel="h2" />
      </Suspense>
    </EventDrawer>
  );
}
