"use client";

import { segmentedItem, segmentedList } from "@/components/app/segmented";
import { stageLabel, stageStatuses, type View } from "@/lib/focus";
import { STATUS_LABELS, type Role } from "@/lib/constants";
import { setParam } from "./board-filters";

/** Everything, my events, or the columns my roles work on. Kept in the URL with the filters. */
export function ViewSwitcher({
  views,
  view,
  roles,
  counts,
  defaultView,
}: {
  views: View[];
  view: View;
  roles: readonly Role[];
  counts: Record<View, number>;
  defaultView: View;
}) {
  if (views.length < 2) return null;
  const label: Record<View, string> = { all: "Everything", mine: "Mine", stage: stageLabel(roles) || "My steps" };
  const title: Record<View, string> = {
    all: "Every event on the board",
    mine: "Events you're on, or that are waiting on you",
    stage: `Only ${stageStatuses(roles).map((s) => STATUS_LABELS[s]).join(", ")}`,
  };
  return (
    <div role="radiogroup" aria-label="Show" className={segmentedList}>
      {views.map((v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={v === view}
          title={title[v]}
          // The default view needs no parameter, so a plain /board link lands on it.
          onClick={() => setParam("view", v === defaultView ? null : v)}
          className={segmentedItem(v === view)}
        >
          {label[v]} <span className="ml-0.5 text-xs tabular-nums text-muted-foreground">{counts[v]}</span>
        </button>
      ))}
    </div>
  );
}
