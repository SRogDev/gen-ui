"use client";

import { useCallback, useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { GenUIComponent } from "@/lib/genui/schemas";
import {
  chartClickToSelection,
  pieDatumToSelection,
} from "@/lib/genui/selection";
import { usePrefersReducedMotion } from "@/lib/genui/use-reduced-motion";
import { cn } from "@/lib/utils";
import { useGenUIInteraction } from "./interaction-context";

type LineChartProps = Extract<GenUIComponent, { component: "LineChart" }>;
type BarChartProps = Extract<GenUIComponent, { component: "BarChart" }>;
type AreaChartProps = Extract<GenUIComponent, { component: "AreaChart" }>;
type PieChartProps = Extract<GenUIComponent, { component: "PieChart" }>;

type Series = { name: string; points: { x: string; y: number }[] };

/** Multi-series palette: Ember first, then semantic + neutral (dark-only). */
const SERIES_PALETTE = [
  "#F97316", // ember-core
  "#FDBA74", // ember-glow
  "#3B82F6", // info
  "#10B981", // success
  "#F59E0B", // warning
  "#94A3B8", // text-secondary
];

const AXIS_TICK = { fill: "#64748B", fontSize: 11 };
const CHART_HEIGHT = 260;

/**
 * Pivot backend series ({name, points:[{x,y}]}) into Recharts rows:
 * [{x, seriesA: y, seriesB: y}] — union of x values in first-seen order.
 */
function pivotSeries(
  series: Series[],
): Record<string, string | number | null>[] {
  const order: string[] = [];
  const seen = new Set<string>();
  for (const s of series) {
    for (const p of s.points) {
      if (!seen.has(p.x)) {
        seen.add(p.x);
        order.push(p.x);
      }
    }
  }
  return order.map((x) => {
    const row: Record<string, string | number | null> = { x };
    for (const s of series) {
      row[s.name] = s.points.find((p) => p.x === x)?.y ?? null;
    }
    return row;
  });
}

function ChartShell({
  title,
  xLabel,
  yLabel,
  children,
}: {
  title: string;
  xLabel?: string;
  yLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <figure
      role="img"
      aria-label={title}
      className="rounded-xl border border-white/[0.08] bg-depth p-4 shadow-[0_1px_3px_rgba(0,0,0,0.3)]"
    >
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      {(xLabel || yLabel) && (
        <p className="mt-0.5 text-xs text-text-tertiary">
          {[xLabel, yLabel].filter(Boolean).join(" · ")}
        </p>
      )}
      <div className="mt-3">{children}</div>
    </figure>
  );
}

// biome-ignore lint/suspicious/noExplicitAny: Recharts tooltip payload is untyped
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-white/10 bg-depth px-3 py-2 shadow-[0_8px_16px_rgba(0,0,0,0.4)]">
      {label != null && (
        <p className="mb-1 text-xs font-medium text-text-tertiary">{label}</p>
      )}
      <ul className="space-y-0.5">
        {/* biome-ignore lint/suspicious/noExplicitAny: Recharts payload entries are untyped */}
        {payload.map((entry: any) => (
          <li
            key={String(entry.name)}
            className="flex items-center gap-2 text-xs"
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{
                background: entry.color ?? entry.payload?.fill ?? "#94A3B8",
              }}
              aria-hidden
            />
            <span className="text-text-secondary">{entry.name}:</span>
            <span className="font-mono text-text-primary">{entry.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** HTML legend below the chart (kept out of the SVG for styling control). */
function SeriesLegend({ series }: { series: Series[] }) {
  if (series.length < 2) return null;
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1" aria-hidden>
      {series.map((s, i) => (
        <li
          key={s.name}
          className="flex items-center gap-1.5 text-xs text-text-tertiary"
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: SERIES_PALETTE[i % SERIES_PALETTE.length] }}
          />
          {s.name}
        </li>
      ))}
    </ul>
  );
}

type CartesianChartKind = "LineChart" | "BarChart" | "AreaChart";

/**
 * U5: chart-click → conversational context (GenUI plan §15).
 *
 * Clicking a data point captures structured context (metric, period, value,
 * chart identity) and prepends it to the Mind composer draft — the user asks
 * their follow-up without restating the data. Clicks on empty chart areas
 * carry no active data and are no-ops by construction.
 */
function useCartesianChartClick(
  chartKind: CartesianChartKind,
  title: string,
  series: Series[],
  rows: Record<string, string | number | null>[],
) {
  const { selectForConversation } = useGenUIInteraction();
  return useCallback(
    (clickState: { activeTooltipIndex?: unknown; activeLabel?: unknown }) => {
      const selection = chartClickToSelection({
        chartKind,
        chartTitle: title,
        seriesNames: series.map((s) => s.name),
        rows,
        clickState,
      });
      if (selection) selectForConversation(selection);
    },
    [chartKind, title, series, rows, selectForConversation],
  );
}

function usePieClick(title: string) {
  const { selectForConversation } = useGenUIInteraction();
  return useCallback(
    (datum: unknown) => {
      const selection = pieDatumToSelection(title, datum);
      if (selection) selectForConversation(selection);
    },
    [title, selectForConversation],
  );
}

export function GenUILineChart({
  title,
  x_label,
  y_label,
  series,
}: LineChartProps) {
  const reducedMotion = usePrefersReducedMotion();
  const data = useMemo(() => pivotSeries(series), [series]);
  const handleClick = useCartesianChartClick("LineChart", title, series, data);
  return (
    <ChartShell title={title} xLabel={x_label} yLabel={y_label}>
      <ResponsiveContainer
        width="100%"
        height={CHART_HEIGHT}
        className="cursor-pointer"
      >
        <LineChart data={data} accessibilityLayer onClick={handleClick}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="x"
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            tickMargin={8}
          />
          <YAxis
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ stroke: "rgba(255,255,255,0.15)" }}
          />
          {series.map((s, i) => (
            <Line
              key={s.name}
              type="monotone"
              dataKey={s.name}
              name={s.name}
              stroke={SERIES_PALETTE[i % SERIES_PALETTE.length]}
              strokeWidth={2}
              dot={false}
              connectNulls
              isAnimationActive={!reducedMotion}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      <SeriesLegend series={series} />
    </ChartShell>
  );
}

export function GenUIBarChart({
  title,
  x_label,
  y_label,
  series,
}: BarChartProps) {
  const reducedMotion = usePrefersReducedMotion();
  const data = useMemo(() => pivotSeries(series), [series]);
  const handleClick = useCartesianChartClick("BarChart", title, series, data);
  return (
    <ChartShell title={title} xLabel={x_label} yLabel={y_label}>
      <ResponsiveContainer
        width="100%"
        height={CHART_HEIGHT}
        className="cursor-pointer"
      >
        <BarChart
          data={data}
          accessibilityLayer
          barCategoryGap="28%"
          onClick={handleClick}
        >
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="x"
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            tickMargin={8}
          />
          <YAxis
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
          />
          {series.map((s, i) => (
            <Bar
              key={s.name}
              dataKey={s.name}
              name={s.name}
              fill={SERIES_PALETTE[i % SERIES_PALETTE.length]}
              radius={[4, 4, 0, 0]}
              isAnimationActive={!reducedMotion}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
      <SeriesLegend series={series} />
    </ChartShell>
  );
}

export function GenUIAreaChart({
  title,
  x_label,
  y_label,
  series,
}: AreaChartProps) {
  const reducedMotion = usePrefersReducedMotion();
  const data = useMemo(() => pivotSeries(series), [series]);
  const handleClick = useCartesianChartClick("AreaChart", title, series, data);
  return (
    <ChartShell title={title} xLabel={x_label} yLabel={y_label}>
      <ResponsiveContainer
        width="100%"
        height={CHART_HEIGHT}
        className="cursor-pointer"
      >
        <AreaChart data={data} accessibilityLayer onClick={handleClick}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="x"
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            tickMargin={8}
          />
          <YAxis
            tick={AXIS_TICK}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip
            content={<ChartTooltip />}
            cursor={{ stroke: "rgba(255,255,255,0.15)" }}
          />
          {series.map((s, i) => {
            const color = SERIES_PALETTE[i % SERIES_PALETTE.length];
            return (
              <Area
                key={s.name}
                type="monotone"
                dataKey={s.name}
                name={s.name}
                stroke={color}
                strokeWidth={2}
                fill={color}
                fillOpacity={0.22}
                connectNulls
                isAnimationActive={!reducedMotion}
              />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>
      <SeriesLegend series={series} />
    </ChartShell>
  );
}

export function GenUIPieChart({ title, slices }: PieChartProps) {
  const reducedMotion = usePrefersReducedMotion();
  const data = useMemo(
    () => slices.map((s) => ({ name: s.label, value: s.value })),
    [slices],
  );
  const handleSectorClick = usePieClick(title);
  return (
    <ChartShell title={title}>
      <ResponsiveContainer
        width="100%"
        height={CHART_HEIGHT}
        className="cursor-pointer"
      >
        <PieChart accessibilityLayer>
          <Tooltip content={<ChartTooltip />} />
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={52}
            outerRadius={84}
            paddingAngle={2}
            strokeWidth={0}
            isAnimationActive={!reducedMotion}
            onClick={handleSectorClick}
          >
            {data.map((d, i) => (
              <Cell
                key={d.name}
                fill={SERIES_PALETTE[i % SERIES_PALETTE.length]}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <ul className={cn("mt-2 grid grid-cols-2 gap-x-4 gap-y-1")} aria-hidden>
        {data.map((d, i) => (
          <li
            key={d.name}
            className="flex items-center gap-1.5 text-xs text-text-tertiary"
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: SERIES_PALETTE[i % SERIES_PALETTE.length] }}
            />
            <span className="truncate">{d.name}</span>
            <span className="ml-auto font-mono text-text-secondary">
              {d.value}
            </span>
          </li>
        ))}
      </ul>
    </ChartShell>
  );
}
