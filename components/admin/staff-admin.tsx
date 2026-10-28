"use client";

import { KeyRoundIcon, LockIcon, PencilIcon, Trash2Icon, UserPlusIcon } from "lucide-react";
import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  clearLockAction,
  createStaffAction,
  deleteStaffAction,
  resetPinAction,
  setActiveAction,
  updateStaffAction,
  type StaffFormState,
} from "@/app/actions/staff";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROLE_LABELS, ROLES, type Role } from "@/lib/constants";
import { formatEventDate } from "@/lib/format";
import { OFFLINE_MESSAGE } from "@/lib/offline";
import type { OpenAssignment, Staff } from "@/lib/types";
import { cn } from "@/lib/utils";

type Row = Staff & { lockedUntil: string | null; openAssignments: OpenAssignment[]; hasHistory: boolean };
type Quick = (fn: () => Promise<{ ok: boolean; message: string }>, after?: () => void) => void;

const ROLE_HINTS: Record<Role, string> = {
  head: "Admin: schedules, assigns, confirms coverage, manages staff",
  photographer: "Takes photos; ticks Photos/Video done",
  videographer: "Takes video; ticks Photos/Video done",
  photo_editor: "Edits and brands photos; can be the event editor",
  video_editor: "Edits video; can be the event editor",
  graphics: "Makes graphics and pubmats",
  writer: "Posts captions in the event; marks them done",
  proofreader: "Reviews, corrects and approves captions",
  page_admin: "Schedules and posts on Facebook",
  cameraman: "Operates the camera for live streams; marks them covered",
  obs_tech: "Runs OBS for live streams; adds the live video link",
};

