import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { StaffAdmin } from "@/components/admin/staff-admin";
import { Skeleton } from "@/components/ui/skeleton";
import { lockedStaff } from "@/lib/auth/login";
import { getCurrentStaff } from "@/lib/auth/session";
import { listStaff } from "@/lib/data/staff";

export const metadata: Metadata = { title: "Staff admin" };

export default function AdminPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Staff</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Add people, set their roles, reset PINs and deactivate leavers. Head only.
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
  const [staff, locks] = await Promise.all([listStaff(), lockedStaff()]);
  const rows = staff.map((s) => ({ ...s, lockedUntil: locks.get(s.id)?.toISOString() ?? null }));
  return <StaffAdmin staff={rows} meId={me.id} />;
}
