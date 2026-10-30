// Role-based focus: which part of the pipeline each person works on, so the
// board and dashboard can start from what matters to them. Pure, so the
// pages and their tests can't disagree.

import { PIPELINE, SLOTS, type Role, type Status } from "./constants";
import { isMe, waitingOn, type WaitingEvent } from "./waiting";

/** The parts of the office's work. A person can be in several. */
export const LENSES = ["head", "field", "production", "review", "publishing"] as const;
export type Lens = (typeof LENSES)[number];

const ROLE_LENS: Record<Role, Lens> = {
  head: "head",
  photographer: "field",
  videographer: "field",
  cameraman: "field",
  obs_tech: "field",
  photo_editor: "production",
  video_editor: "production",
  graphics: "production",
  writer: "production",
  proofreader: "review",
  page_admin: "publishing",
};

export const LENS_LABELS: Record<Lens, string> = {
  head: "Managing",
  field: "Coverage",
  production: "Production",
  review: "Proofreading",
  publishing: "Posting",
};

/** The board columns each part of the work acts on. The head acts on all of them. */
const LENS_STATUSES: Record<Lens, readonly Status[]> = {
  head: PIPELINE,
  field: ["scheduled", "covered"],
  production: ["covered", "in_production"],
  review: ["for_proofreading"],
  publishing: ["approved", "scheduled_for_posting", "posted"],
};

/** The person's lenses, in LENSES order. */
export function lensesFor(roles: readonly Role[]): Lens[] {
  const mine = new Set(roles.map((r) => ROLE_LENS[r]));
  return LENSES.filter((l) => mine.has(l));
}

/** The columns a person's roles act on, in pipeline order. */
export function stageStatuses(roles: readonly Role[]): Status[] {
  const wanted = new Set(lensesFor(roles).flatMap((l) => LENS_STATUSES[l]));
  return PIPELINE.filter((s) => wanted.has(s));
}

/** "Production", "Coverage and posting". */
export function stageLabel(roles: readonly Role[]): string {
  const labels = lensesFor(roles).map((l) => LENS_LABELS[l]);
  return labels.length > 1 ? `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1].toLowerCase()}` : labels.join("");
}

// ---------------------------------------------------------------------------
// Board view: everything, my events, or my part of the pipeline
// ---------------------------------------------------------------------------

export const VIEWS = ["all", "mine", "stage"] as const;
export type View = (typeof VIEWS)[number];

type Me = { id: string; roles: readonly Role[] };

/** The views that make sense for this person. Signed out: everything only; the head's stage is everything. */
export function viewsFor(me: Me | null): View[] {
  if (!me) return ["all"];
  return me.roles.includes("head") ? ["all", "mine"] : ["all", "mine", "stage"];
}

/** Where someone starts: the head sees everything, everyone else their own events. */
export function defaultView(me: Me | null): View {
  return me && !me.roles.includes("head") ? "mine" : "all";
}

/** ?view=…, if this person can use it; otherwise their default. */
export function readView(raw: string | null, me: Me | null): View {
  const views = viewsFor(me);
  return views.includes(raw as View) ? (raw as View) : defaultView(me);
}

/** On the team, or the event is waiting on them (by assignment or by a role they hold). */
export function isMyEvent(e: WaitingEvent, me: Me, today: string): boolean {
  return SLOTS.some((s) => e[`${s}_id`] === me.id) || waitingOn(e, today).some((w) => isMe(w.who, me));
}

/** The board columns to show for a view. */
export function viewColumns(view: View, me: Me | null, showCancelled: boolean): Status[] {
  const base = view === "stage" && me ? stageStatuses(me.roles) : [...PIPELINE];
  return showCancelled ? [...base, "cancelled"] : base;
}
