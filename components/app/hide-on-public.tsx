"use client";

import { usePathname } from "next/navigation";

/** Public pages (the request form) don't show staff navigation. */
export function HideOnPublic({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return pathname === "/request" || pathname.startsWith("/request/") ? null : children;
}