function Field({ name, label, error, ...rest }: { name: string; label: string; error?: string } & React.ComponentProps<typeof Input>) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={`staff-${name}`}>{label}</Label>
      <Input
        id={`staff-${name}`}
        name={name}
        className="h-11"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `staff-${name}-error` : undefined}
        {...rest}
      />
      {error && (
        <p id={`staff-${name}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function PinFields({ errors }: { errors: Record<string, string> }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field name="pin" label="New PIN (4–6 digits)" type="password" inputMode="numeric" pattern="\d{4,6}" maxLength={6} autoComplete="new-password" required error={errors.pin} />
      <Field name="confirm_pin" label="Repeat PIN" type="password" inputMode="numeric" maxLength={6} autoComplete="new-password" required error={errors.confirm_pin} />
    </div>
  );
}

function StaffDialog({ mode, person, onClose }: { mode: "add" | "edit"; person?: Row; onClose: () => void }) {
  const action = mode === "add" ? createStaffAction : updateStaffAction.bind(null, person!.id);
  const [state, formAction, pending] = useActionState(async (prev: StaffFormState, fd: FormData) => {
    let res: StaffFormState;
    try {
      res = await action(prev, fd);
    } catch {
      return { error: OFFLINE_MESSAGE };
    }
    if (res?.ok) {
      toast.success(res.message);
      onClose();
    }
    return res;
  }, undefined);
  const errors = (state && !state.ok && state.fieldErrors) || {};
  const values = state && !state.ok ? state.values : undefined;
  const roles = (values?.roles as string[] | undefined) ?? person?.roles ?? [];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <form key={JSON.stringify(values ?? {})} action={formAction} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{mode === "add" ? "Add staff member" : `Edit ${person!.display_name}`}</DialogTitle>
            <DialogDescription>Only names and roles are stored, in line with RA 10173.</DialogDescription>
          </DialogHeader>
          {state && !state.ok && state.error && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <Field name="full_name" label="Full name" required maxLength={120} defaultValue={(values?.full_name as string) ?? person?.full_name} error={errors.full_name} />
          <Field name="display_name" label="Display name (shown on cards)" required maxLength={40} placeholder="Ana R." defaultValue={(values?.display_name as string) ?? person?.display_name} error={errors.display_name} />
          <fieldset className="grid gap-2" aria-describedby={errors.roles ? "staff-roles-error" : undefined}>
            <legend className="mb-1 text-sm font-medium">Roles</legend>
            {ROLES.map((r) => (
              <label key={r} className="flex items-start gap-3 rounded-md border p-2.5 text-sm has-[:checked]:border-primary has-[:checked]:bg-accent/60">
                <input type="checkbox" name="roles" value={r} defaultChecked={roles.includes(r)} className="mt-0.5 size-4 accent-primary" />
                <span className="grid">
                  <span className="font-medium">{ROLE_LABELS[r]}</span>
                  <span className="text-xs text-muted-foreground">{ROLE_HINTS[r]}</span>
                </span>
              </label>
            ))}
            {errors.roles && (
              <p id="staff-roles-error" className="text-sm text-destructive">
                {errors.roles}
              </p>
            )}
          </fieldset>
          {mode === "add" && <PinFields errors={errors} />}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Discard
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : mode === "add" ? "Add person" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPinDialog({ person, onClose }: { person: Row; onClose: () => void }) {
  const [state, formAction, pending] = useActionState(async (prev: StaffFormState, fd: FormData) => {
    let res: StaffFormState;
    try {
      res = await resetPinAction(person.id, prev, fd);
    } catch {
      return { error: OFFLINE_MESSAGE };
    }
    if (res?.ok) {
      toast.success(res.message);
      onClose();
    }
    return res;
  }, undefined);
  const errors = (state && !state.ok && state.fieldErrors) || {};
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form action={formAction} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Reset PIN for {person.display_name}</DialogTitle>
            <DialogDescription>They’ll be signed out on every device. Tell them the new PIN in person.</DialogDescription>
          </DialogHeader>
          {state && !state.ok && state.error && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <PinFields errors={errors} />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Discard
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Reset PIN"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Deactivation ends their sessions; open assignments stay put, so list them for reassignment. */
function DeactivateDialog({ person, pending, quick, onClose }: { person: Row; pending: boolean; quick: Quick; onClose: () => void }) {
  const open = person.openAssignments;
  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Deactivate {person.display_name}?</DialogTitle>
          <DialogDescription>
            They’ll be signed out everywhere and can’t be assigned. Their past work still counts in reports, and you can
            reactivate them at any time.
          </DialogDescription>
        </DialogHeader>
        {open.length > 0 && (
          <div className="grid gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
            <p className="font-medium">
              Still assigned to {open.length} unfinished event{open.length === 1 ? "" : "s"}. Reassign{" "}
              {open.length === 1 ? "it" : "them"} so nothing stalls:
            </p>
            <ul className="grid max-h-40 gap-1 overflow-y-auto">
              {open.map((e) => (
                <li key={e.id}>
                  <Link href={`/events/${e.id}`} className="underline underline-offset-4">
                    {e.title}
                  </Link>{" "}
                  <span className="text-muted-foreground">· {formatEventDate({ event_date: e.event_date, start_time: null })}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Never mind
          </Button>
          <Button type="button" variant="destructive" disabled={pending} onClick={() => quick(() => setActiveAction(person.id, false), onClose)}>
            {pending ? "Deactivating…" : "Deactivate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Only offered for deactivated accounts with no history (delete_staff checks again). */
function DeleteStaffDialog({ person, pending, quick, onClose }: { person: Row; pending: boolean; quick: Quick; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete {person.display_name}’s account?</DialogTitle>
          <DialogDescription>
            {person.full_name} has no work on record, so the account can be removed completely, with their name and PIN.
            This can’t be undone; you’d need to add them again.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Never mind
          </Button>
          <Button type="button" variant="destructive" disabled={pending} onClick={() => quick(() => deleteStaffAction(person.id), onClose)}>
            {pending ? "Deleting…" : "Delete account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function StaffAdmin({ staff, meId }: { staff: Row[]; meId: string }) {
  const [dialog, setDialog] = useState<{ kind: "add" } | { kind: "edit" | "pin" | "deactivate" | "delete"; person: Row } | null>(null);
  const [pending, startTransition] = useTransition();

  /** Run an action and toast its result; `after` runs either way once it settles (e.g. close a dialog). */
  const quick: Quick = (fn, after) =>
    startTransition(async () => {
      let res;
      try {
        res = await fn();
      } catch {
        toast.error(OFFLINE_MESSAGE);
        return;
      }
      if (res.ok) toast.success(res.message);
      else toast.error(res.message);
      after?.();
    });

  const active = staff.filter((s) => s.active);
  const inactive = staff.filter((s) => !s.active);

  const list = (rows: Row[]) => (
    <ul className="divide-y rounded-xl border bg-card">
      {rows.map((s) => (
        <li key={s.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="min-w-0">
            <p className="font-medium">
              {s.display_name} <span className="font-normal text-muted-foreground">· {s.full_name}</span>
              {s.id === meId && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs">You</span>}
            </p>
            <p className="mt-1 flex flex-wrap gap-1">
              {s.roles.map((r) => (
                <span key={r} className={cn("rounded-full border px-2 py-0.5 text-xs", r === "head" && "border-primary font-medium")}>
                  {ROLE_LABELS[r]}
                </span>
              ))}
            </p>
            {s.active && s.openAssignments.length > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                {s.openAssignments.length} unfinished event{s.openAssignments.length === 1 ? "" : "s"}
              </p>
            )}
            {s.lockedUntil && (
              <p className="mt-1 flex items-center gap-1 text-xs font-medium text-red-700">
                <LockIcon className="size-3.5" aria-hidden /> Locked out after wrong PINs
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {s.lockedUntil && (
              <Button size="sm" variant="secondary" disabled={pending} onClick={() => quick(() => clearLockAction(s.id))}>
                Clear lock
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setDialog({ kind: "edit", person: s })} aria-label={`Edit ${s.display_name}`}>
              <PencilIcon aria-hidden /> Edit
            </Button>
            <Button size="sm" variant="outline" onClick={() => setDialog({ kind: "pin", person: s })} aria-label={`Reset PIN for ${s.display_name}`}>
              <KeyRoundIcon aria-hidden /> Reset PIN
            </Button>
            {s.active ? (
              s.id !== meId && (
                <Button size="sm" variant="ghost" className="text-destructive" disabled={pending} onClick={() => setDialog({ kind: "deactivate", person: s })}>
                  Deactivate
                </Button>
              )
            ) : (
              <>
                <Button size="sm" variant="secondary" disabled={pending} onClick={() => quick(() => setActiveAction(s.id, true))}>
                  Reactivate
                </Button>
                {!s.hasHistory && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    disabled={pending}
                    onClick={() => setDialog({ kind: "delete", person: s })}
                    aria-label={`Delete ${s.display_name}’s account`}
                  >
                    <Trash2Icon aria-hidden /> Delete
                  </Button>
                )}
              </>
            )}
          </div>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="grid gap-6">
      <div className="flex justify-end">
        <Button onClick={() => setDialog({ kind: "add" })}>
          <UserPlusIcon aria-hidden /> Add staff member
        </Button>
      </div>
      <section aria-labelledby="active-h" className="grid gap-2">
        <h2 id="active-h" className="text-sm font-semibold">
          Active <span className="font-normal text-muted-foreground">· {active.length}</span>
        </h2>
        {list(active)}
      </section>
      {inactive.length > 0 && (
        <section aria-labelledby="inactive-h" className="grid gap-2">
          <h2 id="inactive-h" className="text-sm font-semibold">
            Deactivated <span className="font-normal text-muted-foreground">· {inactive.length}</span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Accounts with work on record stay here so reports keep their names. Accounts with none (e.g. added by mistake)
            can be deleted.
          </p>
          {list(inactive)}
        </section>
      )}

      {dialog?.kind === "add" && <StaffDialog mode="add" onClose={() => setDialog(null)} />}
      {dialog?.kind === "edit" && <StaffDialog mode="edit" person={dialog.person} onClose={() => setDialog(null)} />}
      {dialog?.kind === "pin" && <ResetPinDialog person={dialog.person} onClose={() => setDialog(null)} />}
      {dialog?.kind === "deactivate" && (
        <DeactivateDialog person={dialog.person} pending={pending} quick={quick} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === "delete" && <DeleteStaffDialog person={dialog.person} pending={pending} quick={quick} onClose={() => setDialog(null)} />}
    </div>
  );
}
