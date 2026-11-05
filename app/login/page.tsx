import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SignInForm } from "@/components/app/auth-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { staffCount } from "@/lib/data/staff";
import { isStaffOnlyPath, safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="mx-auto w-full max-w-sm px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>
            <h1 className="text-xl">Sign in</h1>
          </CardTitle>
          <Suspense fallback={<Skeleton className="h-5 w-full" />}>
            <LoginIntro searchParams={searchParams} />
          </Suspense>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<FormSkeleton />}>
            <div className="ios-reveal">
              <LoginLoader searchParams={searchParams} />
            </div>
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}

const nextParam = (params: Awaited<PageProps<"/login">["searchParams"]>) =>
  safeNext(Array.isArray(params.next) ? params.next[0] : params.next);

async function LoginIntro({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  return (
    <CardDescription>
      {isStaffOnlyPath(nextParam(await searchParams))
        ? "This page is for staff only. Enter your name and PIN to open it."
        : "Anyone with the link can view. Enter your name and PIN to make changes."}
    </CardDescription>
  );
}

async function LoginLoader({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const [count, params] = await Promise.all([staffCount(), searchParams]);
  if (count === 0) redirect("/setup");
  return <SignInForm next={nextParam(params)} />;
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
