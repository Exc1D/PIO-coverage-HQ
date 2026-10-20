import { activityReason, describeActivity } from "@/lib/activity";
import { formatManila } from "@/lib/time";
import type { ActivityRow, Staff } from "@/lib/types";

export function ActivityTimeline({ activity, staff }: { activity: ActivityRow[]; staff: Staff[] }) {
  const byId = new Map(staff.map((s) => [s.id, s.display_name]));
  const nameOf = (id: string | null | undefined) => (id ? (byId.get(id) ?? "Unknown") : "nobody");

  return (
    <section className="grid gap-3" aria-labelledby="activity-h">
      <h3 id="activity-h" className="text-sm font-semibold">
        Activity
      </h3>
      {activity.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <ol className="relative grid gap-4 border-l pl-4">
          {activity.map((a) => {
            const reason = activityReason(a);
            return (
              <li key={a.id} className="relative">
                <span aria-hidden className="absolute -left-[21px] top-1.5 size-2.5 rounded-full border-2 border-background bg-muted-foreground" />
                <p className="text-sm">{describeActivity(a, nameOf)}</p>
                {reason && <p className="mt-0.5 border-l-2 pl-2 text-sm italic text-muted-foreground">“{reason}”</p>}
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {a.actor_id ? byId.get(a.actor_id) ?? "Unknown" : "Public request"} ·{" "}
                  <time dateTime={a.created_at}>{formatManila(a.created_at, "MMM d, yyyy · h:mm a")}</time>
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
