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

/** App-wide source colors (blue, purple, green, orange). */
export const SOURCE_COLORS: Record<Source, string> = {
  provincial_government: "#2563eb",
  other_lgu: "#7c3aed",
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
  "writer",
  "proofreader",
  "page_admin",
] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  head: "Head",
  photographer: "Photographer",
  videographer: "Videographer",
  writer: "Writer",
  proofreader: "Proofreader",
  page_admin: "Page admin",
};

export const SLOTS = ["photographer", "videographer", "writer", "proofreader"] as const;
export type Slot = (typeof SLOTS)[number];

export const TIMEZONE = "Asia/Manila";

/** Days after event_date that a post is due. */
export const DUE_DAYS = 2;
/** Look-ahead window for "Needs assignment". */
export const NEEDS_ASSIGNMENT_DAYS = 14;
