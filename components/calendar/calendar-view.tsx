"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { SourceChip, StatusBadge } from "@/components/app/labels";
import { Peek } from "@/components/app/peek";
import { byDay as groupByDay, type GridDay } from "@/lib/calendar";
import { SOURCE_COLORS, SOURCE_LABELS, STATUS_LABELS, type Source, type Status } from "@/lib/constants";
import { formatManila, manilaStartOfDay } from "@/lib/time";
import { cn } from "@/lib/utils";

export type CalItem = {
  id: string;
  title: string;
  day: string; // yyyy-MM-dd the item sits on
  time: string | null; // "9:30 AM"
  source: Source | null;
  status: Status;
  place: string; // "Capitol · Daet"
  people: string; // "P: Rico M. · W: Ana R."
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_CHIPS = 3;

function Details({ item }: { item: CalItem }) {
  return (
    <>
      <span className="block font-semibold">{item.title}</span>
      <span className="block text-muted-foreground">
        {[item.time, item.place].filter(Boolean).join(" · ") || "No time or venue yet"}
      </span>
      <span className="mt-1 flex flex-wrap items-center gap-1">
        <SourceChip source={item.source} short />
        <StatusBadge status={item.status} />
      </span>
      {item.people && <span className="mt-1 block text-muted-foreground">{item.people}</span>}
    </>
  );
}

function Chip({ item, alignRight }: { item: CalItem; alignRight: boolean }) {
  const color = item.source ? SOURCE_COLORS[item.source] : "#a3a3a3";
  return (
    <li>
      {/* Hover, keyboard focus or (on touch) press and hold for details. The same details are in the day list below. */}
      <Peek
        href={`/events/${item.id}`}
        label={item.title}
        side="bottom"
        align={alignRight ? "end" : "start"}
        preview={
          <div className="text-xs">
            <Details item={item} />
          </div>
        }
      >
        <Link
          href={`/events/${item.id}`}
          prefetch={false}
          className="flex items-center gap-1 rounded-[4px] bg-muted/60 px-1 py-0.5 text-xs leading-5 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`${item.title}, ${item.source ? SOURCE_LABELS[item.source] : "no source"}, ${STATUS_LABELS[item.status]}${item.time ? `, ${item.time}` : ""}`}
        >
          <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
          <span className="min-w-0 truncate">
            {item.time && <span className="mr-1 tabular-nums text-muted-foreground">{item.time.replace(/:00 /, " ").replace(" ", "").toLowerCase()}</span>}
            {item.title}
          </span>
        </Link>
      </Peek>
    </li>
  );
}

export function CalendarView({
  weeks,
  items,
  today,
  month,
  emptyLabel,
}: {
  weeks: GridDay[][];
  items: CalItem[];
  today: string;
  month: string;
  emptyLabel: string;
}) {
  const byDay = groupByDay(items, (it) => it.day);
  const initial = today.startsWith(month) ? today : `${month}-01`;
  const [selected, setSelected] = useState(initial);
  const dayItems = byDay.get(selected) ?? [];
  const panel = useRef<HTMLElement>(null);

  // On a phone the list sits below the month, often off screen: bring it into view, or the tap looks like it did nothing.
  function pick(date: string, clicks: number) {
    flushSync(() => setSelected(date));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    panel.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
    // Enter or Space reports 0 clicks. Stacked below the month, that scroll can carry the focused day off screen, so focus follows it.
    if (clicks === 0 && !window.matchMedia("(min-width: 1024px)").matches) panel.current?.focus({ preventScroll: true });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full table-fixed border-collapse">
          <thead>
            <tr>
              {WEEKDAYS.map((d) => (
                <th key={d} scope="col" className="border-b py-2 text-center text-xs font-medium text-muted-foreground">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week[0].date}>
                {week.map((d, col) => {
                  const list = byDay.get(d.date) ?? [];
                  const isToday = d.date === today;
                  const isSelected = d.date === selected;
                  const label = `${formatManila(manilaStartOfDay(d.date), "EEEE, MMMM d")}: ${list.length} ${list.length === 1 ? "item" : "items"}`;
                  return (
                    <td
                      key={d.date}
                      className={cn(
                        "relative h-16 border-b border-r align-top last:border-r-0 md:h-28",
                        !d.inMonth && "bg-muted/30",
                        isSelected && "bg-accent/70",
                      )}
                    >
                      <div className="flex h-full flex-col gap-1 p-1">
                        <button
                          type="button"
                          onClick={(e) => pick(d.date, e.detail)}
                          aria-label={label}
                          aria-pressed={isSelected}
                          // The ::after stretches the tap target over the whole cell.
                          className={cn(
                            "flex items-center gap-1 self-start rounded-md px-1 text-xs tabular-nums after:absolute after:inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            !d.inMonth && "text-muted-foreground",
                          )}
                        >
                          <span
                            className={cn(
                              "inline-flex size-6 items-center justify-center rounded-full",
                              isToday && "bg-primary font-semibold text-primary-foreground",
                            )}
                          >
                            {Number(d.date.slice(8))}
                          </span>
                        </button>

                        {/* Phones: dots and a count; tap the day to list its events below. */}
                        {list.length > 0 && (
                          <div aria-hidden className="flex flex-1 flex-wrap content-start items-center gap-0.5 px-1 md:hidden">
                            {list.slice(0, 4).map((it) => (
                              <span key={it.id} className="size-2 rounded-full" style={{ backgroundColor: it.source ? SOURCE_COLORS[it.source] : "#a3a3a3" }} />
                            ))}
                            {list.length > 4 && <span className="text-[10px] text-muted-foreground">+{list.length - 4}</span>}
                          </div>
                        )}

                        {/* Larger screens: chips with hover details; click opens the event. */}
                        {list.length > 0 && (
                          <ul className="relative z-10 hidden min-w-0 flex-col gap-0.5 md:flex">
                            {list.slice(0, MAX_CHIPS).map((it) => (
                              <Chip key={it.id} item={it} alignRight={col >= 4} />
                            ))}
                            {list.length > MAX_CHIPS && (
                              <li>
                                <button
                                  type="button"
                                  onClick={(e) => pick(d.date, e.detail)}
                                  className="rounded-sm px-1 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                  +{list.length - MAX_CHIPS} more
                                </button>
                              </li>
                            )}
                          </ul>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section
        ref={panel}
        tabIndex={-1}
        aria-live="polite"
        aria-labelledby="day-h"
        className="scroll-mt-20 scroll-mb-[calc(3.25rem+env(safe-area-inset-bottom)+1rem)] rounded-xl border bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:scroll-mb-4"
      >
        <h2 id="day-h" className="border-b px-4 py-3 text-sm font-semibold">
          {formatManila(manilaStartOfDay(selected), "EEEE, MMMM d")}
          <span className="ml-1 font-normal text-muted-foreground">· {dayItems.length}</span>
        </h2>
        {dayItems.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <ul className="divide-y">
            {dayItems.map((it) => (
              <li key={it.id}>
                <Link
                  href={`/events/${it.id}`}
                  prefetch={false}
                  className="block px-4 py-3 text-sm hover:bg-accent/60 focus-visible:bg-accent focus-visible:outline-none"
                >
                  <Details item={it} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
