/**
 * Zod schemas for the GenUI semantic component catalog (U4 frontend half).
 *
 * Mirrors `ai-services/app/genui/schemas.py` EXACTLY: same component names,
 * same prop bounds, same budgets. Zod is the FINAL validation boundary
 * before rendering — a malformed spec must never instantiate arbitrary React.
 *
 * Parity notes vs the backend:
 * - `z.strictObject` everywhere = Pydantic `extra="forbid"`.
 * - URLs use `z.httpUrl()` (http/https only). The backend uses `AnyHttpUrl`
 *   (any scheme); the frontend is intentionally stricter because these URLs
 *   are rendered into `<img src>` / opened on click (GenUI plan §26).
 * - The 64 KiB ceiling is measured on the UTF-8 byte length of the
 *   serialized spec, same as the backend.
 */

import { z } from "zod";

export const GENUI_SPEC_VERSION = "1";

// MVP budgets (GenUI plan §12) — hard rejects, mirroring the backend.
export const MAX_COMPONENTS_PER_MESSAGE = 5;
export const MAX_CHART_POINTS = 60; // points per series
export const MAX_CHART_SERIES = 6;
export const MAX_TABLE_ROWS = 50;
export const MAX_TABLE_COLUMNS = 12;
export const MAX_LIST_ITEMS = 30;
export const MAX_TIMELINE_EVENTS = 30;
export const MAX_ACTION_BUTTONS = 4; // per ActionCard
export const MAX_SPEC_BYTES = 65_536; // serialized JSON ceiling
// The schema is flat by construction (layout + component list): nesting
// depth is 1, inside the §11 ~2-level guard by design.

const DeltaDirectionSchema = z.enum(["up", "down", "flat"]);
const GenUILayoutSchema = z.enum(["stack", "grid-2", "full"]);

// ---------------------------------------------------------------------------
// Information
// ---------------------------------------------------------------------------

const MetricCardSchema = z.strictObject({
  component: z.literal("MetricCard"),
  title: z.string().min(1).max(120),
  value: z.string().min(1).max(60),
  delta: z.string().max(20).optional(),
  delta_direction: DeltaDirectionSchema.optional(),
  caption: z.string().max(200).optional(),
});

const ComparisonItemSchema = z.strictObject({
  label: z.string().min(1).max(80),
  value: z.string().min(1).max(60),
  delta: z.string().max(20).optional(),
});

const ComparisonCardSchema = z.strictObject({
  component: z.literal("ComparisonCard"),
  title: z.string().min(1).max(120),
  items: z.array(ComparisonItemSchema).min(2).max(6),
});

const InsightCardSchema = z.strictObject({
  component: z.literal("InsightCard"),
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(2000),
  severity: z.enum(["info", "success", "warning"]).default("info"),
});

const StatItemSchema = z.strictObject({
  label: z.string().min(1).max(80),
  value: z.string().min(1).max(60),
});

const StatGroupSchema = z.strictObject({
  component: z.literal("StatGroup"),
  title: z.string().max(120).optional(),
  stats: z.array(StatItemSchema).min(1).max(8),
});

// ---------------------------------------------------------------------------
// Visualization
// ---------------------------------------------------------------------------

const ChartPointSchema = z.strictObject({
  x: z.string().min(1).max(40),
  y: z.number(),
});

const ChartSeriesSchema = z.strictObject({
  name: z.string().min(1).max(60),
  points: z.array(ChartPointSchema).min(1).max(MAX_CHART_POINTS),
});

const CartesianChartBase = {
  title: z.string().min(1).max(120),
  x_label: z.string().max(60).optional(),
  y_label: z.string().max(60).optional(),
  series: z.array(ChartSeriesSchema).min(1).max(MAX_CHART_SERIES),
};

const LineChartSchema = z.strictObject({
  component: z.literal("LineChart"),
  ...CartesianChartBase,
});

const BarChartSchema = z.strictObject({
  component: z.literal("BarChart"),
  ...CartesianChartBase,
});

const AreaChartSchema = z.strictObject({
  component: z.literal("AreaChart"),
  ...CartesianChartBase,
});

const PieSliceSchema = z.strictObject({
  label: z.string().min(1).max(60),
  value: z.number().min(0),
});

const PieChartSchema = z.strictObject({
  component: z.literal("PieChart"),
  title: z.string().min(1).max(120),
  slices: z.array(PieSliceSchema).min(2).max(12),
});

