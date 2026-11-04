"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";

type Point = { x: number; y: number };
/** An item something else is carrying to its spot, and when that trip ends (`performance.now()` time). */
export type Landing = { id: string; until: number };

export const MOVE_MS = 240;
export const MOVE_EASING = "cubic-bezier(0.25, 1, 0.5, 1)"; // ease-out-quart; the Web Animations API can't read CSS variables.

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** For `scrollIntoView`: a smooth scroll is motion too. */
export function scrollBehavior(): ScrollBehavior {
  return prefersReducedMotion() ? "auto" : "smooth";
}

/** How far back an item must start to appear to travel from its old spot. "new" if it wasn't there before, null if it hasn't moved. */
export function flipOffset(before: Point | undefined, after: Point): Point | "new" | null {
  if (!before) return "new";
  const x = before.x - after.x;
  const y = before.y - after.y;
  return x || y ? { x, y } : null;
}

/** How long an item must stay hidden while its landing finishes. */
export function landingMs(landing: Landing | null | undefined, id: string, now: number) {
  return landing?.id === id ? Math.max(0, landing.until - now) : 0;
}

function onScreen(r: { left: number; right: number; top: number; bottom: number }) {
  return r.right > 0 && r.bottom > 0 && r.left < window.innerWidth && r.top < window.innerHeight;
}

/**
 * Slides `[data-flip-id]` items from where they were to where a render put them, and fades in new ones.
 * Put the returned ref on a positioned container: positions are measured against it, so scrolling and
 * content above it don't count as moves. A card moving column is a new element with the same id, so it
 * still travels. `useOptimistic` updates are urgent, not transitions, so React's <ViewTransition> sits
 * these out.
 *
 * `landingRef` names an item something else is already carrying to its spot (a dropped card's drag
 * overlay). It stays hidden until that trip ends, moved or not, so there's only ever one copy on screen.
 * It goes by the clock rather than the next render: the overlay clearing and the card moving can commit
 * separately, and a move confirmed later in a dialog should slide as usual.
 *
 * ponytail: an item that moves again mid-slide restarts from its old layout spot, a small jump. It shows
 * when a save is rejected within the slide. Read the running transform if that ever bothers anyone.
 */
export function useFlip<T extends HTMLElement>(landingRef?: RefObject<Landing | null>) {
  const container = useRef<T>(null);
  const last = useRef<{ width: number; at: Map<string, Point> } | null>(null);

  // No deps on purpose: any render can move things, and an unchanged layout costs only the reads.
  useLayoutEffect(() => {
    if (!container.current) return;
    const items = [...container.current.querySelectorAll<HTMLElement>("[data-flip-id]")];
    const at = new Map(items.map((el) => [el.dataset.flipId as string, { x: el.offsetLeft, y: el.offsetTop }]));
    const prev = last.current;
    last.current = { width: window.innerWidth, at };
    // A rotated phone or resized window moves everything, and that isn't a change worth showing.
    if (!prev || prev.width !== window.innerWidth || prefersReducedMotion()) return;

    const now = performance.now();
    for (const el of items) {
      const id = el.dataset.flipId as string;
      const hideMs = landingMs(landingRef?.current, id, now);
      if (hideMs) {
        el.animate({ opacity: [0, 0] }, hideMs);
        continue;
      }
      const offset = flipOffset(prev.at.get(id), at.get(id) as Point);
      if (!offset) continue;
      const r = el.getBoundingClientRect();
      if (offset === "new") {
        if (onScreen(r)) el.animate({ opacity: [0, 1] }, { duration: MOVE_MS, easing: MOVE_EASING });
        continue;
      }
      const { x, y } = offset;
      const was = { left: r.left + x, right: r.right + x, top: r.top + y, bottom: r.bottom + y };
      // A column can hold far more cards than fit on screen, and nobody sees those move.
      if (!onScreen(r) && !onScreen(was)) continue;
      el.animate(
        // Above its neighbours while it passes over them.
        { transform: [`translate(${x}px, ${y}px)`, "none"], zIndex: [10, 10] },
        { duration: MOVE_MS, easing: MOVE_EASING },
      );
    }
  });

  return container;
}
