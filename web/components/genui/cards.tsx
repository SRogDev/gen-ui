"use client";

import {
  CircleCheck,
  Info,
  Minus,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import type { GenUIComponent } from "@/lib/genui/schemas";
import { cn } from "@/lib/utils";

type MetricCardProps = Extract<GenUIComponent, { component: "MetricCard" }>;
type ComparisonCardProps = Extract<
  GenUIComponent,
  { component: "ComparisonCard" }
>;
type InsightCardProps = Extract<GenUIComponent, { component: "InsightCard" }>;
type StatGroupProps = Extract<GenUIComponent, { component: "StatGroup" }>;
type KPIGroupProps = Extract<GenUIComponent, { component: "KPIGroup" }>;
type DeltaDirection = "up" | "down" | "flat";

/** Shared card shell: Depth surface, glass border, 12px radius, level-1 shadow. */
function CardShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-white/[0.08] bg-depth p-4 shadow-[0_1px_3px_rgba(0,0,0,0.3)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold text-text-primary">{children}</h3>
  );
}

function CardLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-[0.08em] text-text-tertiary">
      {children}
    </p>
  );
}

function DeltaBadge({
  delta,
  direction,
}: {
  delta?: string;
  direction?: DeltaDirection;
}) {
  if (!direction && !delta) return null;
  const Icon =
    direction === "up"
      ? TrendingUp
      : direction === "down"
        ? TrendingDown
        : Minus;
  const color =
    direction === "up"
      ? "text-success"
      : direction === "down"
        ? "text-error"
        : "text-text-tertiary";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        color,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {delta}
    </span>
  );
}

export function MetricCard({
  title,
  value,
  delta,
  delta_direction,
  caption,
}: MetricCardProps) {
  return (
    <CardShell>
      <CardLabel>{title}</CardLabel>
      <p className="mt-2 font-mono text-3xl font-semibold tracking-tight text-text-primary">
        {value}
      </p>
      <div className="mt-1.5">
        <DeltaBadge delta={delta} direction={delta_direction} />
      </div>
      {caption ? (
        <p className="mt-1 text-xs text-text-tertiary">{caption}</p>
      ) : null}
    </CardShell>
  );
}

export function ComparisonCard({ title, items }: ComparisonCardProps) {
  return (
    <CardShell>
      <CardTitle>{title}</CardTitle>
      <ul className="mt-3 divide-y divide-white/[0.06]">
        {items.map((item) => (
          <li
            key={item.label}
            className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0"
          >
            <span className="text-sm text-text-secondary">{item.label}</span>
            <span className="flex items-center gap-2">
              <span className="font-mono text-sm font-medium text-text-primary">
                {item.value}
              </span>
              <DeltaBadge delta={item.delta} direction={undefined} />
            </span>
          </li>
        ))}
      </ul>
    </CardShell>
  );
}

const SEVERITY_STYLE = {
  info: {
    Icon: Info,
    frame: "border-info/30 bg-info/[0.06]",
    icon: "text-info",
  },
  success: {
    Icon: CircleCheck,
    frame: "border-success/30 bg-success/[0.06]",
    icon: "text-success",
  },
  warning: {
    Icon: TriangleAlert,
    frame: "border-warning/30 bg-warning/[0.06]",
    icon: "text-warning",
  },
} as const;

export function InsightCard({ title, body, severity }: InsightCardProps) {
  const { Icon, frame, icon } = SEVERITY_STYLE[severity];
  return (
    <div className={cn("rounded-xl border p-4", frame)}>
      <div className="flex items-start gap-3">
        <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", icon)} aria-hidden />
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          <p className="mt-1 text-sm leading-relaxed text-text-secondary">
            {body}
          </p>
        </div>
      </div>
    </div>
  );
}

function StatGrid({
  entries,
}: {
  entries: {
    label: string;
    value: string;
    delta?: string;
    direction?: DeltaDirection;
  }[];
}) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
      {entries.map((entry) => (
        <div key={entry.label}>
          <dt className="text-xs text-text-tertiary">{entry.label}</dt>
          <dd className="mt-0.5 font-mono text-xl font-semibold text-text-primary">
            {entry.value}
          </dd>
          <DeltaBadge delta={entry.delta} direction={entry.direction} />
        </div>
      ))}
    </dl>
  );
}

export function StatGroup({ title, stats }: StatGroupProps) {
  return (
    <CardShell>
      {title ? (
        <div className="mb-3">
          <CardTitle>{title}</CardTitle>
        </div>
      ) : null}
      <StatGrid
        entries={stats.map((s) => ({ label: s.label, value: s.value }))}
      />
    </CardShell>
  );
}

export function KPIGroup({ title, kpis }: KPIGroupProps) {
  return (
    <CardShell>
      {title ? (
        <div className="mb-3">
          <CardTitle>{title}</CardTitle>
        </div>
      ) : null}
      <StatGrid
        entries={kpis.map((k) => ({
          label: k.label,
          value: k.value,
          delta: k.delta,
          direction: k.delta_direction,
        }))}
      />
    </CardShell>
  );
}
