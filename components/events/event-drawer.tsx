"use client";

import { Maximize2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

/**
 * An intercepted /events/[id]: a pull-down sheet on phones, a side panel on larger
 * screens. Closing goes back to the page underneath.
 */
export function EventDrawer({ id, children }: { id: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <Sheet open onOpenChange={(open) => !open && router.back()}>
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
