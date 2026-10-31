import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SignInForm } from "@/components/app/auth-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { listStaffFresh, staffCount } from "@/lib/data/staff";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="mx-auto w-full max-w-sm px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>
            <h1 className="text-xl">Sign in to make changes</h1>
          </CardTitle>
          <CardDescription>Anyone with the link can view. Pick your name and enter your PIN to edit.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<FormSkeleton />}>
            <LoginLoader searchParams={searchParams} />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}

async function LoginLoader({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const [staff, count, params] = await Promise.all([listStaffFresh({ activeOnly: true }), staffCount(), searchParams]);
  if (count === 0) redirect("/setup");
  const next = safeNext(Array.isArray(params.next) ? params.next[0] : params.next);
  return <SignInForm staff={staff.map((s) => ({ id: s.id, display_name: s.display_name }))} next={next} />;
}

function FormSkeleton() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-11 w-full" />
    </div>
  );
}
