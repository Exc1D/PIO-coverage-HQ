"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { XIcon } from "lucide-react"
import { Dialog as SheetPrimitive } from "radix-ui"
import { Grabber, useSwipeDismiss } from "@/components/ui/use-swipe-dismiss"

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "ios-overlay fixed inset-0 z-50 bg-black/40",
        className
      )}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  /** "auto": a pull-down bottom sheet on phones, a right-hand panel from 640px up. */
  side?: "top" | "right" | "bottom" | "left" | "auto"
  showCloseButton?: boolean
}) {
  const closeRef = React.useRef<HTMLButtonElement>(null)
  const swipeRef = useSwipeDismiss<HTMLDivElement>(() => closeRef.current?.click())
  const swipeable = side === "auto" || side === "bottom"
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        className={cn(
          "fixed z-50 flex flex-col gap-4 bg-background shadow-lg outline-none",
          side === "auto" &&
            "ios-sheet ios-sheet-auto inset-x-0 bottom-0 h-[calc(100dvh-max(env(safe-area-inset-top),0.75rem)-1.75rem)] overscroll-contain rounded-t-[22px] pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_40px_rgb(0_0_0/0.18)] sm:inset-y-0 sm:right-0 sm:left-auto sm:h-full sm:w-3/4 sm:max-w-sm sm:rounded-none sm:border-l sm:pb-0 sm:shadow-2xl",
          side === "right" &&
            "inset-y-0 right-0 h-full w-3/4 border-l transition ease-in-out data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=closed]:slide-out-to-right data-[state=open]:animate-in data-[state=open]:duration-500 data-[state=open]:slide-in-from-right sm:max-w-sm",
          side === "left" &&
            "inset-y-0 left-0 h-full w-3/4 border-r transition ease-in-out data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=closed]:slide-out-to-left data-[state=open]:animate-in data-[state=open]:duration-500 data-[state=open]:slide-in-from-left sm:max-w-sm",
          side === "top" &&
            "inset-x-0 top-0 h-auto border-b transition ease-in-out data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=closed]:slide-out-to-top data-[state=open]:animate-in data-[state=open]:duration-500 data-[state=open]:slide-in-from-top",
          side === "bottom" &&
            "ios-sheet inset-x-0 bottom-0 h-auto rounded-t-[22px] pb-[env(safe-area-inset-bottom)]",
          className
        )}
        {...props}
        ref={swipeable ? swipeRef : undefined}
      >
        {swipeable && (
          // Sticky so it stays at the top while the sheet's content scrolls.
          <Grabber className="pointer-events-none sticky top-0 z-20 -mb-4 flex h-4 shrink-0 justify-center pt-1.5 sm:hidden" />
        )}
        {children}
        <SheetPrimitive.Close ref={closeRef} hidden tabIndex={-1} aria-hidden />
        {showCloseButton && (
          <SheetPrimitive.Close className="absolute top-3 right-3 z-20 inline-flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground transition-[transform,background-color] duration-150 hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden active:scale-90 disabled:pointer-events-none max-sm:top-4">
            <XIcon className="size-4" />
            <span className="sr-only">Close</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 p-4", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("font-semibold text-foreground", className)}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
