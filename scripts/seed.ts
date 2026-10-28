// Development seed: 10 placeholder staff (PIN 1234) and the 28 sample events
// from supabase/seed/pio-coverage-pipeline.csv, shifted so the newest event
// is two weeks from today (Asia/Manila).
//
//   pnpm db:reset   # fresh schema
//   pnpm seed

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";
import { parse } from "csv-parse/sync";
import { config } from "dotenv";
import type { Coverage, Municipality, Role, Source, Status } from "../lib/constants";
import { COVERAGE_SHORT, MUNICIPALITY_LABELS, SOURCE_LABELS, STATUS_LABELS } from "../lib/constants";
import { addDays, daysBetween, manilaDate, manilaDateTime } from "../lib/time";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to seed: NODE_ENV=production. Seed data has a shared PIN and is for development only.");
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
  process.exit(1);
}
const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/.test(url);
if (!isLocal && !process.argv.includes("--allow-remote")) {
  console.error(`Refusing to seed a non-local database (${url}). Pass --allow-remote for a throwaway demo project.`);
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

const DEV_PIN = "1234";

const STAFF: { display: string; full: string; roles: Role[] }[] = [
  { display: "Grace S.", full: "Grace S.", roles: ["head", "proofreader"] },
  { display: "Joel B.", full: "Joel B.", roles: ["proofreader", "page_admin"] },
  { display: "Rico M.", full: "Rico M.", roles: ["photographer"] },
  { display: "Jessa T.", full: "Jessa T.", roles: ["photographer"] },
  { display: "Paolo D.", full: "Paolo D.", roles: ["videographer"] },
  { display: "Ana R.", full: "Ana R.", roles: ["writer"] },
  { display: "Mark V.", full: "Mark V.", roles: ["writer"] },
  { display: "Liza C.", full: "Liza C.", roles: ["writer"] },
  { display: "Ben A.", full: "Ben A.", roles: ["cameraman", "videographer"] },
  { display: "Kim L.", full: "Kim L.", roles: ["obs_tech"] },
];

type CsvRow = Record<string, string>;

function invert<T extends string>(labels: Record<T, string>): Map<string, T> {
  return new Map(Object.entries(labels).map(([k, v]) => [String(v).toLowerCase(), k as T]));
}
const statusByLabel = invert<Status>(STATUS_LABELS);
const sourceByLabel = invert<Source>(SOURCE_LABELS);
const municipalityByLabel = invert<Municipality>(MUNICIPALITY_LABELS);
const coverageByLabel = invert<Coverage>(COVERAGE_SHORT);

function lookup<T>(map: Map<string, T>, label: string, what: string): T {
  const v = map.get(label.trim().toLowerCase());
  if (!v) throw new Error(`Unknown ${what}: "${label}"`);
  return v;
}

const AFTER_COVERED: Status[] = [
  "covered",
  "in_production",
  "for_proofreading",
  "approved",
  "scheduled_for_posting",
  "posted",
];
const AFTER_APPROVED: Status[] = ["approved", "scheduled_for_posting", "posted"];

async function main() {
  const { count, error: countError } = await db.from("staff").select("id", { count: "exact", head: true });
  if (countError) throw countError;
  if ((count ?? 0) > 0) {
    console.error("The database already has staff. Run `pnpm db:reset` first for a clean seed.");
    process.exit(1);
  }

  // --- staff -------------------------------------------------------------
  const pinHash = await bcrypt.hash(DEV_PIN, 12);
  const { data: staffRows, error: staffError } = await db
    .from("staff")
    .insert(STAFF.map((s) => ({ full_name: s.full, display_name: s.display, roles: s.roles, pin_hash: pinHash })))
    .select("id, display_name");
  if (staffError) throw staffError;
  const staffId = new Map(staffRows.map((s) => [s.display_name as string, s.id as string]));
  const person = (name: string): string | null => {
    const n = name.trim();
    if (!n) return null;
    const id = staffId.get(n);
    if (!id) throw new Error(`Unknown staff member in CSV: "${n}"`);
    return id;
  };
  const head = staffId.get("Grace S.")!;

  // --- events ------------------------------------------------------------
  const csv = readFileSync(resolve(process.cwd(), "supabase/seed/pio-coverage-pipeline.csv"), "utf8");
  const rows = parse(csv, { columns: true, skip_empty_lines: true, trim: true }) as CsvRow[];

  const now = new Date();
  const today = manilaDate(now);
  const newest = rows.map((r) => r["Event Date"]).sort().at(-1)!;
  const shift = daysBetween(newest, addDays(today, 14));
  const shifted = (date: string) => addDays(date, shift);

  let n = 0;
  for (const r of rows) {
    n += 1;
    const status = lookup(statusByLabel, r["Status"], "status");
    const eventDate = shifted(r["Event Date"]);
    const postingDate = r["Posting Date"] ? shifted(r["Posting Date"]) : null;
    const coveredOrLater = AFTER_COVERED.includes(status);

    // Evening post time in Manila; never in the future for published posts.
    let postAt: Date | null = postingDate ? manilaDateTime(postingDate, "18:00") : null;
    if (status === "posted" && postAt && postAt > now) postAt = new Date(now.getTime() - 60_000);

    const proofreader = person(r["Proofreader"]);
    const coverage = lookup(coverageByLabel, r["Coverage"], "coverage");
    const row = {
      // "Oct 01 - Title" → "Title" (the date prefix would be wrong after shifting)
      title: r["Task Name"].replace(/^[A-Z][a-z]{2} \d{1,2} - /, ""),
      event_date: eventDate,
      source: lookup(sourceByLabel, r["Event Source"], "source"),
      municipality: lookup(municipalityByLabel, r["Municipality"], "municipality"),
      coverage,
      notes: r["Description"] || null,
      status,
      cancelled_from_status: status === "cancelled" ? "scheduled" : null,
      photographer_id: person(r["Photographer"]),
      videographer_id: person(r["Videographer"]),
      writer_id: person(r["Writer"]),
      proofreader_id: proofreader,
      cameraman_id: person(r["Cameraman"]),
      obs_tech_id: person(r["OBS Tech"]),
      approved_by_id: AFTER_APPROVED.includes(status) ? proofreader : null,
      coverage_confirmed: coveredOrLater,
      photos_done: r["Photos Edited & Branded"] === "Yes",
      caption_done: r["Caption Drafted"] === "Yes",
      drive_folder_url: coveredOrLater ? `https://drive.google.com/drive/folders/placeholder-${n}` : null,
      // A live-only event's post is the live video, with no posting schedule.
      scheduled_post_at:
        coverage !== "live" && (status === "scheduled_for_posting" || status === "posted") ? (postAt?.toISOString() ?? null) : null,
      posted_at: status === "posted" ? postAt!.toISOString() : null,
      // The CSV only has "(paste post link)" placeholders.
      post_link: status === "posted" ? `https://www.facebook.com/example/posts/seed-${n}` : null,
      created_by_id: head,
    };

    const { error } = await db.rpc("create_event", {
      p_row: row,
      p_activity: [
        { actor_id: head, action: "created", from_status: null, to_status: status, details: { seed: true } },
      ],
    });
    if (error) throw new Error(`Row ${n} (${r["Task Name"]}): ${error.message}`);
  }

  console.log(`Seeded ${staffRows.length} staff (PIN ${DEV_PIN}) and ${rows.length} events.`);
  console.log(`Dates shifted by ${shift} day(s): newest event is ${addDays(newest, shift)} (today ${today}).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
