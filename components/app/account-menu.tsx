"use client";

import { CalendarClockIcon, ChevronDownIcon, LogOutIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { signOutAction } from "@/app/actions/auth";
import { initials } from "@/components/app/labels";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_LABELS, type Role } from "@/lib/constants";

/** The header's right side when signed in: one avatar that opens everything account-related. */
export function AccountMenu({ name, roles }: { name: string; roles: Role[] }) {
  const [signingOut, startSignOut] = useTransition();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account menu for ${name}`}
        className="group flex items-center gap-1 rounded-full p-0.5 transition-colors duration-200 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:opacity-60 data-[state=open]:bg-accent sm:pr-1.5"
      >
        <span aria-hidden className="inline-flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {initials(name)}
        </span>
        <ChevronDownIcon
          aria-hidden
          className="hidden size-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180 sm:block"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-60">
        <DropdownMenuLabel className="grid gap-0.5 py-2 font-normal">
          <span className="truncate text-sm font-semibold">{name}</span>
          <span className="text-xs text-muted-foreground">{roles.map((r) => ROLE_LABELS[r]).join(" · ")}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/me" transitionTypes={["nav-forward"]}>
            <CalendarClockIcon aria-hidden /> My work
          </Link>
        </DropdownMenuItem>
        {roles.includes("head") && (
          <DropdownMenuItem asChild>
            <Link href="/admin" transitionTypes={["nav-forward"]}>
              <UsersIcon aria-hidden /> Staff
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={signingOut} onSelect={() => startSignOut(() => signOutAction())}>
          <LogOutIcon aria-hidden /> {signingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
