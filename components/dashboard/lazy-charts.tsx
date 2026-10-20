"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { BarDatum, DonutDatum } from "./charts";

// Recharts is the heaviest client dependency. It loads only when a chart is
// about to scroll into view, so tiles and lists paint first and slow phones
// skip work for charts nobody has scrolled to. Placeholders reserve the exact
// size, so nothing jumps when the charts arrive.

const Donut = dynamic(() => import("./charts").then((m) => m.SourceDonut), {
  ssr: false,
  loading: () => <DonutPlaceholder />,
});

const Bars = dynamic(() => import("./charts").then((m) => m.PersonBars), {
  ssr: false,
  loading: () => <BarsPlaceholder />,
});

function DonutPlaceholder() {
  return <div className="mx-auto size-[200px] animate-pulse rounded-full border-[30px] border-muted" aria-hidden />;
}

function BarsPlaceholder() {
  return <div aria-hidden className="h-full animate-pulse rounded-md bg-muted/60" />;
}

/** True once the element is within 200px of the viewport. */
function useNearViewport<T extends Element>() {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || near) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near]);
  return [ref, near] as const;
}

export function LazySourceDonut(props: { data: DonutDatum[]; total: number }) {
  const [ref, near] = useNearViewport<HTMLDivElement>();
  return <div ref={ref}>{near ? <Donut {...props} /> : <DonutPlaceholder />}</div>;
}

export function LazyPersonBars({ data }: { data: BarDatum[] }) {
  const [ref, near] = useNearViewport<HTMLDivElement>();
  return (
    <div ref={ref} style={{ height: data.length * 34 + 8 }}>
      {near ? <Bars data={data} /> : <BarsPlaceholder />}
    </div>
  );
}