// Schema-allowed for later phases (backend parity); U4 renders the MVP subset.
const ScatterPointSchema = z.strictObject({
  x: z.number(),
  y: z.number(),
  label: z.string().max(60).optional(),
});

const ScatterChartSchema = z.strictObject({
  component: z.literal("ScatterChart"),
  title: z.string().min(1).max(120),
  points: z.array(ScatterPointSchema).min(1).max(200),
});

const FunnelStageSchema = z.strictObject({
  label: z.string().min(1).max(60),
  value: z.number().min(0),
});

const FunnelChartSchema = z.strictObject({
  component: z.literal("FunnelChart"),
  title: z.string().min(1).max(120),
  stages: z.array(FunnelStageSchema).min(2).max(10),
});

const RadarSeriesSchema = z.strictObject({
  name: z.string().min(1).max(60),
  values: z.array(z.number()).min(3).max(8),
});

const RadarChartSchema = z
  .strictObject({
    component: z.literal("RadarChart"),
    title: z.string().min(1).max(120),
    axes: z.array(z.string()).min(3).max(8),
    series: z.array(RadarSeriesSchema).min(1).max(MAX_CHART_SERIES),
  })
  .refine(
    (val) => val.series.every((s) => s.values.length === val.axes.length),
    { message: "radar series values must match axes length" },
  );

const HeatmapSchema = z
  .strictObject({
    component: z.literal("Heatmap"),
    title: z.string().min(1).max(120),
    rows: z.array(z.string()).min(1).max(20),
    cols: z.array(z.string()).min(1).max(20),
    values: z.array(z.array(z.number())),
  })
  .refine(
    (val) =>
      val.values.length === val.rows.length &&
      val.values.every((r) => r.length === val.cols.length),
    { message: "heatmap values must be rows x cols" },
  );

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const TableColumnSchema = z.strictObject({
  key: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,63}$/),
  label: z.string().min(1).max(80),
  numeric: z.boolean().default(false),
});

const TableCellSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

const DataTableSchema = z
  .strictObject({
    component: z.literal("DataTable"),
    title: z.string().min(1).max(120),
    columns: z.array(TableColumnSchema).min(1).max(MAX_TABLE_COLUMNS),
    rows: z
      .array(z.record(z.string(), TableCellSchema))
      .min(1)
      .max(MAX_TABLE_ROWS),
  })
  .refine(
    (val) => {
      const keys = new Set(val.columns.map((c) => c.key));
      return val.rows.every((row) =>
        Object.keys(row).every((k) => keys.has(k)),
      );
    },
    { message: "row has keys not in columns" },
  );

const ListItemSchema = z.strictObject({
  title: z.string().min(1).max(120),
  subtitle: z.string().max(200).optional(),
  value: z.string().max(60).optional(),
});

const ListSchema = z.strictObject({
  component: z.literal("List"),
  title: z.string().max(120).optional(),
  items: z.array(ListItemSchema).min(1).max(MAX_LIST_ITEMS),
});

const TimelineEventSchema = z.strictObject({
  timestamp: z.string().min(1).max(40),
  title: z.string().min(1).max(120),
  description: z.string().max(300).optional(),
});

const TimelineSchema = z.strictObject({
  component: z.literal("Timeline"),
  title: z.string().min(1).max(120),
  events: z.array(TimelineEventSchema).min(1).max(MAX_TIMELINE_EVENTS),
});

// ---------------------------------------------------------------------------
// Business intelligence
// ---------------------------------------------------------------------------

const GoalProgressSchema = z.strictObject({
  component: z.literal("GoalProgress"),
  title: z.string().min(1).max(120),
  current: z.number().min(0),
  target: z.number().gt(0),
  unit: z.string().max(20).optional(),
});

const PulseFactorSchema = z.strictObject({
  label: z.string().min(1).max(60),
  value: z.number(),
});

const BusinessPulseSchema = z.strictObject({
  component: z.literal("BusinessPulse"),
  title: z.string().min(1).max(120),
  score: z.number().min(0).max(100),
  summary: z.string().max(500).optional(),
  factors: z.array(PulseFactorSchema).max(8).default([]),
});

const KpiItemSchema = z.strictObject({
  label: z.string().min(1).max(60),
  value: z.string().min(1).max(60),
  delta: z.string().max(20).optional(),
  delta_direction: DeltaDirectionSchema.optional(),
});

const KPIGroupSchema = z.strictObject({
  component: z.literal("KPIGroup"),
  title: z.string().max(120).optional(),
  kpis: z.array(KpiItemSchema).min(1).max(8),
});

