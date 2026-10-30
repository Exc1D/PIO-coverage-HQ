"use client";

import { CalendarClockIcon, CalendarDaysIcon, ChartPieIcon, FileTextIcon, SquareKanbanIcon, UserPlusIcon, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type NavLink = { href: string; label: string; icon: LucideIcon };

const DASHBOARD: NavLink = { href: "/", label: "Dashboard", icon: ChartPieIcon };
const MY_WORK: NavLink = { href: "/me", label: "My work", icon: CalendarClockIcon };
const BOARD: NavLink = { href: "/board", label: "Board", icon: SquareKanbanIcon };
const CALENDAR: NavLink = { href: "/calendar", label: "Calendar", icon: CalendarDaysIcon };
const ASSIGN: NavLink = { href: "/needs-assignment", label: "Assign", icon: UserPlusIcon };
const REPORTS: NavLink = { href: "/reports", label: "Reports", icon: FileTextIcon };

/**
 * Who's looking decides the sections (five at most, for the phone tab bar).
 * Staff get My work in place of Assign, which only the head uses; viewers and
 * the head keep Assign (the head's own work is in the account menu).
 */
export type NavAudience = "viewer" | "staff" | "head";

const LINKS: Record<NavAudience, NavLink[]> = {
  viewer: [DASHBOARD, BOARD, CALENDAR, ASSIGN, REPORTS],
  head: [DASHBOARD, BOARD, CALENDAR, ASSIGN, REPORTS],
  staff: [DASHBOARD, MY_WORK, BOARD, CALENDAR, REPORTS],
};

/** Moving between sections crossfades the page, like switching tabs (see globals.css). */
const TAB_SWITCH = ["tab-switch"];

const isCurrent = (pathname: string | null, href: string) =>
  pathname !== null && (href === "/" ? pathname === "/" : pathname.startsWith(href));

type Props = { static?: boolean; audience?: NavAudience };

export function MainNav({ static: isStatic, audience = "viewer" }: Props) {
  return isStatic ? <NavLinks pathname={null} links={LINKS[audience]} /> : <LiveNav links={LINKS[audience]} />;
}

function LiveNav({ links }: { links: NavLink[] }) {
  return <NavLinks pathname={usePathname()} links={links} />;
}

/** The header's nav, from 640px up. Phones use the tab bar at the bottom instead. */
function NavLinks({ pathname, links }: { pathname: string | null; links: NavLink[] }) {
  return (
    <nav aria-label="Main" className="flex gap-1">
      {links.map((l) => {
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

export function TabBar({ static: isStatic, audience = "viewer" }: Props) {
  return isStatic ? <TabBarLinks pathname={null} links={LINKS[audience]} /> : <LiveTabBar links={LINKS[audience]} />;
}

function LiveTabBar({ links }: { links: NavLink[] }) {
  return <TabBarLinks pathname={usePathname()} links={links} />;
}

/** iOS-style tab bar, phones only: fixed to the bottom, translucent, clear of the home indicator. */
function TabBarLinks({ pathname, links }: { pathname: string | null; links: NavLink[] }) {
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
          {links.map((l) => {
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
