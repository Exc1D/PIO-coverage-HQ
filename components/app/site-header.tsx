import Link from "next/link";
import { Suspense } from "react";
import { signOutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { getCurrentStaff } from "@/lib/auth/session";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <Link href="/" className="rounded-sm font-semibold tracking-tight focus-visible:ring-2 focus-visible:ring-ring">
          PIO Coverage HQ
        </Link>
        <Suspense fallback={<span className="h-8 w-20 animate-pulse rounded-md bg-muted" aria-hidden />}>
          <SessionBadge />
        </Suspense>
      </div>
    </header>
  );
}

async function SessionBadge() {
  const staff = await getCurrentStaff();
  if (!staff) {
    return (
      <Button asChild size="sm" variant="outline">
        <Link href="/login">Sign in to edit</Link>
      </Button>
    );
  }
  return (
    <form action={signOutAction} className="flex items-center gap-2">
      <span className="text-sm text-muted-foreground">
        <span className="sr-only">Signed in as </span>
        {staff.display_name}
      </span>
      <Button type="submit" size="sm" variant="ghost">
        Sign out
      </Button>
    </form>
  );
}
