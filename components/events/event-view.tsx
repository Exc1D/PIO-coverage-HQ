"use client";

import {
  ExternalLinkIcon,
  FolderOpenIcon,
  LockIcon,
  MessageSquareWarningIcon,
  PencilIcon,
  Trash2Icon,
  Undo2Icon,
  XCircleIcon,
} from "lucide-react";
import { useOptimistic, useState } from "react";
import { LiveChip, OverdueFlag, SourceChip, StatusBadge } from "@/components/app/labels";
import { WaitingOn } from "@/components/app/waiting-on";
import { formatEventDate, staffName } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CommandPayload } from "@/lib/commands";
import {
  COVERAGE_LABELS,
  hasRegular,
  MUNICIPALITY_LABELS,
  SLOT_LABELS,
  canFillSlot,
  slotsFor,
  SOURCE_LABELS,
  type Slot,
} from "@/lib/constants";
import { isStuck } from "@/lib/metrics";
import { formatManila, manilaStartOfDay } from "@/lib/time";
import type { ActivityRow, CaptionRevision, EventRow, Staff } from "@/lib/types";
import { cn } from "@/lib/utils";
import { waitingOn } from "@/lib/waiting";
import { availability, type CommandType } from "@/lib/workflow";
import { CaptionPanel } from "./caption-panel";
import { CommandDialog, INPUT_COMMANDS, type InputCommand } from "./command-dialog";
import { DeleteEventDialog } from "./delete-event-dialog";
import { EditDetailsDialog } from "./edit-details-dialog";
import { useCommandRunner } from "./use-command-runner";

type Props = {
  event: EventRow;
  staff: Staff[];
  me: Staff | null;
  today: string;
  requesterHidden: boolean;
  headingLevel: "h1" | "h2";
  /** Caption versions, newest first (empty when signed out). */
  captionRevisions: CaptionRevision[];
  /** The proofreader's open "request changes" note, if any. */
  captionFeedback: ActivityRow | null;
};

/** Forward actions, in pipeline order, with the button label to show. */
const FORWARD: { type: CommandType; label: string }[] = [
  { type: "schedule", label: "Schedule event" },
  { type: "mark_covered", label: "Mark as covered" },
  { type: "start_production", label: "Start production" },
  { type: "approve", label: "Approve caption" },
  { type: "schedule_post", label: "Schedule post" },
  { type: "mark_posted", label: "Mark as posted" },
  { type: "restore", label: "Restore event" },
];

const isInput = (t: CommandType): t is InputCommand => (INPUT_COMMANDS as readonly CommandType[]).includes(t);

const fmtDateTime = (iso: string) => formatManila(iso, "EEE, MMM d, yyyy · h:mm a");

