// Demo data for showing every feature on a live deployment, written as SQL
// to run in the Supabase SQL editor. Unlike scripts/seed.ts it uses the
// project's existing staff (no new accounts, no shared PIN): each event is
// played through lib/workflow.ts with real commands, so statuses, team,
// activity timelines and caption versions all look like real use.
//
// Every demo event's title starts with "[DEMO]"; scripts/demo/remove-demo.sql
// deletes them all, with their activity, caption versions and deleted copies.
//
//   1. In the SQL editor, export the staff list:
//        select json_agg(json_build_object('id', id, 'display_name', display_name,
//          'roles', roles, 'active', active) order by created_at) from staff;
//      and save the JSON array to a file.
//   2. pnpm exec tsx scripts/demo/demo-sql.ts staff.json > demo.sql
//   3. Run demo.sql in the SQL editor.
//
// Dates are relative to the moment you generate the file, so run it right away.

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Municipality, Role, Slot, Source, Status } from "../../lib/constants";
import { addDays, manilaDate, manilaDateTime } from "../../lib/time";
import type { Staff } from "../../lib/types";
import { applyCommand, type ActivityEntry, type Command, type EditableDetails, type WorkflowEvent } from "../../lib/workflow";

export const DEMO_PREFIX = "[DEMO] ";
const DEMO_NOTE = "Demo data for showing the app's features. Safe to delete.";

const NOW = new Date();
const TODAY = manilaDate(NOW);
/** Latest time a simulated step may happen: a few minutes ago. */
const LATEST = new Date(NOW.getTime() - 5 * 60_000);

// ---------------------------------------------------------------------------
// Staff pools
// ---------------------------------------------------------------------------

const staffPath = process.argv[2];
if (!staffPath) {
  console.error("Usage: tsx scripts/demo/demo-sql.ts <staff.json>");
  process.exit(1);
}
const staff = (JSON.parse(readFileSync(staffPath, "utf8")) as Staff[]).filter((s) => s.active);
const withRole = (...roles: Role[]) => staff.filter((s) => roles.some((r) => s.roles.includes(r)));
const POOLS = {
  head: withRole("head"),
  photographer: withRole("photographer"),
  videographer: withRole("videographer"),
  editor: withRole("photo_editor", "video_editor"),
  writer: withRole("writer"),
  proofreader: withRole("proofreader"),
  page_admin: withRole("page_admin"),
};
for (const [name, pool] of Object.entries(POOLS)) {
  if (pool.length === 0) {
    console.error(`No active staff can act as ${name}; add one before generating demo data.`);
    process.exit(1);
  }
}

/** Pick from a pool by rotation, skipping people already on the event when possible. */
function pick(pool: Staff[], n: number, taken: Staff[]): Staff {
  for (let i = 0; i < pool.length; i++) {
    const s = pool[(n + i) % pool.length];
    if (!taken.includes(s)) return s;
  }
  return pool[n % pool.length];
}

// ---------------------------------------------------------------------------
// One event's story
// ---------------------------------------------------------------------------

type ActivityOut = ActivityEntry & { actor_id: string | null; created_at: Date };
type CaptionOut = { author_id: string | null; body: string | null; created_at: Date };

type Spec = {
  title: string;
  /** Event date, in days from today (Manila). */
  day: number;
  time?: string;
  venue: string;
  municipality: Municipality;
  source: Source;
  /** First paragraph of the caption. */
  blurb: string;
  /** Submitted through the public form instead of created by the head. */
  publicRequest?: { by: string; contact: string; notes: string };
  /** Slots the head leaves empty. */
  leaveEmpty?: Slot[];
  story: (s: Story) => void;
};

class Story {
  readonly id = randomUUID();
  ev: WorkflowEvent;
  version = 1;
  createdBy: string | null;
  createdAt!: Date;
  last = new Date(0);
  activity: ActivityOut[] = [];
  captions: CaptionOut[] = [];
  deleted = false;
  readonly team: Record<"head" | Slot | "page_admin", Staff | null>;

