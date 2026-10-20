import Link from "next/link";
import { Suspense } from "react";
import { signOutAction } from "@/app/actions/auth";
import { initials } from "@/components/app/labels";
import { MainNav } from "@/components/app/main-nav";
import { Button } from "@/components/ui/button";
import { getCurrentStaff } from "@/lib/auth/session";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 print:hidden">
      {/* Phones: brand + session on the first row, nav scrolls on its own row. Larger screens: one row. */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 px-4 sm:h-14 sm:flex-nowrap">
        <Link href="/" className="flex h-12 shrink-0 items-center rounded-sm font-semibold tracking-tight focus-visible:ring-2 focus-visible:ring-ring sm:h-auto">
          PIO Coverage HQ
        </Link>
        <div className="order-last -mx-4 w-[calc(100%+2rem)] border-t px-4 py-1.5 sm:order-none sm:mx-0 sm:w-auto sm:flex-1 sm:border-0 sm:p-0">
          {/* usePathname() needs a Suspense boundary on dynamic routes; the fallback is the same nav without the active state. */}
          <Suspense fallback={<MainNav static />}>
            <MainNav />
          </Suspense>
        </div>
        <div className="ml-auto">
          <Suspense fallback={<span className="block h-8 w-20 animate-pulse rounded-md bg-muted" aria-hidden />}>
            <SessionBadge />
          </Suspense>
        </div>
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
    <form action={signOutAction} className="flex items-center gap-1 sm:gap-2">
      {staff.roles.includes("head") && (
        <Button asChild size="sm" variant="ghost">
          <Link href="/admin">Staff</Link>
        </Button>
      )}
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
