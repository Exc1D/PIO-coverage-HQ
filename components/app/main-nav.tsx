"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/board", label: "Board" },
];

export function MainNav(props: { static?: boolean }) {
  return props.static ? <NavLinks pathname={null} /> : <LiveNav />;
}

function LiveNav() {
  return <NavLinks pathname={usePathname()} />;
}

function NavLinks({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Main" className="-mx-1 flex gap-1 overflow-x-auto">
      {LINKS.map((l) => {
        const current = pathname !== null && (l.href === "/" ? pathname === "/" : pathname.startsWith(l.href));
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              current && "bg-accent font-medium text-foreground",
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
