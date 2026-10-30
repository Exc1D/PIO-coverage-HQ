import { activityReason, describeActivity } from "@/lib/activity";
import { staffName } from "@/lib/format";
import { formatManila } from "@/lib/time";
import type { ActivityRow, Staff } from "@/lib/types";
import { cn } from "@/lib/utils";

/** The latest few; older entries fold away, since most visits only need what just happened. */
const SHOWN = 5;

export function ActivityTimeline({ activity, staff }: { activity: ActivityRow[]; staff: Staff[] }) {
  const nameOf = (id: string | null | undefined) => staffName(staff, id) ?? "nobody";

  return (
    <section className="grid gap-3" aria-labelledby="activity-h">
      <h3 id="activity-h" className="text-sm font-semibold">
        Activity
      </h3>
      {activity.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <>
          <Entries items={activity.slice(0, SHOWN)} staff={staff} nameOf={nameOf} />
          {activity.length > SHOWN && (
            <details className="group">
              <summary className="cursor-pointer list-none rounded-sm text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
                <span className="group-open:hidden">Show {activity.length - SHOWN} earlier</span>
                <span className="hidden group-open:inline">Hide earlier</span>
              </summary>
              <Entries items={activity.slice(SHOWN)} staff={staff} nameOf={nameOf} className="mt-3" />
            </details>
          )}
        </>
      )}
    </section>
  );
}

function Entries({
  items,
  staff,
  nameOf,
  className,
}: {
  items: ActivityRow[];
  staff: Staff[];
  nameOf: (id: string | null | undefined) => string;
  className?: string;
}) {
  return (
    <ol className={cn("relative grid gap-4 border-l pl-4", className)}>
      {items.map((a) => {
        const reason = activityReason(a);
        return (
          <li key={a.id} className="relative">
            <span aria-hidden className="absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-background bg-muted-foreground" />
            <p className="text-sm">{describeActivity(a, nameOf)}</p>
            {reason && <p className="mt-0.5 border-l-2 pl-2 text-sm italic text-muted-foreground">“{reason}”</p>}
            <p className="mt-0.5 text-xs text-muted-foreground">
              {staffName(staff, a.actor_id) ?? "Public request"} ·{" "}
              <time dateTime={a.created_at}>{formatManila(a.created_at, "MMM d, yyyy · h:mm a")}</time>
            </p>
          </li>
        );
      })}
    </ol>
  );
}
