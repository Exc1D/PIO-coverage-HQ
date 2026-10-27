"use client";

import { CopyIcon, GitCompareIcon, MessageSquareWarningIcon, PencilIcon } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CommandPayload } from "@/lib/commands";
import { formatManila } from "@/lib/time";
import { countWords, diffWords } from "@/lib/text-diff";
import type { ActivityRow, CaptionRevision, EventRow } from "@/lib/types";
import type { Availability, CommandType } from "@/lib/workflow";

type Props = {
  event: Pick<EventRow, "caption_text" | "status">;
  avail: Record<CommandType, { state: Availability; reason?: string }>;
  /** Newest first; empty for viewers who aren't signed in. */
  revisions: CaptionRevision[];
  feedback: ActivityRow | null;
  nameOf: (id: string | null | undefined) => string;
  pending: boolean;
  onRun: (payload: CommandPayload) => void;
};

const when = (iso: string) => formatManila(iso, "MMM d · h:mm a");

/**
 * The caption the writer posts into the event, and the tools the proofreader
 * reviews it with: the open feedback note, a copy button, and a word diff
 * against any earlier version.
 */
export function CaptionPanel({ event, avail, revisions, feedback, nameOf, pending, onRun }: Props) {
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [comparing, setComparing] = useState(false);
  const text = event.caption_text;

  const canEdit = avail.edit_caption_text.state === "available";
  const canSubmit = avail.submit_caption.state === "available";
  const proofreading = event.status === "for_proofreading";

  // The newest revision is the current text; anything after it can be compared.
  const older = revisions.slice(1);
  const [baseId, setBaseId] = useState<number | null>(null);
  const base = older.find((r) => r.id === baseId) ?? older[0];

  async function copy() {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Caption copied");
    } catch {
      toast.error("Couldn't copy. Select the text and copy it instead.");
    }
  }

  if (editing) {
    return (
      <form
        className="grid gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const value = String(f.get("caption") ?? "");
          const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
          onRun(submitter?.value === "submit" ? { type: "submit_caption", value } : { type: "edit_caption_text", value });
          setEditing(false);
        }}
      >
        <Label htmlFor={`${id}-caption`}>{proofreading ? "Correct the caption" : "Caption"}</Label>
        <Textarea
          id={`${id}-caption`}
          name="caption"
          defaultValue={text ?? ""}
          rows={10}
          maxLength={20000}
          placeholder="Paste or write the caption exactly as it should be posted."
          autoFocus
        />
        <div className="flex flex-wrap gap-2">
          {canSubmit && (
            <Button type="submit" size="sm" name="intent" value="submit">
              Save and mark Caption done
            </Button>
          )}
          <Button type="submit" size="sm" name="intent" value="save" variant={canSubmit ? "outline" : "default"}>
            {proofreading ? "Save corrections" : "Save draft"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
        {canSubmit && (
          <p className="text-xs text-muted-foreground">
            Marking it done sends the event to the proofreader once the photos/video are done too.
          </p>
        )}
      </form>
    );
  }

  return (
    <div className="grid gap-3">
      {feedback && (
        <div role="note" className="grid gap-1 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="flex items-center gap-1.5 font-medium">
            <MessageSquareWarningIcon className="size-4" aria-hidden /> Changes requested by {nameOf(feedback.actor_id)}
          </p>
          <p className="whitespace-pre-wrap">{String(feedback.details.reason ?? "")}</p>
          <p className="text-xs opacity-80">
            <time dateTime={feedback.created_at}>{when(feedback.created_at)}</time> · Fix the caption, then mark it done again.
          </p>
        </div>
      )}

      {text ? (
        <div className="grid gap-1">
          <blockquote
            data-testid="caption-text"
            className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-lg border bg-muted/40 p-3 text-sm"
          >
            {text}
          </blockquote>
          <p className="text-xs text-muted-foreground">
            {countWords(text)} words · {text.length} characters
            {revisions[0] && (
              <>
                {" "}· last saved by {nameOf(revisions[0].author_id)}, <time dateTime={revisions[0].created_at}>{when(revisions[0].created_at)}</time>
              </>
            )}
          </p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          {canEdit ? "No caption yet. Post it here so the proofreader can review it in the event." : "No caption posted yet."}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {canEdit && (
          <Button variant={text ? "outline" : "default"} size="sm" disabled={pending} onClick={() => setEditing(true)}>
            <PencilIcon aria-hidden /> {text ? (proofreading ? "Correct caption" : "Edit caption") : "Post caption"}
          </Button>
        )}
        {text && (
          <Button variant="outline" size="sm" onClick={copy}>
            <CopyIcon aria-hidden /> Copy
          </Button>
        )}
        {base && (
          <Button variant="outline" size="sm" aria-expanded={comparing} onClick={() => setComparing((c) => !c)}>
            <GitCompareIcon aria-hidden /> {comparing ? "Hide changes" : "What changed"}
          </Button>
        )}
      </div>

      {comparing && base && (
        <div className="grid gap-2 rounded-lg border p-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label htmlFor={`${id}-base`} className="text-muted-foreground">
              Compare with
            </label>
            <select
              id={`${id}-base`}
              value={base.id}
              onChange={(e) => setBaseId(Number(e.target.value))}
              className="h-9 max-w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              {older.map((r) => (
                <option key={r.id} value={r.id}>
                  {nameOf(r.author_id)}, {when(r.created_at)}
                </option>
              ))}
            </select>
          </div>
          <CaptionDiff before={base.body ?? ""} after={text ?? ""} />
          <p className="text-xs text-muted-foreground">
            <ins className="bg-green-100 text-green-900 no-underline dark:bg-green-900/50 dark:text-green-100">Added</ins> ·{" "}
            <del className="bg-red-100 text-red-900 dark:bg-red-900/50 dark:text-red-100">removed</del>
          </p>
        </div>
      )}
    </div>
  );
}

function CaptionDiff({ before, after }: { before: string; after: string }) {
  if (before === after) return <p className="text-sm text-muted-foreground">No differences.</p>;
  return (
    <p data-testid="caption-diff" className="max-h-80 overflow-y-auto whitespace-pre-wrap text-sm">
      {diffWords(before, after).map((p, i) =>
        p.kind === "added" ? (
          <ins key={i} className="bg-green-100 text-green-900 no-underline dark:bg-green-900/50 dark:text-green-100">
            {p.text}
          </ins>
        ) : p.kind === "removed" ? (
          <del key={i} className="bg-red-100 text-red-900 dark:bg-red-900/50 dark:text-red-100">
            {p.text}
          </del>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </p>
  );
}
