"use client";

import { CalendarDaysIcon, ChartPieIcon, FileTextIcon, SquareKanbanIcon, UserPlusIcon, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Dashboard", icon: ChartPieIcon },
  { href: "/board", label: "Board", icon: SquareKanbanIcon },
  { href: "/calendar", label: "Calendar", icon: CalendarDaysIcon },
  { href: "/needs-assignment", label: "Assign", icon: UserPlusIcon },
  { href: "/reports", label: "Reports", icon: FileTextIcon },
];

/** Moving between sections crossfades the page, like switching tabs (see globals.css). */
const TAB_SWITCH = ["tab-switch"];

const isCurrent = (pathname: string | null, href: string) =>
  pathname !== null && (href === "/" ? pathname === "/" : pathname.startsWith(href));

export function MainNav(props: { static?: boolean }) {
  return props.static ? <NavLinks pathname={null} /> : <LiveNav />;
}

function LiveNav() {
  return <NavLinks pathname={usePathname()} />;
}

/** The header's nav, from 640px up. Phones use the tab bar at the bottom instead. */
function NavLinks({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Main" className="flex gap-1">
      {LINKS.map((l) => {
        const current = isCurrent(pathname, l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            transitionTypes={TAB_SWITCH}
            aria-current={current ? "page" : undefined}
            className={cn(
              "whitespace-nowrap rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors duration-200 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:opacity-60",
              current && "bg-foreground/[0.06] font-medium text-foreground",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function TabBar(props: { static?: boolean }) {
  return props.static ? <TabBarLinks pathname={null} /> : <LiveTabBar />;
}

function LiveTabBar() {
  return <TabBarLinks pathname={usePathname()} />;
}

/** iOS-style tab bar, phones only: fixed to the bottom, translucent, clear of the home indicator. */
function TabBarLinks({ pathname }: { pathname: string | null }) {
  return (
    <>
      {/* Keeps the end of the page from hiding under the bar. */}
      <div aria-hidden className="h-[calc(3.25rem+env(safe-area-inset-bottom))] sm:hidden print:hidden" />
      <nav
        aria-label="Main"
        style={{ viewTransitionName: "tab-bar" }}
        className="fixed inset-x-0 bottom-0 z-40 border-t border-black/10 bg-background/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150 sm:hidden print:hidden"
      >
        <ul className="mx-auto flex max-w-md">
          {LINKS.map((l) => {
            const current = isCurrent(pathname, l.href);
            const Icon = l.icon;
            return (
              <li key={l.href} className="flex-1">
                <Link
                  href={l.href}
                  transitionTypes={TAB_SWITCH}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "group flex h-[3.25rem] flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-muted-foreground transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    current && "text-primary",
                  )}
                >
                  <Icon
                    aria-hidden
                    strokeWidth={current ? 2.25 : 1.75}
                    className="size-6 transition-transform duration-200 ease-[var(--ease-spring)] group-active:scale-[0.82]"
                  />
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