  constructor(
    readonly spec: Spec,
    readonly n: number,
  ) {
    const head = POOLS.head[n % POOLS.head.length];
    const taken: Staff[] = [];
    const take = (pool: Staff[], stride: number) => {
      const s = pick(pool, n * stride, taken);
      taken.push(s);
      return s;
    };
    const photographer = take(POOLS.photographer, 3);
    const videographer = take(POOLS.videographer, 5);
    const editor = take(POOLS.editor, 2);
    const writer = take(POOLS.writer, 1);
    const proofreader = take(POOLS.proofreader, 1);
    const empty = new Set(spec.leaveEmpty ?? []);
    this.team = {
      head,
      photographer: empty.has("photographer") ? null : photographer,
      videographer: empty.has("videographer") ? null : videographer,
      editor: empty.has("editor") ? null : editor,
      writer: empty.has("writer") ? null : writer,
      proofreader: empty.has("proofreader") ? null : proofreader,
      page_admin: POOLS.page_admin[n % POOLS.page_admin.length],
    };
    this.createdBy = spec.publicRequest ? null : head.id;
    this.ev = {
      title: DEMO_PREFIX + spec.title,
      event_date: addDays(TODAY, spec.day),
      start_time: spec.time ?? "09:00",
      venue: spec.venue,
      municipality: spec.municipality,
      source: spec.source,
      requested_by: spec.publicRequest?.by ?? null,
      contact: spec.publicRequest?.contact ?? null,
      notes: spec.publicRequest ? `${spec.publicRequest.notes}\n\n${DEMO_NOTE}` : DEMO_NOTE,
      status: "requested",
      cancelled_from_status: null,
      photographer_id: null,
      videographer_id: null,
      editor_id: null,
      writer_id: null,
      proofreader_id: null,
      approved_by_id: null,
      coverage_confirmed: false,
      photos_done: false,
      caption_done: false,
      drive_folder_url: null,
      caption_text: null,
      scheduled_post_at: null,
      posted_at: null,
      post_link: null,
    };
  }

  // --- clock -------------------------------------------------------------

  /** Manila wall-clock time `days` after the event date, never in the future and never before the last step. */
  at(days: number, time: string): Date {
    let t = manilaDateTime(addDays(this.ev.event_date, days), time);
    // Steps planned for later today happen in quick succession up to now instead.
    if (t > LATEST && manilaDate(t) === TODAY) t = new Date(this.last.getTime() + 3 * 60_000);
    if (t <= this.last) t = new Date(this.last.getTime() + 2 * 60_000);
    if (t > NOW) throw new Error(`${this.spec.title}: a step lands in the future; move it earlier.`);
    this.last = t;
    return t;
  }

  run(actor: Staff, cmd: Command, when: Date) {
    const res = applyCommand(this.ev, cmd, actor, when);
    if (!res.ok) throw new Error(`${this.spec.title}: ${cmd.type} by ${actor.display_name} failed: ${res.message}`);
    if ("caption_text" in res.patch && res.patch.caption_text !== this.ev.caption_text) {
      this.captions.push({ author_id: actor.id, body: res.patch.caption_text ?? null, created_at: when });
    }
    for (const a of res.activity) this.activity.push({ ...a, actor_id: actor.id, created_at: when });
    this.ev = res.next;
    this.version += 1;
  }

  private get head() {
    return this.team.head!;
  }
  private get media() {
    return (this.team.photographer ?? this.team.videographer ?? this.head)!;
  }
  private get writer() {
    return this.team.writer ?? this.head;
  }

  // --- steps -------------------------------------------------------------

  create(daysBefore = 6) {
    this.createdAt = this.at(-daysBefore, "09:10");
    this.activity.push({
      action: "created",
      from_status: null,
      to_status: "requested",
      details: this.spec.publicRequest ? { public_request: true } : {},
      actor_id: this.createdBy,
      created_at: this.createdAt,
    });
    return this;
  }

