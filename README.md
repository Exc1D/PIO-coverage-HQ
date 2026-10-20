# PIO Coverage HQ

Coverage tracking for the Provincial Information Office (PIO) of Camarines Norte: every event the office covers, from request to the published Facebook post, plus weekly and monthly output reports.

> **Status:** Phase 3 of 5. Schema, seed data, PIN sign-in, workflow/metrics rules, the pipeline board, the event drawer, the **HQ dashboard** and **reports with CSV export** are in. Calendars, Needs assignment, the public request form and admin come in later phases.

## Dashboard and reports

- **Dashboard (`/`)**: switch between This week, This month, or a custom date range (all in Asia/Manila; weeks run Monday–Sunday). Shows posts published and events covered (with the change vs the previous period), what's in the pipeline now, what's stuck, posts by source, work by person (written, proofread, photographed/videographed: counted only from events *posted* in the period), and the Needs assignment, Stuck and Next 7 days lists. Every chart has a "Show as table" view.
- **Reports (`/reports`)**: pick Monthly or Weekly and step back/forward. Posted events are grouped by source with subtotals, and a per-person table shows written / proofread / photographed / videographed. **Posts CSV** and **People CSV** download the same tables (UTF-8, opens in Excel). **Print** produces an A4 layout with a letterhead and "Prepared by / Noted by" lines for submitting to the head.
- Source colours are the same everywhere: Provincial Government blue, Other LGU purple, Community green, Private orange. They were checked for colour-blind separation and always appear with a text label.

## Using the board

- `/board` shows one column per status. Anyone can view; sign in to make changes.
- Drag a card **by its handle** one column forward to run that step, or one column back (head only) to step back with a reason. Columns that would accept the card turn green while dragging; an illegal drop snaps back with a message explaining why.
- Tick **Photos/Video** and **Caption** right on the card. When both are done the event moves to *For proofreading* by itself.
- Click a card title to open the event in a side drawer: all details, the allowed actions, team assignment, Drive link, caption text, and the activity timeline. "Full page" opens `/events/<id>`, which is also the link to share.
- Filters (source, municipality, person, event dates, show cancelled) live in the URL, so a filtered board can be shared. Without a date range the Posted column shows the last 14 days.
- The head adds events with **New event**; the new event opens in the drawer ready to schedule and assign.
- Changes appear immediately and roll back if the server refuses them. If two people edit the same event, the second gets "Someone else just updated this event" and sees the fresh version.

## Stack

Next.js 16 (App Router, Server Components, Server Actions, Cache Components) · Supabase Postgres (no Supabase Auth) · Tailwind CSS 4 + shadcn/ui · zod · date-fns-tz · Vitest · Playwright.

All dates and periods are computed in **Asia/Manila**. Timestamps are stored in UTC.

## How access works

- Anyone with the link can **view**.
- To **change** anything, staff pick their name and enter a personal 4–6 digit PIN. This sets an 8-hour, httpOnly, signed session cookie.
- 5 wrong PINs for one person, or 20 from one IP address, lock sign-in for 15 minutes. The head can clear a person's lock.
- The database has Row Level Security on every table with **no** policies. All access goes through server code using the service-role key, which never reaches the browser.
- Optional `VIEW_KEY`: if set, viewers must open the app once with `?k=<VIEW_KEY>`. The public request form stays open to everyone.

## Local setup

Requirements: Node 22+, pnpm 10+, Docker (for local Supabase).

```bash
pnpm install
cp .env.example .env.local
pnpm db:start            # starts local Supabase; prints the API URL and service_role key
```

Fill in `.env.local`:

| Variable | Value |
|---|---|
| `SUPABASE_URL` | `http://127.0.0.1:54321` locally |
| `SUPABASE_SERVICE_ROLE_KEY` | the `service_role` / secret key from `pnpm db:start` |
| `SESSION_SECRET` | `openssl rand -hex 32` |
| `VIEW_KEY` | optional; leave blank for open viewing |

Then:

```bash
pnpm db:reset            # apply migrations in supabase/migrations/ to a clean database
pnpm seed                # 8 placeholder staff (PIN 1234) + 28 sample events
pnpm dev                 # http://localhost:3000
```

Sign in as **Grace S.** (head + proofreader) with PIN `1234`, or as any other seeded person.

To try the first-run setup screen instead, run `pnpm db:reset` without seeding and open `/setup`.

### Seed data

`scripts/seed.ts` loads `supabase/seed/pio-coverage-pipeline.csv`. It shifts all dates so the newest event is 14 days from today, which keeps the demo looking current. It ignores the CSV's Platform column (Facebook is the only platform), sets placeholder Drive links and Facebook post links, and refuses to run with `NODE_ENV=production` or against a non-local database unless you pass `--allow-remote`.

| Staff | Roles |
|---|---|
| Grace S. | head, proofreader |
| Joel B. | proofreader, page_admin |
| Rico M., Jessa T. | photographer |
| Paolo D. | videographer |
| Ana R., Mark V., Liza C. | writer |

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server |
| `pnpm check` | Typecheck + lint + unit tests with coverage |
| `pnpm test` / `pnpm test:coverage` | Vitest (workflow and metrics are held to 100% branch coverage) |
| `pnpm db:reset` | Recreate the local database from migrations |
| `pnpm seed` | Load development seed data |

## Workflow rules

`lib/workflow.ts` is the single source of truth. The server enforces it and the UI uses it to show only allowed actions.

`requested → scheduled → covered → in_production → for_proofreading → approved → scheduled_for_posting → posted`, plus `cancelled` (head, with reason) from any status before posted. The head can restore a cancelled event, or move an event back one step with a reason.

| Step | Who | Needs |
|---|---|---|
| requested → scheduled | head | source and municipality |
| scheduled → covered | assigned photographer/videographer, or head | head has ticked **Coverage confirmed** |
| covered → in_production | assigned team or head; also automatic when a checkbox is ticked | — |
| in_production → for_proofreading | automatic | **Photos/Video done** and **Caption done** both ticked |
| for_proofreading → approved | proofreader or head | sets proofreader to the approver if empty |
| approved → scheduled_for_posting | page admin or head | posting date/time |
| scheduled_for_posting → posted | page admin or head | facebook.com / fb.watch post link; posted time defaults to now |

The Drive folder link and caption text are optional references and are not required by any rule.

Reporting definitions (posts, stuck, needs assignment, credit) live in `lib/metrics.ts`.

## Troubleshooting

**`supabase start` can't pull images** (registry rate limits): run only the database with `supabase db start`, then follow the comments in `scripts/dev/rest-proxy.mjs` to run PostgREST in Docker behind a small `/rest/v1` proxy.

## Privacy

In keeping with RA 10173 (Data Privacy Act), the app stores only staff names and roles, plus the requester's name and contact on events. IP addresses used for rate limiting are stored only as keyed hashes.
