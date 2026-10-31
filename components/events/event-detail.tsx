import { notFound } from "next/navigation";
import { z } from "zod";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentStaff } from "@/lib/auth/session";
import { openCaptionFeedback } from "@/lib/activity";
import { getActivity, getCaptionRevisions, getEvent, redactForViewer } from "@/lib/data/events";
import { listStaff } from "@/lib/data/staff";
import { manilaDate } from "@/lib/time";
import { ActivityTimeline } from "./activity-timeline";
import { EventView } from "./event-view";

/** Loads one event and renders it; used by both the full page and the drawer. */
export async function EventDetail({ id, headingLevel }: { id: string; headingLevel: "h1" | "h2" }) {
  if (!z.uuid().safeParse(id).success) notFound();
  const signedIn = getCurrentStaff();
  // Caption history is a working tool for staff; viewers see only the current
  // caption. Only that query waits for the session; the rest start right away.
  const [me, event, activity, staff, revisions] = await Promise.all([
    signedIn,
    getEvent(id),
    getActivity(id),
    listStaff(),
    signedIn.then((me) => (me ? getCaptionRevisions(id) : [])),
  ]);
  if (!event) notFound();

  return (
    <div className="grid gap-8">
      <EventView
        event={redactForViewer(event, me !== null)}
        staff={staff}
        me={me}
        today={manilaDate(new Date())}
        requesterHidden={me === null && Boolean(event.requested_by || event.contact)}
        headingLevel={headingLevel}
        captionRevisions={revisions}
        captionFeedback={me ? openCaptionFeedback(activity) : null}
      />
      <ActivityTimeline activity={activity} staff={staff} />
    </div>
  );
}

export function EventDetailSkeleton() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Loading event">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-7 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
