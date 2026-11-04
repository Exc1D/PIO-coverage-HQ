import { notFound } from "next/navigation";
import { cache } from "react";
import { z } from "zod";
import { Skeleton } from "@/components/ui/skeleton";
import { getCurrentStaff } from "@/lib/auth/session";
import { openCaptionFeedback } from "@/lib/activity";
import { getActivity, getCaptionRevisions, getEvent } from "@/lib/data/events";
import { listStaff } from "@/lib/data/staff";
import { redactForViewer, staffForViewer } from "@/lib/format";
import { manilaDate } from "@/lib/time";
import { ActivityTimeline } from "./activity-timeline";
import { EventView } from "./event-view";

// The page title and the body ask for the same event in one request. Only here: actions need fresh reads of getEvent.
const loadEvent = cache(getEvent);

/** The event's title for screen readers and the browser tab, or null if there is no such event. */
export async function eventTitle(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  return (await loadEvent(id))?.title ?? null;
}

export async function EventTitle({ id }: { id: string }) {
  return (await eventTitle(id)) ?? "Event";
}

/** Loads one event and renders it; used by both the full page and the drawer. */
export async function EventDetail({ id, headingLevel }: { id: string; headingLevel: "h1" | "h2" }) {
  if (!z.uuid().safeParse(id).success) notFound();
  const signedIn = getCurrentStaff();
  // Caption history and the activity log are working tools for staff, and their free
  // text can name people. Only those queries wait for the session; the rest start right away.
  const [me, event, activity, staff, revisions] = await Promise.all([
    signedIn,
    loadEvent(id),
    signedIn.then((me) => (me ? getActivity(id) : [])),
    listStaff(),
    signedIn.then((me) => (me ? getCaptionRevisions(id) : [])),
  ]);
  if (!event) notFound();

  return (
    <div className="grid gap-8">
      <EventView
        event={redactForViewer(event, me !== null)}
        staff={staffForViewer(staff, me !== null)}
        me={me}
        today={manilaDate(new Date())}
        requesterHidden={me === null && Boolean(event.requested_by || event.contact)}
        headingLevel={headingLevel}
        captionRevisions={revisions}
        captionFeedback={me ? openCaptionFeedback(activity) : null}
      />
      {me && <ActivityTimeline activity={activity} staff={staff} />}
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