// ---------------------------------------------------------------------------
// Actions — never mutate state directly (GenUI plan §17-§18).
// A click becomes a GenUI action event → Polygrow intent → LangGraph →
// Harness → UCE/tool. Dispatch itself is U5.
// ---------------------------------------------------------------------------

const GenUIActionSchema = z
  .strictObject({
    kind: z.enum(["continue_conversation", "request_approval", "open_url"]),
    label: z.string().min(1).max(80),
    payload: z.record(z.string(), z.unknown()).default({}),
  })
  .refine(
    (val) => {
      const payload = val.payload as Record<string, unknown>;
      if (val.kind === "continue_conversation") {
        const message = payload.message;
        return (
          typeof message === "string" &&
          message.trim().length > 0 &&
          message.length <= 2000
        );
      }
      if (val.kind === "open_url") {
        const url = payload.url;
        return typeof url === "string" && z.httpUrl().safeParse(url).success;
      }
      // request_approval
      const summary = payload.summary;
      return (
        typeof summary === "string" &&
        summary.trim().length > 0 &&
        summary.length <= 500
      );
    },
    { message: "action payload does not match its kind" },
  );

const ActionCardSchema = z.strictObject({
  component: z.literal("ActionCard"),
  title: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  actions: z.array(GenUIActionSchema).min(1).max(MAX_ACTION_BUTTONS),
});

const ConfirmationCardSchema = z.strictObject({
  component: z.literal("ConfirmationCard"),
  title: z.string().min(1).max(120),
  question: z.string().min(1).max(500),
  confirm_label: z.string().min(1).max(40).default("Confirm"),
  deny_label: z.string().min(1).max(40).default("Deny"),
  action: GenUIActionSchema,
});

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

const FileRefSchema = z.strictObject({
  file_id: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
  filename: z
    .string()
    .min(1)
    .max(255)
    .refine((v) => !v.includes("/") && !v.includes("\\") && !v.includes(".."), {
      message: "filename must not contain path separators",
    }),
  media_type: z.string().min(1).max(127),
  size_bytes: z.number().int().min(0),
});

const ImageSchema = z.strictObject({
  component: z.literal("Image"),
  url: z.httpUrl(),
  alt: z.string().min(1).max(200),
  caption: z.string().max(300).optional(),
});

const FilePreviewSchema = z.strictObject({
  component: z.literal("FilePreview"),
  file: FileRefSchema,
  title: z.string().max(120).optional(),
});

// ---------------------------------------------------------------------------
// Root spec
// ---------------------------------------------------------------------------

const GenUIComponentSchema = z.discriminatedUnion("component", [
  MetricCardSchema,
  ComparisonCardSchema,
  InsightCardSchema,
  StatGroupSchema,
  LineChartSchema,
  BarChartSchema,
  AreaChartSchema,
  PieChartSchema,
  ScatterChartSchema,
  FunnelChartSchema,
  RadarChartSchema,
  HeatmapSchema,
  DataTableSchema,
  ListSchema,
  TimelineSchema,
  GoalProgressSchema,
  BusinessPulseSchema,
  KPIGroupSchema,
  ActionCardSchema,
  ConfirmationCardSchema,
  ImageSchema,
  FilePreviewSchema,
]);

export type GenUIComponent = z.infer<typeof GenUIComponentSchema>;
export type GenUIComponentName = GenUIComponent["component"];
export type GenUILayout = z.infer<typeof GenUILayoutSchema>;
export type GenUIAction = z.infer<typeof GenUIActionSchema>;

export const GenUISpecSchema = z
  .strictObject({
    version: z.literal(GENUI_SPEC_VERSION).default(GENUI_SPEC_VERSION),
    layout: GenUILayoutSchema.default("stack"),
    source: z.string().min(1).max(80),
    components: z
      .array(GenUIComponentSchema)
      .min(1)
      .max(MAX_COMPONENTS_PER_MESSAGE),
  })
  .refine(
    (val) =>
      new TextEncoder().encode(JSON.stringify(val)).length <= MAX_SPEC_BYTES,
    { message: `GenUI spec exceeds ${MAX_SPEC_BYTES} bytes` },
  );

export type GenUISpec = z.infer<typeof GenUISpecSchema>;

/**
 * Validate a candidate spec mapping. Returns the parsed spec, or `null`
 * when invalid — the caller must fall back to text, never render partially.
 */
export function parseGenUISpec(data: unknown): GenUISpec | null {
  if (typeof data !== "object" || data === null) return null;
  const result = GenUISpecSchema.safeParse(data);
  return result.success ? result.data : null;
}
