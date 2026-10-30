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
  LIVE_SLOTS,
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

  const team = slotsFor(event.coverage);
  const regularSlots = team.filter((s) => !(LIVE_SLOTS as readonly Slot[]).includes(s));
  const liveSlots = team.filter((s) => (LIVE_SLOTS as readonly Slot[]).includes(s));
  const canAssign = avail.assign.state === "available" && !pending;
  const teamRow = (slot: Slot) => (
    <TeamRow
      key={slot}
      slot={slot}
      currentId={event[`${slot}_id`]}
      currentName={name(event[`${slot}_id`])}
      mine={me !== null && event[`${slot}_id`] === me.id}
      staff={staff}
      canAssign={canAssign}
      onAssign={(staffId) => run({ type: "assign", slot, staffId })}
    />
  );
  const hasPost = Boolean(event.scheduled_post_at || event.posted_at || event.post_link);
  const moreActions = actor && [avail.step_back, avail.cancel].some((a) => a.state === "available");

  // Laid out in the order people look for things: what's next, then the
  // checklist, team, caption, links, details, and rarely used actions last.
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
      </div>

      {/* Next step: who it's waiting on, and the button to move it on */}
      <section aria-label="Next step" className="grid gap-3">
        <WaitingOn
          items={waitingOn(event, today, { changesRequested: captionFeedback !== null })}
          staffById={new Map(staff.map((s) => [s.id, s]))}
          me={me}
        />
        {actor && forward.length > 0 && (
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
        {actor && avail.request_caption_changes.state === "available" && (
          <Button variant="outline" className="h-11" disabled={pending} onClick={() => setDialog("request_caption_changes")}>
            <MessageSquareWarningIcon aria-hidden /> Request caption changes
          </Button>
        )}
      </section>

      {/* Checklist */}
      {event.status !== "cancelled" && (
        <Section title="Checklist" id="progress-h">
          <div className="grid gap-1 rounded-lg border p-2">
            <Tick
              id="coverage"
              label="Coverage confirmed"
              hint={avail.set_coverage_confirmed.reason ?? "Head"}
              checked={event.coverage_confirmed}
              enabled={avail.set_coverage_confirmed.state === "available" && !pending}
              onChange={(v) => run({ type: "set_coverage_confirmed", value: v })}
            />
            {regular && (
              <>
                <Tick
                  id="photos"
                  label="Photos/Video done"
                  hint="Photographer, videographer or editor"
                  checked={event.photos_done}
                  enabled={avail.set_photos_done.state === "available" && !pending}
                  onChange={(v) => run({ type: "set_photos_done", value: v })}
                />
                <Tick
                  id="caption"
                  label="Caption done"
                  hint="Writer"
                  checked={event.caption_done}
                  enabled={avail.set_caption_done.state === "available" && !pending}
                  onChange={(v) => run({ type: "set_caption_done", value: v })}
                />
              </>
            )}
          </div>
          {event.status === "in_production" && (
            <p className="text-xs text-muted-foreground">
              Goes to <strong>For proofreading</strong> once both are ticked.
            </p>
          )}
        </Section>
      )}

      {/* Team */}
      <Section title="Team" id="team-h">
        {regularSlots.length > 0 && <dl className="grid gap-3 sm:grid-cols-2">{regularSlots.map(teamRow)}</dl>}
        {liveSlots.length > 0 && (
          <div className={cn("grid gap-2", regularSlots.length > 0 && "mt-2 border-t pt-3")}>
            {regularSlots.length > 0 && <h4 className="text-xs font-medium text-muted-foreground">Live stream</h4>}
            <dl className="grid gap-3 sm:grid-cols-2">{liveSlots.map(teamRow)}</dl>
          </div>
        )}
        {event.approved_by_id && (
          <p className="text-sm text-muted-foreground">
            Approved by <span className="font-medium text-foreground">{name(event.approved_by_id)}</span>
          </p>
        )}
      </Section>

      {/* Caption */}
      {regular && (
        <Section title="Caption" id="caption-h">
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
        </Section>
      )}

      {/* Links: the Drive folder and the Facebook post */}
      <Section title="Links" id="links-h">
        <DriveLink
          label={regular ? "Photos and video" : "Recording"}
          url={event.drive_folder_url}
          canEdit={avail.edit_drive_link.state === "available"}
          onSave={(value) => run({ type: "edit_drive_link", value })}
        />
        {hasPost && (
          <div className="grid gap-2 rounded-lg border p-3 text-sm">
            <dl className="grid gap-1.5">
              {event.scheduled_post_at && <Row label="Post scheduled for" value={fmtDateTime(event.scheduled_post_at)} />}
              {event.posted_at && <Row label={regular ? "Posted" : "Went live"} value={fmtDateTime(event.posted_at)} />}
            </dl>
            <div className="flex flex-wrap gap-2">
              {event.post_link && (
                <Button asChild variant="outline" size="sm">
                  <a href={event.post_link} target="_blank" rel="noopener noreferrer">
                    <ExternalLinkIcon aria-hidden /> {regular ? "Open the Facebook post" : "Open the live video"}
                  </a>
                </Button>
              )}
              {avail.reschedule_post.state === "available" && (
                <Button variant="ghost" size="sm" onClick={() => setDialog("reschedule_post")}>
                  Change posting time
                </Button>
              )}
            </div>
          </div>
        )}
      </Section>

      {/* Details: what the header doesn't already show */}
      <Section
        title="Details"
        id="details-h"
        action={
          actor && avail.edit_details.state === "available" ? (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              <PencilIcon aria-hidden /> Edit details
            </Button>
          ) : null
        }
      >
        <dl className="grid gap-2 rounded-lg border p-3 text-sm">
          <Row label="Coverage" value={COVERAGE_LABELS[event.coverage]} />
          <Row label="Source" value={event.source ? SOURCE_LABELS[event.source] : "—"} />
          <Row label="Posting target" value={formatManila(manilaStartOfDay(event.due_date), "EEE, MMM d")} />
          {requesterHidden ? (
            <Row label="Requested by" value="Sign in to see" muted />
          ) : (
            <>
              <Row label="Requested by" value={event.requested_by ?? "—"} />
              <Row label="Contact" value={event.contact ?? "—"} />
            </>
          )}
          {event.notes && <Row label="Notes" value={event.notes} block />}
        </dl>
      </Section>

      {/* Rarely used, so last */}
      {actor && (moreActions || actor.roles.includes("head")) && (
        <section aria-label="More actions" className="flex flex-wrap gap-2 border-t pt-4">
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
        </section>
      )}

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

function Section({ title, id, action, children }: { title: string; id: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="grid gap-2" aria-labelledby={id}>
      <div className="flex min-h-8 items-center justify-between gap-2">
        <h3 id={id} className="text-sm font-semibold">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
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
  mine,
  staff,
  canAssign,
  onAssign,
}: {
  slot: Slot;
  currentId: string | null;
  currentName: string | null;
  /** The signed-in person fills this slot. */
  mine: boolean;
  staff: Staff[];
  canAssign: boolean;
  onAssign: (staffId: string | null) => void;
}) {
  const id = `assign-${slot}`;
  const eligible = staff.filter((s) => (s.active && canFillSlot(s.roles, slot)) || s.id === currentId);
  return (
    <div className="grid gap-1 text-sm">
      <dt>
        <label htmlFor={canAssign ? id : undefined} className="text-xs text-muted-foreground">
          {SLOT_LABELS[slot]}
        </label>
        {mine && <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 text-[11px] font-medium text-primary">You</span>}
      </dt>
      <dd className="min-w-0">
        {canAssign ? (
          <select
            id={id}
            value={currentId ?? ""}
            onChange={(e) => onAssign(e.target.value || null)}
            className={cn(
              "h-10 w-full rounded-md border border-input bg-background px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
              !currentId && NEEDED_SLOTS.includes(slot) && "border-amber-400 text-amber-800",
            )}
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
          <span className={cn(NEEDED_SLOTS.includes(slot) ? "text-amber-700" : "text-muted-foreground")}>Unassigned</span>
        )}
      </dd>
    </div>
  );
}

function DriveLink({
  label,
  url,
  canEdit,
  onSave,
}: {
  label: string;
  url: string | null;
  canEdit: boolean;
  onSave: (v: string | null) => void;
}) {
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
        <Label htmlFor="drive">Google Drive folder link</Label>
        <Input id="drive" name="drive" type="url" inputMode="url" defaultValue={url ?? ""} placeholder="https://drive.google.com/…" className="h-11" />
        <div className="flex gap-2">
          <Button type="submit" size="sm">Save link</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
      </form>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {url ? (
        <Button asChild variant="outline" size="sm">
          <a href={url} target="_blank" rel="noopener noreferrer">
            <FolderOpenIcon aria-hidden /> {label} (Drive)
          </a>
        </Button>
      ) : (
        <span className="text-muted-foreground">{label}: no Drive folder yet</span>
      )}
      {canEdit && (
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
          {url ? "Change link" : "Add Drive link"}
        </Button>
      )}
    </div>
  );
}