export function EventView({
  event: initial,
  staff,
  me,
  today,
  requesterHidden,
  headingLevel,
  captionRevisions,
  captionFeedback,
}: Props) {
  const { run: runCommand, pending, actor } = useCommandRunner(staff, me);
  const [event, setOptimistic] = useOptimistic(initial, (s: EventRow, next: Partial<EventRow>) => ({ ...s, ...next }));
  const [dialog, setDialog] = useState<InputCommand | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const avail = availability(event, actor);
  const run = (payload: CommandPayload) => runCommand(event, payload, setOptimistic);
  const name = (id: string | null) => staffName(staff, id);
  const nameOrSomeone = (id: string | null | undefined) => name(id ?? null) ?? "someone";
  const stuck = isStuck(event, today);
  const Heading = headingLevel;

  const trigger = (type: CommandType) => (isInput(type) ? setDialog(type) : run({ type } as CommandPayload));

  const forward = FORWARD.filter((a) => avail[a.type].state !== "hidden");
  // A live-only event has no article: no photos/caption to produce, and its post is the live video.
  const regular = hasRegular(event.coverage);
  const actionLabel = (a: (typeof FORWARD)[number]) => (a.type === "mark_posted" && !regular ? "Add the live video" : a.label);

  return (
    <div className="grid gap-6">
      {/* Header */}
      <div className="grid gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span data-testid="event-status" data-status={event.status}>
            <StatusBadge status={event.status} />
          </span>
          <SourceChip source={event.source} />
          <LiveChip coverage={event.coverage} />
          {stuck && <OverdueFlag dueDate={event.due_date} />}
        </div>
        <Heading className="text-xl font-semibold leading-tight tracking-tight">{event.title}</Heading>
        <p className="text-sm text-muted-foreground">
          {formatEventDate(event)}
          {event.municipality && <> · {MUNICIPALITY_LABELS[event.municipality]}</>}
          {event.venue && <> · {event.venue}</>}
        </p>
        <WaitingOn
          items={waitingOn(event, today, { changesRequested: captionFeedback !== null })}
          staffById={new Map(staff.map((s) => [s.id, s]))}
          me={me}
          className="mt-1"
        />
      </div>

      {/* Actions */}
      {actor ? (
        <section aria-label="Actions" className="grid gap-3">
          {forward.length > 0 && (
            <div className="grid gap-2">
              {forward.map((a) => {
                const st = avail[a.type];
                return (
                  <div key={a.type} className="grid gap-1">
                    <Button
                      size="lg"
                      className="h-11 justify-center"
                      disabled={st.state === "blocked" || pending}
                      onClick={() => trigger(a.type)}
                    >
                      {actionLabel(a)}
                    </Button>
                    {st.state === "blocked" && (
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <LockIcon className="size-3" aria-hidden /> {st.reason}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {avail.request_caption_changes.state === "available" && (
            <Button variant="outline" className="h-11" disabled={pending} onClick={() => setDialog("request_caption_changes")}>
              <MessageSquareWarningIcon aria-hidden /> Request caption changes
            </Button>
          )}
          {event.status === "in_production" && (
            <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
              Moves to <strong>For proofreading</strong> automatically once both boxes below are ticked.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {avail.reschedule_post.state === "available" && (
              <Button variant="outline" size="sm" onClick={() => setDialog("reschedule_post")}>
                Change posting time
              </Button>
            )}
            {avail.edit_details.state === "available" && (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                <PencilIcon aria-hidden /> Edit details
              </Button>
            )}
            {avail.step_back.state === "available" && (
              <Button variant="outline" size="sm" onClick={() => setDialog("step_back")}>
                <Undo2Icon aria-hidden /> Move back a step
              </Button>
            )}
            {avail.cancel.state === "available" && (
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDialog("cancel")}>
                <XCircleIcon aria-hidden /> Cancel event
              </Button>
            )}
            {actor.roles.includes("head") && (
              <Button variant="ghost" size="sm" className="text-destructive" disabled={pending} onClick={() => setDeleting(true)}>
                <Trash2Icon aria-hidden /> Delete event
              </Button>
            )}
          </div>
        </section>
      ) : null}

      {/* Progress */}
      {event.status !== "cancelled" && (
        <section className="grid gap-2" aria-labelledby="progress-h">
          <h3 id="progress-h" className="text-sm font-semibold">
            Progress
          </h3>
          <div className="grid gap-1 rounded-lg border p-3">
            <Tick
              id="coverage"
              label="Coverage confirmed"
              hint={avail.set_coverage_confirmed.reason ?? "Head confirms the team covered it"}
              checked={event.coverage_confirmed}
              enabled={avail.set_coverage_confirmed.state === "available" && !pending}
              onChange={(v) => run({ type: "set_coverage_confirmed", value: v })}
            />
            {regular && (
              <>
                <Tick
                  id="photos"
                  label="Photos/Video done"
                  hint="Edited and branded · photographer, videographer or editor"
                  checked={event.photos_done}
                  enabled={avail.set_photos_done.state === "available" && !pending}
                  onChange={(v) => run({ type: "set_photos_done", value: v })}
                />
                <Tick
                  id="caption"
                  label="Caption done"
                  hint="Drafted · writer"
                  checked={event.caption_done}
                  enabled={avail.set_caption_done.state === "available" && !pending}
                  onChange={(v) => run({ type: "set_caption_done", value: v })}
                />
              </>
            )}
          </div>
        </section>
      )}

      {/* Team */}
      <section className="grid gap-2" aria-labelledby="team-h">
        <h3 id="team-h" className="text-sm font-semibold">
          Team
        </h3>
        <dl className="grid gap-2 rounded-lg border p-3">
          {slotsFor(event.coverage).map((slot) => (
            <TeamRow
              key={slot}
              slot={slot}
              currentId={event[`${slot}_id`]}
              currentName={name(event[`${slot}_id`])}
              staff={staff}
              canAssign={avail.assign.state === "available" && !pending}
              onAssign={(staffId) => run({ type: "assign", slot, staffId })}
            />
          ))}
          {event.approved_by_id && (
            <div className="flex items-center justify-between gap-2 text-sm">
              <dt className="text-muted-foreground">Approved by</dt>
              <dd>{name(event.approved_by_id)}</dd>
            </div>
          )}
        </dl>
      </section>

      {/* Caption */}
      {regular && (
        <section className="grid gap-3" aria-labelledby="caption-h">
          <h3 id="caption-h" className="text-sm font-semibold">
            Caption
          </h3>
          <CaptionPanel
            event={event}
            avail={avail}
            revisions={captionRevisions}
            // Hide the note once the writer has marked the caption done again.
            feedback={event.caption_done ? null : captionFeedback}
            nameOf={nameOrSomeone}
            pending={pending}
            onRun={run}
          />
        </section>
      )}

      {/* Photos */}
      <section className="grid gap-3" aria-labelledby="work-h">
        <h3 id="work-h" className="text-sm font-semibold">
          {regular ? "Photos and video" : "Recording"}
        </h3>
        <DriveLink
          url={event.drive_folder_url}
          canEdit={avail.edit_drive_link.state === "available"}
          onSave={(value) => run({ type: "edit_drive_link", value })}
        />
      </section>

      {/* Posting */}
      {(event.scheduled_post_at || event.posted_at || event.post_link) && (
        <section className="grid gap-2" aria-labelledby="post-h">
          <h3 id="post-h" className="text-sm font-semibold">
            {regular ? "Facebook post" : "Live video"}
          </h3>
          <dl className="grid gap-2 rounded-lg border p-3 text-sm">
            {event.scheduled_post_at && <Row label="Scheduled for" value={fmtDateTime(event.scheduled_post_at)} />}
            {event.posted_at && <Row label="Posted" value={fmtDateTime(event.posted_at)} />}
          </dl>
          {event.post_link && (
            <Button asChild variant="outline" className="h-11 justify-start">
              <a href={event.post_link} target="_blank" rel="noopener noreferrer">
                <ExternalLinkIcon aria-hidden /> {regular ? "Open the Facebook post" : "Open the live video"}
              </a>
            </Button>
          )}
        </section>
      )}

      {/* Details */}
      <section className="grid gap-2" aria-labelledby="details-h">
        <h3 id="details-h" className="text-sm font-semibold">
          Details
        </h3>
        <dl className="grid gap-2 rounded-lg border p-3 text-sm">
          <Row label="Event date" value={formatEventDate(event)} />
          <Row label="Posting target" value={formatManila(manilaStartOfDay(event.due_date), "EEE, MMM d")} />
          <Row label="Venue" value={event.venue ?? "—"} />
          <Row label="Municipality" value={event.municipality ? MUNICIPALITY_LABELS[event.municipality] : "—"} />
          <Row label="Source" value={event.source ? SOURCE_LABELS[event.source] : "—"} />
          <Row label="Coverage" value={COVERAGE_LABELS[event.coverage]} />
          {requesterHidden ? (
            <Row label="Requested by" value="Sign in to see requester details" muted />
          ) : (
            <>
              <Row label="Requested by" value={event.requested_by ?? "—"} />
              <Row label="Contact" value={event.contact ?? "—"} />
            </>
          )}
          {event.notes && <Row label="Notes" value={event.notes} block />}
        </dl>
      </section>

      <CommandDialog event={event} type={dialog} onClose={() => setDialog(null)} onSubmit={run} />
      {editing && <EditDetailsDialog event={event} onClose={() => setEditing(false)} onSubmit={run} />}
      {/* The drawer renders the heading as h2, the full page as h1. */}
      <DeleteEventDialog
        event={event}
        open={deleting}
        inDrawer={headingLevel === "h2"}
        onClose={() => setDeleting(false)}
        onCancelInstead={avail.cancel.state === "available" ? () => setDialog("cancel") : undefined}
      />
    </div>
  );
}

function Row({ label, value, muted, block }: { label: string; value: string; muted?: boolean; block?: boolean }) {
  return (
    <div className={cn("flex justify-between gap-3", block && "flex-col gap-1")}>
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className={cn("text-right", block && "whitespace-pre-wrap text-left", muted && "text-muted-foreground italic")}>{value}</dd>
    </div>
  );
}

function Tick({
  id,
  label,
  hint,
  checked,
  enabled,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  enabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      htmlFor={`tick-${id}`}
      className={cn("flex min-h-11 items-center gap-3 rounded-md px-1", enabled ? "cursor-pointer hover:bg-accent" : "opacity-80")}
    >
      <input
        type="checkbox"
        id={`tick-${id}`}
        checked={checked}
        disabled={!enabled}
        onChange={(e) => onChange(e.target.checked)}
        className="size-5 shrink-0 accent-primary disabled:opacity-60"
      />
      <span className="grid">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </span>
    </label>
  );
}

/** Slots highlighted when empty: the writer, photo/video and the live crew. */
const NEEDED_SLOTS: readonly Slot[] = ["writer", "photographer", "cameraman", "obs_tech"];

function TeamRow({
  slot,
  currentId,
  currentName,
  staff,
  canAssign,
  onAssign,
}: {
  slot: Slot;
  currentId: string | null;
  currentName: string | null;
  staff: Staff[];
  canAssign: boolean;
  onAssign: (staffId: string | null) => void;
}) {
  const id = `assign-${slot}`;
  const eligible = staff.filter((s) => (s.active && canFillSlot(s.roles, slot)) || s.id === currentId);
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <dt>
        <label htmlFor={canAssign ? id : undefined} className="text-muted-foreground">
          {SLOT_LABELS[slot]}
        </label>
      </dt>
      <dd className="min-w-0">
        {canAssign ? (
          <select
            id={id}
            value={currentId ?? ""}
            onChange={(e) => onAssign(e.target.value || null)}
            className="h-10 max-w-[12rem] rounded-md border border-input bg-background px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <option value="">Unassigned</option>
            {eligible.map((s) => (
              <option key={s.id} value={s.id}>
                {s.display_name}
                {s.active ? "" : " (inactive)"}
              </option>
            ))}
          </select>
        ) : currentName ? (
          <span className="font-medium">{currentName}</span>
        ) : (
          <span className={cn(NEEDED_SLOTS.includes(slot) ? "text-amber-700" : "text-muted-foreground")}>
            Unassigned
          </span>
        )}
      </dd>
    </div>
  );
}

function DriveLink({ url, canEdit, onSave }: { url: string | null; canEdit: boolean; onSave: (v: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <form
        className="grid gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(String(new FormData(e.currentTarget).get("drive") ?? ""));
          setEditing(false);
        }}
      >
        <Label htmlFor="drive">Google Drive folder link (optional)</Label>
        <Input id="drive" name="drive" type="url" inputMode="url" defaultValue={url ?? ""} placeholder="https://drive.google.com/…" className="h-11" />
        <div className="flex gap-2">
          <Button type="submit" size="sm">Save link</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
      </form>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {url ? (
        <Button asChild variant="outline" className="h-11">
          <a href={url} target="_blank" rel="noopener noreferrer">
            <FolderOpenIcon aria-hidden /> Open Drive folder
          </a>
        </Button>
      ) : (
        <span className="text-sm text-muted-foreground">No Drive folder linked.</span>
      )}
      {canEdit && (
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
          {url ? "Change link" : "Add Drive link"}
        </Button>
      )}
    </div>
  );
}
