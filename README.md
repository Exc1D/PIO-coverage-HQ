# PIO Production

Coverage tracking for the **Provincial Information Office (PIO) of Camarines Norte**. Every event the office covers is tracked from request to the published Facebook post, with weekly and monthly reports of who did what.

It replaces chat threads and memory with one place to:

- assign people quickly and see gaps before the event, not after;
- see every event's status until it's posted, and catch stuck events early;
- report output by week and month: total posts, the split by event source, and each person's work by role.

**Live app:** [pio-production.vercel.app](https://pio-production.vercel.app) · public request form: [pio-production.vercel.app/request](https://pio-production.vercel.app/request)

All dates, weeks (Monday–Sunday) and months are computed in **Asia/Manila**. Timestamps are stored in UTC.

---

## What's in the app

| Page | Who | What it's for |
|---|---|---|
| **Dashboard** `/` | everyone | This week / This month / custom range. Posts published and events covered (vs the previous period), in the pipeline now, stuck, posts by source, work by person, pipeline now, and the Needs assignment, Stuck and Next 7 days lists. Every chart has a "Show as table" view. **Waiting on** shows who has to act next on each event still in progress, one card per person, most overdue first. |
| **Board** `/board` | everyone; changes need a PIN | One column per status. Drag a card by its handle one step forward, or one step back (head, with a reason). Illegal drops snap back with the reason. Tick Photos/Video and Caption on the card. Filters (source, municipality, person, dates, cancelled) live in the URL. |
| **Event** (drawer or `/events/<id>`) | everyone; changes need a PIN | All details, the actions you're allowed to take (with the reason when one is blocked), team assignment, the caption (see [Caption review](#caption-review)), Drive link, posting details, and the full activity timeline. |
| **Calendar** `/calendar` | everyone | Month grid of **Events** (by event date) or **Published** posts (by posting date), coloured by source. Hover a chip for details on a computer; tap a day on a phone. Click an event to open it. |
| **Assign** `/needs-assignment` | head assigns; others view | Requested or scheduled events in the next 14 days missing a writer or photo/video. Pick people inline; each option shows how many other events that person has that day. |
| **Reports** `/reports` | everyone | Monthly or weekly. Posted events grouped by source with subtotals, a per-person table (written / proofread / photographed / videographed), **CSV downloads**, and an **A4 print layout** with "Prepared by / Noted by" lines. |
| **My work** `/me` | signed-in staff | **Waiting on you**: every event that needs your next step, overdue first. Then your own events month by month (by event date): the last 6 months at a glance with events held and posted, then the chosen month's events with your role, source and status. Step back through earlier months with the arrows. |
| **Staff** `/admin` | head | Add people, set roles, reset PINs, deactivate leavers, clear sign-in locks, restore deleted events. |
| **Request coverage** `/request` | public, no sign-in | Organisers and LGUs request coverage, and choose photos/video/article, a live stream, or both. Lands on the board as *Requested*. |
| **First-run setup** `/setup` | once | Creates the first head when there are no staff yet. |

Source colours are the same everywhere: **Provincial Government** blue, **Other LGU** purple, **Community** green, **Private** orange. They were checked for colour-blind separation and always appear with a text label.

## How access works

- **Anyone with the link can view** the dashboard, board, calendars and reports.
- **To change anything**, staff pick their name and enter a personal 4–6 digit **PIN**. That sets a signed, httpOnly session cookie for 8 hours. Every change is attributed to that person in the event's activity log.
- **Account menu:** once signed in, the avatar at the right of the header holds everything account-related: your name and roles, **My work**, **Staff** (head only) and **Sign out**. Signed out, it's a single **Sign in** button.
- **Lockout:** 5 wrong PINs for one person, or 20 from one IP address, lock sign-in for 15 minutes. The head can clear a person's lock from Staff.
- **Roles** (a person can have several): head (admin), photographer, videographer, photo editor, video editor, graphics, writer, proofreader, page admin, cameraman, OBS tech.
- Resetting someone's PIN or deactivating them signs them out on every device at once. Before deactivating, Staff lists the unfinished events they are still assigned to.
- Accounts with any work on record can only be deactivated, so reports keep their names. A deactivated account with no history (e.g. added by mistake) can be deleted for good.
- Deleting an event (head only) keeps a copy for 30 days: the toast offers **Undo**, and **Staff → Recently deleted events** can restore it with its history. Posted events also need the word "delete" typed. **Cancel event** remains the way to keep something on record.
- **Requester names and contacts** are hidden from anyone not signed in.
- **Optional view key:** set `VIEW_KEY` and viewers must open the app once with `?k=<VIEW_KEY>`. A cookie then remembers the device. The public request form stays open to everyone.
- **Database security:** Row Level Security is on for every table, with **no** policies, and the anon/authenticated roles are revoked. All reads and writes go through server code using the service-role key, which never reaches the browser. Every input is validated with zod on the server.

## Stack

Next.js 16 (App Router, Server Components, Server Actions, Cache Components), Supabase Postgres (SQL migrations; Supabase Auth is not used), Tailwind CSS 4 + shadcn/ui, Recharts, @dnd-kit, zod, date-fns / date-fns-tz, Vitest and Playwright. Deploys to Vercel + Supabase on their free tiers.

---

## Local setup

**You need:** Node 22+, pnpm 10+, and Docker (for local Supabase).

```bash
pnpm install
cp .env.example .env.local
pnpm db:start              # starts local Supabase and prints the API URL and keys
```

Fill in `.env.local`:

| Variable | Value |
|---|---|
| `SUPABASE_URL` | `http://127.0.0.1:54321` locally |
| `SUPABASE_SERVICE_ROLE_KEY` | the **service_role** (or **secret**, `sb_secret_…`) key printed by `pnpm db:start` |
| `SESSION_SECRET` | 32+ random characters: `openssl rand -hex 32` |
| `VIEW_KEY` | optional; leave blank for open viewing |

Then:

```bash
pnpm db:reset              # apply supabase/migrations/ to a clean local database
pnpm seed                  # 10 placeholder staff (PIN 1234) + 28 sample events
pnpm dev                   # http://localhost:3000
```

Sign in as **Grace S.** (head + proofreader) with PIN **1234**, or as anyone else below. To try the first-run setup screen instead, run `pnpm db:reset` without seeding and open `/setup`.

> Open `http://localhost:3000`, not `127.0.0.1:3000`. In development Next.js only serves its scripts to `localhost`, so pages wouldn't become interactive.

### Seed data (development only)

`scripts/seed.ts` loads `supabase/seed/pio-coverage-pipeline.csv`:

- It shifts all dates so the newest event is 14 days from today, which keeps the demo current.
- It ignores the CSV's Platform column; Facebook is the only platform.
- It sets placeholder Drive and Facebook links.
- It **refuses** to run with `NODE_ENV=production`, or against a non-local database without `--allow-remote`.

| Staff (PIN 1234) | Roles |
|---|---|
| Grace S. | head, proofreader |
| Joel B. | proofreader, page admin |
| Rico M., Jessa T. | photographer |
| Paolo D. | videographer |
| Ana R., Mark V., Liza C. | writer |
| Ben A. | cameraman, videographer |
| Kim L. | OBS tech |

### Migrations

SQL migrations live in `supabase/migrations/`. Locally, `pnpm db:reset` rebuilds the database from them. For a hosted project, see [Deploy](#deploy-to-vercel--supabase). To add a change, create a new file (`supabase migration new <name>`) rather than editing an applied one.

## Tests

| Command | What it runs |
|---|---|
| `pnpm check` | typecheck + lint + unit tests with coverage |
| `pnpm test` / `pnpm test:coverage` | Vitest. `lib/workflow.ts` and `lib/metrics.ts` are held to **100% branch coverage**, including Manila timezone edge cases. |
| `pnpm test:e2e` | Playwright: builds and starts the app, then runs the end-to-end tests on a phone (Pixel 7) and a desktop viewport. |

The end-to-end tests need local Supabase running and the seed loaded (`pnpm db:reset && pnpm seed`). The main one follows one event through its whole life:

1. Someone submits it through the public request form.
2. The head schedules it, assigns people and confirms coverage.
3. The photographer marks it covered and ticks Photos/Video done.
4. The writer ticks Caption done, which auto-advances it to For proofreading.
5. The proofreader approves it.
6. The page admin schedules and posts it.
7. The dashboard's post count and the writer's credit go up by one.

`delete-restore.spec.ts` covers deleting an event and bringing it back (Undo and Staff → Recently deleted events), the typed confirmation for posted events, and deactivating and deleting accounts.

They are safe to rerun. Set `E2E_BASE_URL` to test a server that's already running. If you use a preinstalled Chromium instead of `npx playwright install`, set `PLAYWRIGHT_CHROMIUM_PATH`.

GitHub Actions runs them on every pull request and push to `main` (`.github/workflows/e2e.yml`): it starts local Supabase with the CLI, loads the seed and uploads the Playwright report as an artifact.

---

## Deploy to Vercel + Supabase

Both free tiers are enough for one office.

### 1. Create the Supabase project

1. At [supabase.com](https://supabase.com), create a project. Choose the **Southeast Asia (Singapore)** region, which is closest to Camarines Norte, and save the database password.
2. Apply the schema from your machine:

   ```bash
   pnpm exec supabase login
   pnpm exec supabase link --project-ref <your-project-ref>   # from the project URL
   pnpm exec supabase db push                                  # applies supabase/migrations/
   ```

3. In **Project Settings → API Keys**, copy the **Project URL** and the **service_role / secret** key. Treat that key like a password: it bypasses all database security.

Do **not** run `pnpm seed` against production; it creates staff with a shared PIN.

### 2. Create the Vercel project

1. At [vercel.com](https://vercel.com), choose **Add New → Project** and import this GitHub repository. Vercel detects Next.js and pnpm automatically.
2. Under **Environment Variables**, add these for Production (and Preview if you use it):

   | Name | Value |
   |---|---|
   | `SUPABASE_URL` | the Project URL |
   | `SUPABASE_SERVICE_ROLE_KEY` | the service_role / secret key |
   | `SESSION_SECRET` | a new `openssl rand -hex 32` (different from development) |
   | `VIEW_KEY` | optional: a long random string if viewing should need the shared link |

   Never prefix these with `NEXT_PUBLIC_`; that would send them to browsers.
3. Optional: in **Settings → Functions**, set the region to **Singapore (sin1)** so the app runs next to the database.
4. Deploy.

### 3. First run

1. Open `https://pio-production.vercel.app/setup` and create the **head's** account and PIN.
2. As the head, open **Staff** and add the team, with roles and PINs. Give each person their PIN in person.
3. Share the links:
   - **Staff and viewers:** `https://pio-production.vercel.app/`. Add `?k=<VIEW_KEY>` if you set one.
   - **Organisers and LGUs:** `https://pio-production.vercel.app/request`.

### Updating

- **Code:** pushing to the production branch redeploys on Vercel.
- **Schema:** when a commit adds a migration, run `pnpm exec supabase db push` before or right after the deploy.

### Running it on free tiers

- **Inactivity pause:** Supabase free projects pause after about a week with no activity. Daily use keeps it awake; if it pauses, restore it from the Supabase dashboard.
- **Backups:** the free tier has no point-in-time recovery. Download the monthly Posts and People CSVs from Reports for the office's records. For a full copy, run `pnpm exec supabase db dump --data-only > backup.sql` now and then.
- **Housekeeping:** sign-in attempts older than 30 days and rate-limit entries older than 2 days are pruned automatically during normal sign-ins.

---

## Workflow rules

`lib/workflow.ts` is the single source of truth. It's a pure module with full test coverage; the server enforces it on every change, and the UI uses it to show only the actions that will work.

`requested → scheduled → covered → in_production → for_proofreading → approved → scheduled_for_posting → posted`. The head can **cancel** an event from any status before posted, with a reason, and can restore it later. The head can also move an event **back one step**, with a reason.

| Step | Who | Needs |
|---|---|---|
| requested → scheduled | head | source and municipality |
| scheduled → covered | assigned photographer/videographer, live crew, or head | the head has ticked **Coverage confirmed** (for a live stream, only possible once a cameraman and an OBS tech are assigned) |
| covered → posted (**live stream only**) | assigned live crew, page admin or head | the Facebook live video link |
| covered → in_production | assigned team or head; also automatic when either checkbox is ticked | — |
| in_production → for_proofreading | **automatic** | **Photos/Video done** (photographer/videographer or head) and **Caption done** (writer or head), whichever is ticked last |
| for_proofreading → approved | proofreader or head | becomes the proofreader if none was assigned |
| for_proofreading → in_production (**request caption changes**) | proofreader or head | a note for the writer; unticks Caption done |
| approved → scheduled_for_posting | page admin or head | posting date and time |
| scheduled_for_posting → posted | page admin or head | a facebook.com or fb.watch post link; posted time defaults to now |

Only the head assigns people and edits event details. The Drive folder link and caption text are optional references; no rule requires them (but see [Caption review](#caption-review)). **Every** change is written to the append-only `event_activity` log.

**Concurrent edits:** if two people change the same event at once, the second gets "Someone else just updated this event" and sees the fresh version, so nobody overwrites anyone. On the board, changes appear immediately and roll back if the server refuses them or the connection drops.

## Live coverage

Each event has a **coverage**: *Photos, video and article* (the usual), *Live stream only*, or *Live stream + photos, video and article*. The requester picks it on the public form; the head can change it under **Edit details** until production starts.

- A live stream needs a **cameraman** and an **OBS tech** (two staff roles with their own event slots). The head can't tick *Coverage confirmed* until both are assigned, and can swap them afterwards but not leave a slot empty.
- **Live stream + article** follows the normal pipeline, with the live crew added to the team. The live crew can mark it covered alongside the photographer/videographer.
- **Live stream only** has no article, so it skips production: `requested → scheduled → covered → posted`. Once it's covered, the live crew, a page admin or the head adds the Facebook live video link (*Add the live video*), and the event is posted. There are no Photos/Video or Caption boxes, and no caption.
- Changing the coverage clears the slots the new coverage doesn't have (logged in the activity).
- Live events show a red **Live** chip on the board, the event and the Assign page. Needs assignment, Waiting on, the dashboard (*Live streams* credits and "N livestreamed" under Events covered) and Reports (a *Live crew* column, and *Live camera* / *Live OBS* credits) all include the live crew.

## Caption review

Writers post the caption in the event itself, so the proofreader reviews exactly what will go on the page instead of hunting for it in chat.

- **Writer:** *Post caption* on the event. *Save draft* keeps working on it; *Save and mark Caption done* saves and ticks Caption done in one step (the event moves to For proofreading once Photos/Video is done too).
- **Proofreader:** reads the caption on the event, with a word and character count and a **Copy** button. Two ways to respond:
  - *Correct caption*: fix small mistakes in place (allowed for any proofreader while the event is For proofreading), then approve.
  - *Request caption changes*: send it back with a note. The event returns to In production with Caption done unticked, and the writer sees the note above the caption until they mark it done again.
- **What changed:** every saved version is kept in `caption_revisions`, with its author. Signed-in staff can compare the current caption with any earlier version, word by word (additions in green, removals struck through). The proofreader sees exactly what the writer fixed, and the writer sees the proofreader's corrections.

The activity log records each caption edit and request (with the note), but not the caption text itself; the text lives in `caption_revisions`, which is removed along with its event.

## Waiting on

Every event in progress shows who it's waiting on (on the board card, at the top of the event, on the dashboard and in My work). It's worked out from the event's status, checkboxes and team in `lib/waiting.ts`, never typed in, so it is always current.

| Status | Waiting on |
|---|---|
| Requested | the head, to add source/municipality and schedule |
| Scheduled | the head, to assign a writer and photo/video (and a cameraman and OBS tech for a live stream), then confirm coverage; nobody until the event day; then the photographer/videographer and live crew, to mark it covered |
| Covered, live stream only | the OBS tech (or a page admin), to add the live video link |
| Covered / In production | whoever still owes work: the editor (or, with no editor, the photographer/videographer) for Photos/Video, the writer for the caption ("revise" after changes were requested); the head if a needed slot is empty |
| For proofreading | the assigned proofreader, or any proofreader |
| Approved / Scheduled for posting | a page admin, to schedule and then publish the post |

## Reporting definitions

These live in `lib/metrics.ts` and are covered by unit tests.

- **Post:** status is posted and `posted_at` falls inside the period, in Manila time. Cancelled events never count.
- **Events covered:** the event date is in the period and the status is covered or later. The dashboard also shows how many of them were livestreamed.
- **Stuck:** not posted or cancelled, and today (Manila) is after the due date. The due date is the event date + 2 days.
- **Needs assignment:** requested or scheduled, event date from today through 14 days ahead, and a gap in the minimum team: for photos/video/article, no writer, or no photographer *and* no videographer; for a live stream, no cameraman or no OBS tech.
- **Credit**, counted only for posted events: the writer gets "written", the proofreader "proofread", the photographer "photographed", the videographer "videographed", the editor "edited", the cameraman "live camera" and the OBS tech "live OBS". A live-only event is posted when its live video link is added.

## Project layout

```
app/                 routes (dashboard, board, calendar, needs-assignment, reports, me, admin,
                     events/[id], request, login, setup) and Server Actions in app/actions/
app/@drawer/         intercepted /events/[id] → side drawer over the current page
components/          UI by area (board, events, dashboard, calendar, assign, reports, admin, ui = shadcn)
lib/workflow.ts      transition rules (pure, 100% tested)
lib/metrics.ts       reporting definitions (pure, 100% tested)
lib/my-work.ts       one person's events by month (pure, tested)
lib/waiting.ts       who each event is waiting on (pure, 100% tested)
lib/text-diff.ts     word diff for comparing caption versions
lib/commands.ts      zod schema for event commands (server); lib/command-preview.ts for the browser
lib/data/            database reads (server only)
lib/auth/            PIN hashing, sessions, lockout
supabase/migrations/ SQL schema
scripts/seed.ts      development seed
tests/unit, tests/e2e
```

Notifications such as email or SMS are out of scope. To add one, send it from the Server Actions in `app/actions/` after a change is saved; each one has the activity rows it wrote.

## Troubleshooting

- **The page loads but nothing is clickable in development:** open `localhost:3000`, not `127.0.0.1:3000`.
- **"Invalid server environment" error:** `.env.local` is missing a value; `SESSION_SECRET` needs at least 32 characters.
- **`supabase start` can't pull images** (registry rate limits): run only the database with `supabase db start`, then follow the comments in `scripts/dev/rest-proxy.mjs` to run PostgREST behind a small `/rest/v1` proxy.
- **Someone is locked out:** wait 15 minutes, or have the head open Staff and press **Clear lock**.
- **Deleted an event by mistake:** within 30 days, open Staff → **Recently deleted events** and press **Restore**. It comes back with its history and caption versions, and its activity shows when it was brought back.
- **Lost the only head's PIN:** in the Supabase SQL editor, run `update staff set roles = array_append(roles, 'head') where display_name = '<someone>';` for another staff member, then have that person reset the PIN from Staff.

## Privacy

In keeping with the Data Privacy Act of 2012 (RA 10173), the app stores only:

- staff names and roles;
- each requester's name and one contact detail on their event, visible only to signed-in staff.

IP addresses used for rate limiting and lockout are stored only as keyed hashes. Old data is deleted automatically (`prune_expired_data`, run occasionally on sign-in):

- sign-in attempts after 30 days;
- rate-limit entries after 2 days;
- deleted events, including the requester's details, 30 days after the delete.
