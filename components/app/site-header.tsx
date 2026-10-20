import Link from "next/link";
import { Suspense } from "react";
import { signOutAction } from "@/app/actions/auth";
import { initials } from "@/components/app/labels";
import { MainNav } from "@/components/app/main-nav";
import { Button } from "@/components/ui/button";
import { getCurrentStaff } from "@/lib/auth/session";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" className="shrink-0 rounded-sm font-semibold tracking-tight focus-visible:ring-2 focus-visible:ring-ring">
            <span className="sm:hidden">PIO HQ</span>
            <span className="hidden sm:inline">PIO Coverage HQ</span>
          </Link>
          {/* usePathname() needs a Suspense boundary on dynamic routes; the fallback is the same nav without the active state. */}
          <Suspense fallback={<MainNav static />}>
            <MainNav />
          </Suspense>
        </div>
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
        <span aria-hidden className="inline-flex size-8 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground sm:hidden" title={staff.display_name}>
          {initials(staff.display_name)}
        </span>
        <span className="sr-only sm:not-sr-only">{staff.display_name}</span>
      </span>
      <Button type="submit" size="sm" variant="ghost">
        Sign out
      </Button>
    </form>
  );
}