  assign(slots: Slot[] = ["photographer", "videographer", "editor", "writer", "proofreader"], daysBefore = 5) {
    const when = this.at(-daysBefore, "10:00");
    for (const slot of slots) {
      const who = this.team[slot];
      if (who) this.run(this.head, { type: "assign", slot, assignee: who }, when);
    }
    return this;
  }

  confirm(daysBefore = 5) {
    this.run(this.head, { type: "set_coverage_confirmed", value: true }, this.at(-daysBefore, "10:30"));
    return this;
  }

  schedule(daysBefore = 5) {
    this.run(this.head, { type: "schedule" }, this.at(-daysBefore, "10:35"));
    return this;
  }

  /** Requested → scheduled with the full team and coverage confirmed. */
  plan(daysBefore = 5) {
    return this.create(daysBefore + 1).assign(undefined, daysBefore).confirm(daysBefore).schedule(daysBefore);
  }

  cover() {
    const [h, m] = (this.ev.start_time ?? "09:00").split(":").map(Number);
    const end = `${String(Math.min(h + 3, 23)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    this.run(this.media, { type: "mark_covered" }, this.at(0, end));
    return this;
  }

  driveLink() {
    const who = this.team.editor ?? this.media;
    this.run(
      who,
      { type: "edit_drive_link", value: `https://drive.google.com/drive/folders/demo-${this.n}` },
      this.at(1, "09:30"),
    );
    return this;
  }

  photos(day = 1, time = "10:30") {
    const who = this.team.editor ?? this.media;
    this.run(who, { type: "set_photos_done", value: true }, this.at(day, time));
    return this;
  }

  captionText(extra = "") {
    const { photographer, videographer } = this.team;
    const credits = [
      photographer && `📷 ${photographer.display_name}`,
      videographer && `🎥 ${videographer.display_name}`,
      `✍️ ${this.writer.display_name}`,
    ]
      .filter(Boolean)
      .join(" | ");
    return [this.spec.blurb + extra, credits, "#CamarinesNorte #PIOCamNorte"].join("\n\n");
  }

  caption(day = 1, time = "14:00", text = this.captionText()) {
    this.run(this.writer, { type: "submit_caption", value: text }, this.at(day, time));
    return this;
  }

  /** Writer saves a draft without marking it done. */
  draft(day = 1, time = "11:00") {
    this.run(this.writer, { type: "edit_caption_text", value: this.captionText() }, this.at(day, time));
    return this;
  }

  requestChanges(reason: string, day = 1, time = "16:00") {
    const who = this.team.proofreader ?? POOLS.proofreader[0];
    this.run(who, { type: "request_caption_changes", reason }, this.at(day, time));
    return this;
  }

  /** Proofreader fixes a small mistake in place. */
  correct(from: string, to: string, day = 1, time = "16:10") {
    const who = this.team.proofreader ?? POOLS.proofreader[0];
    this.run(who, { type: "edit_caption_text", value: this.ev.caption_text!.replace(from, to) }, this.at(day, time));
    return this;
  }

  approve(day = 1, time = "16:30") {
    const who = this.team.proofreader ?? POOLS.proofreader[0];
    this.run(who, { type: "approve" }, this.at(day, time));
    return this;
  }

  schedulePost(postDay = 1, postTime = "18:00", day = 1, time = "17:00") {
    const when = this.at(day, time);
    const scheduledPostAt = manilaDateTime(addDays(this.ev.event_date, postDay), postTime);
    this.run(this.team.page_admin!, { type: "schedule_post", scheduledPostAt }, when);
    return this;
  }

  post() {
    // Published at the scheduled time, or just after the last step if that's still ahead.
    const target = new Date(this.ev.scheduled_post_at!);
    const when = target > this.last && target <= LATEST ? target : new Date(this.last.getTime() + 3 * 60_000);
    if (when > NOW) throw new Error(`${this.spec.title}: posted in the future; move it earlier.`);
    this.last = when;
    this.run(
      this.team.page_admin!,
      { type: "mark_posted", postLink: `https://www.facebook.com/PIOCamNorte/posts/demo${this.n}`, postedAt: when },
      when,
    );
    return this;
  }

  /** Requested → posted the usual way: covered on the day, produced and posted the day after. */
  posted(daysBefore = 5) {
    return this.plan(daysBefore).cover().driveLink().photos().caption().approve().schedulePost().post();
  }

  stepBack(reason: string, day: number, time: string, reset?: "caption" | "photos" | "both") {
    this.run(this.head, { type: "step_back", reason, reset }, this.at(day, time));
    return this;
  }

  cancel(reason: string, day: number, time = "15:00") {
    this.run(this.head, { type: "cancel", reason }, this.at(day, time));
    return this;
  }

  restore(reason: string, day: number, time = "09:00") {
    this.run(this.head, { type: "restore", reason }, this.at(day, time));
    return this;
  }

  editDetails(changes: Partial<EditableDetails>, day: number, time = "11:00") {
    this.run(this.head, { type: "edit_details", changes }, this.at(day, time));
    return this;
  }

  /** The head deletes the event; it lands in Staff → Recently deleted events. */
  remove() {
    this.deleted = true;
    return this;
  }
}

