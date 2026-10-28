"use client";

import { ArrowUpRightIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive, Slot } from "radix-ui";
import { useRef, useState } from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

const HOLD_MS = 450;
// A finger that drifts further than this is scrolling, not holding.
const SLOP_PX = 10;

/**
 * Press-and-hold on touch screens. Mouse input is ignored (hover does that job), and the
 * click that ends a long press is swallowed so the link underneath doesn't also open.
 */
function useLongPress(onLongPress: () => void) {
  const timer = useRef<number | undefined>(undefined);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const [pressing, setPressing] = useState(false);

  const cancel = () => {
    window.clearTimeout(timer.current);
    origin.current = null;
    setPressing(false);
  };

  return {
    pressing,
    handlers: {
      onPointerDown(e: React.PointerEvent) {
        fired.current = false;
        if (e.pointerType === "mouse" || !e.isPrimary) return;
        origin.current = { x: e.clientX, y: e.clientY };
        setPressing(true);
        timer.current = window.setTimeout(() => {
          fired.current = true;
          origin.current = null;
          setPressing(false);
          navigator.vibrate?.(8);
          onLongPress();
        }, HOLD_MS);
      },
      onPointerMove(e: React.PointerEvent) {
        const o = origin.current;
        if (o && Math.hypot(e.clientX - o.x, e.clientY - o.y) > SLOP_PX) cancel();
      },
      onPointerUp: cancel,
      onPointerCancel: cancel,
      onPointerLeave: cancel,
      onContextMenu(e: React.MouseEvent) {
        // Android opens the link menu on a long press; the peek replaces it.
        if (origin.current || fired.current) e.preventDefault();
      },
      onClick(e: React.MouseEvent) {
        if (!fired.current) return;
        fired.current = false;
        e.preventDefault();
        e.stopPropagation();
      },
    },
  };
}

/**
 * Peek at something without opening it. With a mouse, hovering (or keyboard focus) shows
 * `preview` in a card beside the trigger. On a phone or tablet, press and hold the trigger:
 * the page blurs and the preview pops up with an Open action, like an iOS context menu.
 * A plain tap or click still follows the link as usual.
 */
export function Peek({
  children,
  preview,
  href,
  label,
  side = "right",
  align = "start",
}: {
  /** The link that opens the item. */
  children: React.ReactElement;
  preview: React.ReactNode;
  href: string;
  /** What's being previewed, for screen readers (e.g. the event title). */
  label: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { pressing, handlers } = useLongPress(() => setOpen(true));

  return (
    <>
      <HoverCard openDelay={350} closeDelay={120}>
        <HoverCardTrigger asChild>
          <Slot.Root data-peek="" data-pressing={pressing || undefined} {...handlers}>
            {children}
          </Slot.Root>
        </HoverCardTrigger>
        <HoverCardContent side={side} align={align} collisionPadding={12} className="w-72">
          {preview}
        </HoverCardContent>
      </HoverCard>

      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="ios-overlay fixed inset-0 z-50 bg-black/15 backdrop-blur-xl backdrop-saturate-150" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="ios-peek fixed top-1/2 left-1/2 z-50 grid w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 gap-2 outline-none"
          >
            <DialogPrimitive.Title className="sr-only">Preview: {label}</DialogPrimitive.Title>
            <div className="max-h-[60dvh] overflow-y-auto rounded-2xl bg-popover p-4 text-popover-foreground shadow-2xl">{preview}</div>
            <div className="w-56 overflow-hidden rounded-xl bg-popover/90 shadow-xl backdrop-blur-xl">
              <button
                type="button"
                autoFocus
                onClick={() => {
                  setOpen(false);
                  router.push(href);
                }}
                className="flex w-full items-center justify-between px-4 py-3 text-left text-[17px] transition-colors active:bg-foreground/10 focus-visible:bg-foreground/5 focus-visible:outline-none"
              >
                Open
                <ArrowUpRightIcon className="size-5" aria-hidden />
              </button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  );
}
