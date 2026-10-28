"use client";

import { Maximize2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

// Matches the sheet's close animation in globals.css, so it slides away before the route changes.
const CLOSE_MS = 300;

/**
 * An intercepted /events/[id]: a pull-down sheet on phones, a side panel on larger
 * screens. Closing goes back to the page underneath.
 */
export function EventDrawer({ id, children }: { id: string; children: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  // Next keeps this route alive (hidden) after going back. Effects clean up when it's
  // hidden, so reopen then: visiting the event again shows the sheet sliding in.
  useEffect(() => () => setOpen(true), []);

  function close() {
    setOpen(false);
    window.setTimeout(() => {
      // Only if nothing else (the browser's back button, a link) has left the event already.
      if (window.location.pathname === `/events/${id}`) router.back();
    }, CLOSE_MS);
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && close()}>
      <SheetContent side="auto" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-xl">
        <SheetHeader className="sticky top-0 z-10 flex-row items-center justify-between rounded-t-[22px] border-b bg-background/85 px-4 pt-5 pb-3 pr-14 backdrop-blur-xl backdrop-saturate-150 sm:rounded-none sm:pt-3">
          <SheetTitle className="text-sm font-medium text-muted-foreground">Event</SheetTitle>
          <SheetDescription className="sr-only">Event details, actions and activity</SheetDescription>
          {/* Plain anchor: a full load renders the page instead of re-opening the drawer. */}
          <a
            href={`/events/${id}`}
            className="inline-flex items-center gap-1 rounded-sm text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Maximize2Icon className="size-3.5" aria-hidden /> Full page
          </a>
        </SheetHeader>
        <div className="px-4 py-5">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
