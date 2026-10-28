import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { RecentlyDeleted } from "@/components/admin/recently-deleted";
import { StaffAdmin } from "@/components/admin/staff-admin";
import { Skeleton } from "@/components/ui/skeleton";
import { lockedStaff } from "@/lib/auth/login";
import { getCurrentStaff } from "@/lib/auth/session";
import { listDeletedEvents } from "@/lib/data/events";
import { listStaff, openAssignments, staffWithHistory } from "@/lib/data/staff";

export const metadata: Metadata = { title: "Staff admin" };

export default function AdminPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Staff</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Add people, set their roles, reset PINs, deactivate leavers and restore deleted events. Head only.
      </p>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <AdminLoader />
      </Suspense>
    </main>
  );
}

async function AdminLoader() {
  await connection();
  const me = await getCurrentStaff();
  if (!me) {
    return (
      <p className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
        <Link href="/login?next=/admin" className="font-medium text-foreground underline underline-offset-4">
          Sign in
        </Link>{" "}
        as the head to manage staff.
      </p>
    );
  }
  if (!me.roles.includes("head")) {
    return <p className="rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">Only the head can manage staff.</p>;
  }
  const [staff, locks, assignments, history, deleted] = await Promise.all([
    listStaff(),
    lockedStaff(),
    openAssignments(),
    staffWithHistory(),
    listDeletedEvents(),
  ]);
  const rows = staff.map((s) => ({
    ...s,
    lockedUntil: locks.get(s.id)?.toISOString() ?? null,
    openAssignments: assignments.get(s.id) ?? [],
    hasHistory: history.has(s.id),
  }));
  const names = Object.fromEntries(staff.map((s) => [s.id, s.display_name]));
  return (
    <div className="grid gap-8">
      <StaffAdmin staff={rows} meId={me.id} />
      <section aria-labelledby="deleted-h" className="grid gap-2">
        <h2 id="deleted-h" className="text-sm font-semibold">
          Recently deleted events <span className="font-normal text-muted-foreground">· {deleted.length}</span>
        </h2>
        <p className="text-xs text-muted-foreground">
          Deleted events are kept for 30 days, then removed for good with the requester’s details. Restoring brings back
          the event with its history.
        </p>
        <RecentlyDeleted events={deleted} names={names} now={new Date().toISOString()} />
      </section>
    </div>
  );
}
