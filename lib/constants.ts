// Shared enums and display labels. Values mirror the Postgres enums in
// supabase/migrations; keep both in sync.

export const STATUSES = [
  "requested",
  "scheduled",
  "covered",
  "in_production",
  "for_proofreading",
  "approved",
  "scheduled_for_posting",
  "posted",
  "cancelled",
] as const;
export type Status = (typeof STATUSES)[number];

/** The forward pipeline, in order (excludes cancelled). */
export const PIPELINE: readonly Status[] = STATUSES.filter((s) => s !== "cancelled");

export const STATUS_LABELS: Record<Status, string> = {
  requested: "Requested",
  scheduled: "Scheduled",
  covered: "Covered",
  in_production: "In production",
  for_proofreading: "For proofreading",
  approved: "Approved",
  scheduled_for_posting: "Scheduled for posting",
  posted: "Posted",
  cancelled: "Cancelled",
};

export const SOURCES = ["provincial_government", "other_lgu", "community", "private"] as const;
export type Source = (typeof SOURCES)[number];

export const SOURCE_LABELS: Record<Source, string> = {
  provincial_government: "Provincial Government",
  other_lgu: "Other LGU",
  community: "Community",
  private: "Private",
};

/** App-wide source colors (blue, purple, green, orange). Steps chosen to pass the
 *  colour-blind separation checks (dataviz validate_palette.js); always shown with a text label. */
export const SOURCE_COLORS: Record<Source, string> = {
  provincial_government: "#1d4ed8",
  other_lgu: "#a855f7",
  community: "#16a34a",
  private: "#ea580c",
};

export const MUNICIPALITIES = [
  "basud",
  "capalonga",
  "daet",
  "jose_panganiban",
  "labo",
  "mercedes",
  "paracale",
  "san_lorenzo_ruiz",
  "san_vicente",
  "santa_elena",
  "talisay",
  "vinzons",
] as const;
export type Municipality = (typeof MUNICIPALITIES)[number];

export const MUNICIPALITY_LABELS: Record<Municipality, string> = {
  basud: "Basud",
  capalonga: "Capalonga",
  daet: "Daet",
  jose_panganiban: "Jose Panganiban",
  labo: "Labo",
  mercedes: "Mercedes",
  paracale: "Paracale",
  san_lorenzo_ruiz: "San Lorenzo Ruiz",
  san_vicente: "San Vicente",
  santa_elena: "Santa Elena",
  talisay: "Talisay",
  vinzons: "Vinzons",
};

export const ROLES = [
  "head",
  "photographer",
  "videographer",
  "photo_editor",
  "video_editor",
  "graphics",
  "writer",
  "proofreader",
  "page_admin",
  "cameraman",
  "obs_tech",
] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  head: "Head",
  photographer: "Photographer",
  videographer: "Videographer",
  photo_editor: "Photo editor",
  video_editor: "Video editor",
  graphics: "Graphics",
  writer: "Writer",
  proofreader: "Proofreader",
  page_admin: "Page admin",
  cameraman: "Cameraman",
  obs_tech: "OBS tech",
};

/** What the office provides for an event: the usual photos, video and article, a live stream, or both. */
export const COVERAGES = ["regular", "live", "live_and_regular"] as const;
export type Coverage = (typeof COVERAGES)[number];

export const COVERAGE_LABELS: Record<Coverage, string> = {
  regular: "Photos, video and article",
  live: "Live stream only",
  live_and_regular: "Live stream + photos, video and article",
};

export const COVERAGE_SHORT: Record<Coverage, string> = {
  regular: "Regular",
  live: "Live",
  live_and_regular: "Live + regular",
};

export const hasLive = (c: Coverage) => c !== "regular";
export const hasRegular = (c: Coverage) => c !== "live";

/** A live-only event has no article to produce: once covered, the live video is the post. */
const LIVE_PIPELINE: readonly Status[] = ["requested", "scheduled", "covered", "posted"];

/** The forward steps an event with this coverage goes through, in order. */
export const pipelineFor = (coverage: Coverage): readonly Status[] => (coverage === "live" ? LIVE_PIPELINE : PIPELINE);

export const SLOTS = ["photographer", "videographer", "editor", "writer", "proofreader", "cameraman", "obs_tech"] as const;
export type Slot = (typeof SLOTS)[number];

export const SLOT_LABELS: Record<Slot, string> = {
  photographer: "Photographer",
  videographer: "Videographer",
  editor: "Editor",
  writer: "Writer",
  proofreader: "Proofreader",
  cameraman: "Cameraman",
  obs_tech: "OBS tech",
};

/** The live stream crew; both are required before coverage is confirmed. */
export const LIVE_SLOTS = ["cameraman", "obs_tech"] as const satisfies readonly Slot[];
const REGULAR_SLOTS = SLOTS.filter((s) => !(LIVE_SLOTS as readonly Slot[]).includes(s));

/** The slots that apply to an event with this coverage, in display order. */
export function slotsFor(coverage: Coverage): readonly Slot[] {
  return [...(hasRegular(coverage) ? REGULAR_SLOTS : []), ...(hasLive(coverage) ? LIVE_SLOTS : [])];
}

/** Roles that can fill each event slot. */
export const SLOT_ROLES: Record<Slot, readonly Role[]> = {
  photographer: ["photographer"],
  videographer: ["videographer"],
  editor: ["photo_editor", "video_editor"],
  writer: ["writer"],
  proofreader: ["proofreader"],
  cameraman: ["cameraman"],
  obs_tech: ["obs_tech"],
};

export const canFillSlot = (roles: readonly Role[], slot: Slot) => SLOT_ROLES[slot].some((r) => roles.includes(r));

export const TIMEZONE = "Asia/Manila";

/** Days after event_date that a post is due. */
export const DUE_DAYS = 2;
/** Look-ahead window for "Needs assignment". */
export const NEEDS_ASSIGNMENT_DAYS = 14;
