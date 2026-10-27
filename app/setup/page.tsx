import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SetupForm } from "@/components/app/auth-forms";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { staffCount } from "@/lib/data/staff";

export const metadata: Metadata = { title: "First-time setup" };

export default function SetupPage() {
  return (
    <main className="mx-auto w-full max-w-sm px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>
            <h1 className="text-xl">Set up PIO Production</h1>
          </CardTitle>
          <CardDescription>
            Create the office head’s account. The head can then add the rest of the team.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <SetupGate />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}

async function SetupGate() {
  if ((await staffCount()) > 0) redirect("/login");
  return <SetupForm />;
}