// ---------------------------------------------------------------------------
// The events
// ---------------------------------------------------------------------------

const SPECS: Spec[] = [
  // --- Posted: last month and this month, for the dashboard and reports ---
  {
    title: "Provincial Development Council first-semester meeting",
    day: -57,
    venue: "Capitol Session Hall",
    municipality: "daet",
    source: "provincial_government",
    blurb:
      "The Provincial Development Council met at the Capitol Session Hall to review the province's priority infrastructure and social programs for the coming year.",
    story: (s) => s.posted(),
  },
  {
    title: "Free medical and dental mission",
    day: -50,
    time: "08:00",
    venue: "Basud Covered Court",
    municipality: "basud",
    source: "community",
    blurb:
      "More than 400 residents of Basud received free check-ups, tooth extractions and medicines during a medical and dental mission organised by local volunteers.",
    story: (s) => s.posted(),
  },
  {
    title: "Turnover of farm machinery to rice farmers' associations",
    day: -43,
    venue: "Labo Municipal Grounds",
    municipality: "labo",
    source: "provincial_government",
    blurb:
      "Twelve rice farmers' associations in Labo received hand tractors, threshers and a combine harvester from the Provincial Government to cut harvest losses.",
    story: (s) => s.posted(),
  },
  {
    title: "Paracale town fiesta civic parade",
    day: -36,
    time: "07:00",
    venue: "Paracale Poblacion",
    municipality: "paracale",
    source: "other_lgu",
    blurb:
      "Schools, barangays and civic groups filled the streets of Paracale for the civic parade opening the town fiesta.",
    story: (s) => s.posted(),
  },
  {
    title: "World Tourism Day bike tour",
    day: -31,
    time: "06:00",
    venue: "Vinzons Heritage Town",
    municipality: "vinzons",
    source: "private",
    blurb:
      "Cyclists from across Bicol rode through the heritage streets of Vinzons in a World Tourism Day bike tour organised by a local riders' club.",
    leaveEmpty: ["videographer"],
    story: (s) => s.posted(),
  },
  {
    title: "Coastal clean-up for International Coastal Clean-up Day",
    day: -26,
    time: "06:30",
    venue: "Mercedes Fish Port",
    municipality: "mercedes",
    source: "community",
    blurb: "Volunteers collected garbage along the Mercedes shoreline on International Coastal Clean-up Day.",
    // A caption sent back for changes, revised, then approved.
    story: (s) =>
      s
        .plan()
        .cover()
        .driveLink()
        .photos()
        .caption()
        .requestChanges("Please add how much garbage was collected and thank the partner organisations.")
        .caption(
          2,
          "09:30",
          s.captionText(
            " Close to 1.2 tonnes of waste were collected. Thank you to the barangay councils, the Philippine Coast Guard and the students of Mercedes National High School.",
          ),
        )
        .approve(2, "11:00")
        .schedulePost(2, "18:00", 2, "11:30")
        .post(),
  },
  {
    title: "Provincial scholarship grant payout",
    day: -21,
    venue: "Provincial Capitol Lobby",
    municipality: "daet",
    source: "provincial_government",
    blurb:
      "More than 1,500 college scholars received their first-semester grants from the Provincial Government at the Capitol.",
    story: (s) => s.posted(),
  },
  {
    title: "Jose Panganiban municipal job fair",
    day: -16,
    venue: "Jose Panganiban Gymnasium",
    municipality: "jose_panganiban",
    source: "other_lgu",
    blurb: "Twenty-three local and overseas employers took part in the municipal job fair in Jose Panganiban.",
    story: (s) => s.posted(),
  },
  {
    title: "Bantay Dagat patrol boat turnover",
    day: -13,
    venue: "Talisay Municipal Port",
    municipality: "talisay",
    source: "provincial_government",
    blurb: "Two new patrol boats were turned over to Talisay's Bantay Dagat volunteers to guard against illegal fishing.",
    story: (s) => s.posted(),
  },
  {
    title: "Blood-letting drive",
    day: -9,
    time: "08:00",
    venue: "Daet Elevated Plaza",
    municipality: "daet",
    source: "private",
    blurb: "Donors gave 186 bags of blood during a blood-letting drive co-organised by a local bank and the provincial blood bank.",
    story: (s) => s.posted(),
  },
  {
    title: "Anti-rabies vaccination drive",
    day: -5,
    time: "08:00",
    venue: "San Vicente Municipal Plaza",
    municipality: "san_vicente",
    source: "other_lgu",
    blurb: "Pet owners in San Vicente brought more than 600 dogs and cats for free anti-rabies shots.",
    // Scheduled for the wrong time, moved back a step, then rescheduled and posted.
    story: (s) =>
      s
        .plan()
        .cover()
        .driveLink()
        .photos()
        .caption()
        .approve()
        .schedulePost(1, "07:00")
        .stepBack("The municipal office asked us to post after their own announcement in the evening.", 1, "17:20")
        .schedulePost(1, "19:00", 1, "17:25")
        .post(),
  },
  {
    title: "Kapihan sa PIO media forum",
    day: -3,
    time: "10:00",
    venue: "PIO Conference Room",
    municipality: "daet",
    source: "provincial_government",
    blurb:
      "Provincial department heads answered questions from local media on the Governer's flood-control projects during this month's Kapihan sa PIO.",
    // The proofreader fixes a typo in place before approving.
    story: (s) =>
      s.plan().cover().driveLink().photos().caption().correct("Governer's", "Governor's").approve().schedulePost().post(),
  },
  {
    title: "Capitol Monday flag-raising ceremony",
    day: -2,
    time: "07:30",
    venue: "Provincial Capitol Grounds",
    municipality: "daet",
    source: "provincial_government",
    blurb:
      "Provincial employees gathered for the Monday flag-raising ceremony, where the Governor recognised this year's outstanding barangay health workers.",
    story: (s) => s.posted(),
  },
  {
    title: "Provincial Nutrition Month awarding",
    day: -1,
    time: "13:00",
    venue: "Capitol Session Hall",
    municipality: "daet",
    source: "provincial_government",
    blurb: "Barangays with the lowest malnutrition rates were honoured at the Provincial Nutrition Month awarding.",
    story: (s) => s.posted(),
  },

  // --- Still in the pipeline -------------------------------------------------
  {
    title: "Barangay health workers' training",
    day: -2,
    venue: "Santa Elena Municipal Hall",
    municipality: "santa_elena",
    source: "other_lgu",
    blurb: "Sixty barangay health workers in Santa Elena completed a two-day training on maternal and child care.",
    story: (s) =>
      s.plan().cover().driveLink().photos().caption().approve(1, "16:30").schedulePost(3, "09:00", 2, "09:00"),
  },
  {
    title: "Reading program launch with DepEd",
    day: -1,
    venue: "Talisay Central School",
    municipality: "talisay",
    source: "provincial_government",
    blurb: "The Provincial Government and DepEd launched a reading program for Grade 1 to 3 pupils in Talisay.",
    story: (s) => s.plan().cover().driveLink().photos().caption().approve().schedulePost(2, "17:00"),
  },
  {
    title: "Farmers' field school graduation",
    day: -3,
    venue: "Capalonga Municipal Gymnasium",
    municipality: "capalonga",
    source: "other_lgu",
    blurb: "Forty-two farmers graduated from a season-long field school on organic rice farming in Capalonga.",
    story: (s) => s.plan().cover().driveLink().photos().caption().approve(2, "10:00"),
  },
  {
    title: "Livelihood starter kits for persons with disability",
    day: -2,
    venue: "Basud Municipal Hall",
    municipality: "basud",
    source: "provincial_government",
    blurb: "Fifty persons with disability in Basud received livelihood starter kits for sari-sari stores and food carts.",
    story: (s) => s.plan().cover().photos().caption().approve(2, "15:00"),
  },
  {
    title: "Blessing of the new dialysis unit",
    day: -1,
    time: "08:00",
    venue: "Camarines Norte Provincial Hospital",
    municipality: "daet",
    source: "provincial_government",
    blurb: "The Camarines Norte Provincial Hospital opened a new ten-bed dialysis unit.",
    story: (s) => s.plan().cover().driveLink().photos().caption(1, "15:00"),
  },
  {
    title: "Business one-stop shop briefing",
    day: -6,
    venue: "Daet Municipal Hall",
    municipality: "daet",
    source: "private",
    blurb: "Business owners were briefed on the new one-stop shop for permits and renewals.",
    // Stuck in For proofreading: due four days ago.
    story: (s) => s.plan().cover().photos().caption(),
  },
  {
    title: "Typhoon preparedness drill",
    day: -2,
    time: "08:00",
    venue: "Provincial Disaster Risk Reduction Office",
    municipality: "daet",
    source: "provincial_government",
    blurb: "Responders from 12 towns joined a province-wide typhoon preparedness drill.",
    // Photos done, writer has only a draft.
    story: (s) => s.plan().cover().driveLink().photos().draft(1, "11:00"),
  },
  {
    title: "Kalusugan caravan",
    day: -4,
    time: "08:00",
    venue: "San Lorenzo Ruiz Covered Court",
    municipality: "san_lorenzo_ruiz",
    source: "community",
    blurb: "The Kalusugan caravan brought free consultations and laboratory tests to San Lorenzo Ruiz.",
    // Changes requested and still waiting on the writer.
    story: (s) =>
      s
        .plan()
        .cover()
        .driveLink()
        .photos()
        .caption()
        .requestChanges("The number of patients is missing, and please name the partner hospital.", 2, "10:00"),
  },
  {
    title: "Social pension payout for senior citizens",
    day: -3,
    venue: "Jose Panganiban Municipal Hall",
    municipality: "jose_panganiban",
    source: "other_lgu",
    blurb: "Senior citizens in Jose Panganiban received their quarterly social pension.",
    // Caption done, photos still being edited.
    story: (s) => s.plan().cover().driveLink().caption(1, "13:00"),
  },
  {
    title: "Mangrove planting",
    day: -4,
    time: "06:30",
    venue: "Calintaan, Vinzons",
    municipality: "vinzons",
    source: "community",
    blurb: "Volunteers planted 2,000 mangrove seedlings along the Vinzons coast.",
    // Covered, nothing started yet: stuck.
    story: (s) => s.plan().cover(),
  },
  {
    title: "Bicol agri-trade fair opening",
    day: 0,
    time: "08:00",
    venue: "Daet Agri-Trade Center",
    municipality: "daet",
    source: "private",
    blurb: "The Bicol agri-trade fair opened with more than 80 exhibitors.",
    story: (s) => s.plan().cover(),
  },

  // --- Coming up ----------------------------------------------------------------
  {
    title: "Provincial Peace and Order Council meeting",
    day: 0,
    time: "15:00",
    venue: "Capitol Session Hall",
    municipality: "daet",
    source: "provincial_government",
    blurb: "",
    story: (s) => s.plan(),
  },
  {
    title: "Barangay officials' orientation",
    day: 1,
    venue: "Labo Municipal Hall",
    municipality: "labo",
    source: "other_lgu",
    blurb: "",
    // Cancelled by mistake, then restored.
    story: (s) =>
      s
        .plan(6)
        .cancel("The organiser said it was postponed.", -3, "14:00")
        .restore("Postponement was for a different event; this one is on as planned.", -2, "09:00"),
  },
  {
    title: "Youth leadership summit",
    day: 2,
    venue: "Daet Elevated Plaza",
    municipality: "daet",
    source: "community",
    blurb: "",
    leaveEmpty: ["writer"],
    story: (s) => s.create(4).assign(undefined, 3).schedule(3),
  },
  {
    title: "Provincial sports meet opening",
    day: 4,
    time: "07:00",
    venue: "Camarines Norte Sports Complex",
    municipality: "daet",
    source: "provincial_government",
    blurb: "",
    leaveEmpty: ["photographer", "videographer", "editor"],
    story: (s) => s.create(5).assign(undefined, 4).schedule(4),
  },
  {
    title: "Coastal resource management workshop",
    day: 8,
    venue: "Mercedes Municipal Hall",
    municipality: "mercedes",
    source: "provincial_government",
    blurb: "",
    story: (s) =>
      s
        .create(10)
        .assign(undefined, 9)
        .schedule(9)
        .editDetails({ venue: "Mercedes Fisherfolk Center", start_time: "13:00" }, -9),
  },
  {
    title: "Cooperative Month culminating program",
    day: 12,
    venue: "Capitol Session Hall",
    municipality: "daet",
    source: "provincial_government",
    blurb: "",
    story: (s) => s.create(14).assign(["photographer", "writer"], 13).schedule(13),
  },
  {
    title: "Senior high school career fair",
    day: 3,
    venue: "Santa Elena National High School",
    municipality: "santa_elena",
    source: "community",
    blurb: "",
    publicRequest: {
      by: "Lorna Dizon, Santa Elena NHS",
      contact: "0917 555 0142",
      notes: "Around 600 Grade 12 students. We would appreciate photos for the school page too.",
    },
    story: (s) => s.create(4),
  },
  {
    title: "Basud municipal fiesta opening",
    day: 6,
    time: "08:00",
    venue: "Basud Town Plaza",
    municipality: "basud",
    source: "other_lgu",
    blurb: "",
    publicRequest: {
      by: "Dan Roque, Basud MPDO",
      contact: "mpdo.basud@example.com",
      notes: "Opening program followed by the street dance competition.",
    },
    story: (s) => s.create(7),
  },
  {
    title: "Visit of the DILG regional director",
    day: 10,
    time: "10:00",
    venue: "Governor's Office",
    municipality: "daet",
    source: "provincial_government",
    blurb: "",
    story: (s) => s.create(12),
  },
  {
    title: "Beach resort grand opening",
    day: 18,
    time: "16:00",
    venue: "Paracale",
    municipality: "paracale",
    source: "private",
    blurb: "",
    publicRequest: {
      by: "Marivic Santos",
      contact: "0998 555 0177",
      notes: "Ribbon cutting with the mayor.",
    },
    story: (s) => s.create(19),
  },

  // --- Cancelled and deleted ----------------------------------------------------
  {
    title: "Open-water swim challenge",
    day: 5,
    time: "06:00",
    venue: "Bagasbas Beach",
    municipality: "daet",
    source: "private",
    blurb: "",
    story: (s) => s.plan(6).cancel("Organiser postponed it because of the weather advisory.", -6, "16:00"),
  },
  {
    title: "Town hall with fisherfolk",
    day: -8,
    venue: "Talisay Fisherfolk Center",
    municipality: "talisay",
    source: "other_lgu",
    blurb: "",
    story: (s) => s.create(5).cancel("Merged into the Bantay Dagat patrol boat turnover coverage.", -4, "11:00"),
  },
  {
    title: "Career fair (duplicate request)",
    day: 3,
    venue: "Santa Elena National High School",
    municipality: "santa_elena",
    source: "community",
    blurb: "",
    publicRequest: { by: "Lorna Dizon, Santa Elena NHS", contact: "0917 555 0142", notes: "Sent twice by mistake." },
    story: (s) => s.create(4).remove(),
  },
];

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

