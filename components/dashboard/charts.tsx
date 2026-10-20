"use client";

import { Bar, BarChart, LabelList, Pie, PieChart, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { BAR_COLOR } from "@/lib/chart-colors";

// Chart specs follow the dataviz rules: thin marks (bars <= 24px, 4px rounded
// data end), 2px surface gaps between donut segments, hover tooltips with the
// value leading, text in ink tokens (never the series colour), and every value
// also available in the table view next to each chart.

const INK = "#171717";
const MUTED = "#737373";
const SURFACE = "#ffffff";

export type DonutDatum = { key: string; label: string; value: number; fill: string };
export type BarDatum = { name: string; value: number; detail?: string };

function TooltipBox({ value, label, detail }: { value: string; label: string; detail?: string }) {
  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-sm shadow-md">
      <div className="font-semibold tabular-nums text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
      {detail && <div className="mt-0.5 text-xs text-muted-foreground">{detail}</div>}
    </div>
  );
}

function DonutTooltip({ active, payload }: TooltipContentProps) {
  const d = active ? (payload?.[0]?.payload as (DonutDatum & { percent: number }) | undefined) : undefined;
  if (!d) return null;
  return <TooltipBox value={`${d.value} post${d.value === 1 ? "" : "s"}`} label={d.label} />;
}

export function SourceDonut({ data, total }: { data: DonutDatum[]; total: number }) {
  const drawn = data.filter((d) => d.value > 0);
  return (
    <div className="relative mx-auto h-[200px] w-[200px]">
      <PieChart responsive style={{ width: "100%", height: "100%" }} accessibilityLayer>
        <Pie
          data={drawn}
          dataKey="value"
          nameKey="label"
          innerRadius={62}
          outerRadius={92}
          paddingAngle={drawn.length > 1 ? 1.5 : 0}
          cornerRadius={4}
          stroke={SURFACE}
          strokeWidth={2}
          startAngle={90}
          endAngle={-270}
          isAnimationActive={false}
        />
        <Tooltip content={DonutTooltip} />
      </PieChart>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-semibold leading-none" style={{ color: INK }}>
          {total}
        </span>
        <span className="mt-1 text-xs" style={{ color: MUTED }}>
          post{total === 1 ? "" : "s"}
        </span>
      </div>
    </div>
  );
}

function BarTooltip({ active, payload }: TooltipContentProps) {
  const d = active ? (payload?.[0]?.payload as BarDatum | undefined) : undefined;
  if (!d) return null;
  return <TooltipBox value={String(d.value)} label={d.name} detail={d.detail} />;
}

const ROW = 34;

/** Horizontal single-series bars, one row per person, value at the tip. */
export function PersonBars({ data }: { data: BarDatum[] }) {
  const height = data.length * ROW + 8;
  const max = Math.max(...data.map((d) => d.value));
  return (
    <div style={{ height }}>
      <BarChart
        responsive
        style={{ width: "100%", height: "100%" }}
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 32, bottom: 4, left: 0 }}
        barCategoryGap={8}
        accessibilityLayer
      >
        <XAxis type="number" hide domain={[0, Math.max(1, max)]} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="name"
          width={84}
          tickLine={false}
          axisLine={{ stroke: "#e5e5e5" }}
          tick={{ fill: INK, fontSize: 12 }}
        />
        <Tooltip content={BarTooltip} cursor={{ fill: "#f5f5f5" }} />
        <Bar dataKey="value" fill={BAR_COLOR} maxBarSize={18} radius={[0, 4, 4, 0]} isAnimationActive={false}>
          <LabelList dataKey="value" position="right" offset={6} style={{ fill: INK, fontSize: 12, fontWeight: 600 }} />
        </Bar>
      </BarChart>
    </div>
  );
}
