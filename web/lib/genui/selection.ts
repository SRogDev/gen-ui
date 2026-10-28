/**
 * GenUI conversational context (U5).
 *
 * Clicking a meaningful chart element (GenUI plan §15) or selecting table
 * rows captures a small, structured, human-readable context block. The block
 * is prepended to the Mind composer draft (see `interaction.ts`) so the user
 * can ask their follow-up ("Why did revenue fall after this?") without
 * restating the data. Everything here is pure and unit-tested; the runtime
 * wiring lives in `interaction.ts` / `interaction-context.tsx`.
 */

/** Marker prefix identifying GenUI-captured context in the conversation. */
export const GENUI_CONTEXT_MARKER = "[genui-context]";

/** Max table rows embedded in a context block (cost control, plan §25). */
export const MAX_TABLE_CONTEXT_ROWS = 5;

export type GenUIChartPoint = {
  metric: string;
  period: string;
  value: number | string;
};

export type GenUIChartPointSelection = {
  type: "chart-point";
  chartKind: "LineChart" | "BarChart" | "AreaChart" | "PieChart";
  chartTitle: string;
  points: GenUIChartPoint[];
};

export type GenUITableSelection = {
  type: "table-rows";
  tableTitle: string;
  selectedCount: number;
  totalRows: number;
  /** Bounded sample (MAX_TABLE_CONTEXT_ROWS) of the selected rows. */
  rows: Record<string, string | number | boolean | null>[];
};

export type GenUISelection = GenUIChartPointSelection | GenUITableSelection;

type ChartClickState = {
  activeTooltipIndex?: unknown;
  activeLabel?: unknown;
};

/**
 * Convert a Recharts chart-level click state into a structured selection.
 * Returns `null` when the click carries no data (e.g. empty chart area) —
 * clicks must never produce empty or misleading context.
 */
export function chartClickToSelection(args: {
  chartKind: "LineChart" | "BarChart" | "AreaChart";
  chartTitle: string;
  seriesNames: string[];
  rows: Record<string, string | number | null>[];
  clickState: ChartClickState | null | undefined;
}): GenUIChartPointSelection | null {
  const { chartKind, chartTitle, seriesNames, rows, clickState } = args;
  const index = clickState?.activeTooltipIndex;
  if (typeof index !== "number" || index < 0 || index >= rows.length) {
    return null;
  }
  const row = rows[index];
  const period = String(clickState?.activeLabel ?? row.x ?? "");
  const points: GenUIChartPoint[] = [];
  for (const name of seriesNames) {
    const value = row[name];
    if (value === null || value === undefined) continue;
    points.push({ metric: name, period, value });
  }
  if (points.length === 0) return null;
  return { type: "chart-point", chartKind, chartTitle, points };
}

/**
 * Convert a Recharts Pie sector click datum into a structured selection.
 * Reads defensively: sector datums vary across Recharts versions.
 */
export function pieDatumToSelection(
  chartTitle: string,
  datum: unknown,
): GenUIChartPointSelection | null {
  const d = datum as {
    name?: unknown;
    value?: unknown;
    payload?: { name?: unknown; value?: unknown };
  } | null;
  const name = d?.name ?? d?.payload?.name;
  const value = d?.value ?? d?.payload?.value;
  if (typeof name !== "string" || name.length === 0) return null;
  if (typeof value !== "number" && typeof value !== "string") return null;
  return {
    type: "chart-point",
    chartKind: "PieChart",
    chartTitle,
    points: [{ metric: name, period: name, value }],
  };
}

/**
 * Convert selected table rows into a bounded structured selection.
 * Only the first MAX_TABLE_CONTEXT_ROWS rows are embedded; the counts stay
 * truthful so the model never invents the missing rows.
 */
export function tableRowsToSelection(args: {
  tableTitle: string;
  rows: Record<string, string | number | boolean | null>[];
  selectedIndices: ReadonlySet<number>;
}): GenUITableSelection | null {
  const { tableTitle, rows, selectedIndices } = args;
  const selected = [...selectedIndices]
    .filter((i) => i >= 0 && i < rows.length)
    .sort((a, b) => a - b)
    .map((i) => rows[i]);
  if (selected.length === 0) return null;
  return {
    type: "table-rows",
    tableTitle,
    selectedCount: selected.length,
    totalRows: rows.length,
    rows: selected.slice(0, MAX_TABLE_CONTEXT_ROWS),
  };
}

function formatValue(value: number | string): string {
  return typeof value === "number" ? value.toLocaleString("en-US") : value;
}

/**
 * Render a selection as the composer block. Human-readable first (the graph
 * consumes it as a user message), machine-identifiable via the marker
 * (existing message telemetry can attribute it without a new analytics
 * system — GenUI plan §23).
 */
export function formatSelectionMessage(selection: GenUISelection): string {
  if (selection.type === "chart-point") {
    const details =
      selection.chartKind === "PieChart"
        ? selection.points
            .map((p) => `${p.metric} = ${formatValue(p.value)}`)
            .join("; ")
        : selection.points
            .map((p) => `${p.metric} · ${p.period} = ${formatValue(p.value)}`)
            .join("; ");
    return (
      `${GENUI_CONTEXT_MARKER} Del gráfico "${selection.chartTitle}" ` +
      `(${selection.chartKind}): ${details}`
    );
  }
  const shown = selection.rows.map((r) => JSON.stringify(r)).join("; ");
  const hidden = selection.selectedCount - selection.rows.length;
  const more = hidden > 0 ? ` … (+${hidden} más)` : "";
  return (
    `${GENUI_CONTEXT_MARKER} De la tabla "${selection.tableTitle}": ` +
    `${selection.selectedCount} fila(s) seleccionada(s)${more}: ${shown}`
  );
}
