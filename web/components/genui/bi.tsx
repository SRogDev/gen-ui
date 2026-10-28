"use client";

import type { GenUIComponent } from "@/lib/genui/schemas";

type GoalProgressProps = Extract<GenUIComponent, { component: "GoalProgress" }>;

function formatAmount(value: number, unit?: string): string {
  const formatted = value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return unit ? `${formatted} ${unit}` : formatted;
}

export function GoalProgress({
  title,
  current,
  target,
  unit,
}: GoalProgressProps) {
  const pct = Math.min(100, (current / target) * 100);
  return (
    <div className="rounded-xl border border-white/[0.08] bg-depth p-4 shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        <span className="font-mono text-sm font-semibold text-ember">
          {pct.toFixed(0)}%
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={title}
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.08]"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-ember to-ember-deep transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between font-mono text-xs text-text-tertiary">
        <span>{formatAmount(current, unit)}</span>
        <span>meta {formatAmount(target, unit)}</span>
      </div>
    </div>
  );
}
