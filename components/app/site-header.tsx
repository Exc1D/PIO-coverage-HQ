import Link from "next/link";
import { Suspense } from "react";
import { AccountMenu } from "@/components/app/account-menu";
import { MainNav, TabBar, type NavAudience } from "@/components/app/main-nav";
import { Button } from "@/components/ui/button";
import { getCurrentStaff } from "@/lib/auth/session";
import type { Staff } from "@/lib/types";

export function SiteHeader() {
  return (
    // Named so page transitions slide under it instead of moving it (see globals.css).
    <header
      style={{ viewTransitionName: "site-header" }}
      className="sticky top-0 z-40 border-b border-black/10 bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl backdrop-saturate-150 print:hidden"
    >
      {/* Phones: brand + account; sections are in the tab bar at the bottom. Larger screens: one row with the nav. */}
      <div className="mx-auto flex h-12 max-w-6xl items-center gap-x-3 px-4 sm:h-14">
        <Link href="/" className="flex shrink-0 items-center rounded-sm font-semibold tracking-tight focus-visible:ring-2 focus-visible:ring-ring">
          PIO Production
        </Link>
        <div className="hidden sm:block sm:flex-1">
          {/* usePathname() needs a Suspense boundary on dynamic routes; the fallback is the same nav without the active state. */}
          <Suspense fallback={<MainNav static />}>
            <RoleNav />
          </Suspense>
        </div>
        <div className="ml-auto">
          <Suspense fallback={<span className="block size-8 animate-pulse rounded-full bg-muted" aria-hidden />}>
            <SessionBadge />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

const audience = (staff: Staff | null): NavAudience => (!staff ? "viewer" : staff.roles.includes("head") ? "head" : "staff");

/** The header nav for whoever is signed in. */
async function RoleNav() {
  return <MainNav audience={audience(await getCurrentStaff())} />;
}

/** The phone tab bar for whoever is signed in. */
export async function RoleTabBar() {
  return <TabBar audience={audience(await getCurrentStaff())} />;
}

/** Signed out: one "Sign in" button. Signed in: the account menu (My work, Staff for the head, Sign out). */
async function SessionBadge() {
  const staff = await getCurrentStaff();
  if (!staff) {
    return (
      <Button asChild size="sm" variant="outline" className="rounded-full">
        <Link href="/login">Sign in</Link>
      </Button>
    );
  }
  return <AccountMenu name={staff.display_name} roles={staff.roles} />;
}