const lit = (v: unknown): string => {
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean" || typeof v === "number") return String(v);
  if (v instanceof Date) return `'${v.toISOString()}'`;
  if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
};

const EVENT_COLUMNS = [
  "title", "event_date", "start_time", "venue", "municipality", "source", "requested_by", "contact", "notes",
  "status", "cancelled_from_status", "photographer_id", "videographer_id", "editor_id", "writer_id",
  "proofreader_id", "approved_by_id", "coverage_confirmed", "photos_done", "caption_done", "drive_folder_url",
  "caption_text", "scheduled_post_at", "posted_at", "post_link",
] as const satisfies readonly (keyof WorkflowEvent)[];

const stories = SPECS.map((spec, i) => {
  const s = new Story(spec, i + 1);
  spec.story(s);
  return s;
});

const out: string[] = [
  `-- Demo data generated ${NOW.toISOString()} (Manila date ${TODAY}). Remove with scripts/demo/remove-demo.sql.`,
  "begin;",
];
for (const s of stories) {
  const cols = ["id", ...EVENT_COLUMNS, "version", "created_by_id", "created_at", "updated_at"];
  const vals = [s.id, ...EVENT_COLUMNS.map((c) => s.ev[c]), s.version, s.createdBy, s.createdAt, s.last];
  out.push(`insert into events (${cols.join(", ")}) values (${vals.map(lit).join(", ")});`);
  out.push(
    "insert into event_activity (event_id, actor_id, action, from_status, to_status, details, created_at) values\n" +
      s.activity
        .map((a) => `  (${[s.id, a.actor_id, a.action, a.from_status, a.to_status, a.details, a.created_at].map(lit).join(", ")})`)
        .join(",\n") +
      ";",
  );
  if (s.captions.length > 0) {
    out.push(
      "insert into caption_revisions (event_id, author_id, body, created_at) values\n" +
        s.captions.map((c) => `  (${[s.id, c.author_id, c.body, c.created_at].map(lit).join(", ")})`).join(",\n") +
        ";",
    );
  }
  if (s.deleted) out.push(`select delete_event(${lit(s.id)}, ${s.version}, ${lit(s.team.head!.id)});`);
}
out.push("commit;");
console.log(out.join("\n\n"));

const count = (st: Status) => stories.filter((s) => !s.deleted && s.ev.status === st).length;
console.error(
  `${stories.length} events: ` +
    (["requested", "scheduled", "covered", "in_production", "for_proofreading", "approved", "scheduled_for_posting", "posted", "cancelled"] as Status[])
      .map((st) => `${st} ${count(st)}`)
      .join(", ") +
    `, deleted ${stories.filter((s) => s.deleted).length}`,
);
