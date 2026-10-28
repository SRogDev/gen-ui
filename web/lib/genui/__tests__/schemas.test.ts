/**
 * RED-first tests for the GenUI Zod schemas.
 *
 * These schemas must mirror `ai-services/app/genui/schemas.py` EXACTLY:
 * same component names, same prop bounds, same budgets. Zod is the final
 * validation boundary before rendering — a malformed spec must never
 * instantiate arbitrary React.
 */
import {
  GENUI_SPEC_VERSION,
  GenUISpecSchema,
  MAX_ACTION_BUTTONS,
  MAX_CHART_POINTS,
  MAX_CHART_SERIES,
  MAX_COMPONENTS_PER_MESSAGE,
  MAX_LIST_ITEMS,
  MAX_SPEC_BYTES,
  MAX_TABLE_COLUMNS,
  MAX_TABLE_ROWS,
} from "../schemas";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function metricCard(overrides: Record<string, unknown> = {}) {
  return {
    component: "MetricCard",
    title: "MRR",
    value: "$12,400",
    delta: "+12%",
    delta_direction: "up",
    caption: "vs last month",
    ...overrides,
  };
}

function lineChart(overrides: Record<string, unknown> = {}) {
  return {
    component: "LineChart",
    title: "Revenue",
    series: [
      {
        name: "2026",
        points: [
          { x: "Jan", y: 10000 },
          { x: "Feb", y: 11200 },
        ],
      },
    ],
    ...overrides,
  };
}

function dataTable(overrides: Record<string, unknown> = {}) {
  return {
    component: "DataTable",
    title: "Customers",
    columns: [
      { key: "name", label: "Name" },
      { key: "mrr", label: "MRR", numeric: true },
    ],
    rows: [
      { name: "Acme", mrr: 1200 },
      { name: "Globex", mrr: 800 },
    ],
    ...overrides,
  };
}

function validSpec(overrides: Record<string, unknown> = {}) {
  return {
    version: GENUI_SPEC_VERSION,
    layout: "stack",
    source: "test-tool",
    components: [metricCard()],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Valid specs
// ---------------------------------------------------------------------------

describe("GenUISpecSchema — valid", () => {
  it("accepts a minimal spec and applies defaults", () => {
    const parsed = GenUISpecSchema.parse({
      source: "stripe-tool",
      components: [metricCard()],
    });
    expect(parsed.layout).toBe("stack");
    expect(parsed.version).toBe("1");
    expect(parsed.components).toHaveLength(1);
  });

  it("accepts all three layout values", () => {
    for (const layout of ["stack", "grid-2", "full"] as const) {
      const parsed = GenUISpecSchema.parse(validSpec({ layout }));
      expect(parsed.layout).toBe(layout);
    }
  });

  it("accepts the full U4 priority catalog", () => {
    const components = [
      metricCard(),
      {
        component: "ComparisonCard",
        title: "Q1 vs Q2",
        items: [
          { label: "Q1", value: "$10k" },
          { label: "Q2", value: "$12k", delta: "+20%" },
        ],
      },
      {
        component: "InsightCard",
        title: "Churn risk",
        body: "Churn rose in the SMB segment.",
        severity: "warning",
      },
      {
        component: "StatGroup",
        title: "Funnel",
        stats: [{ label: "Leads", value: "1,204" }],
      },
      lineChart(),
      { ...lineChart(), component: "BarChart" },
      { ...lineChart(), component: "AreaChart" },
      {
        component: "PieChart",
        title: "Share",
        slices: [
          { label: "A", value: 60 },
          { label: "B", value: 40 },
        ],
      },
      dataTable(),
      {
        component: "List",
        items: [{ title: "Ship v2", subtitle: "Friday", value: "P0" }],
      },
      {
        component: "GoalProgress",
        title: "ARR goal",
        current: 750000,
        target: 1000000,
        unit: "USD",
      },
      {
        component: "KPIGroup",
        kpis: [{ label: "NRR", value: "112%", delta_direction: "up" }],
      },
      {
        component: "ActionCard",
        title: "Next step",
        description: "Approve the launch.",
        actions: [
          {
            kind: "continue_conversation",
            label: "Explain",
            payload: { message: "Explain the launch plan" },
          },
        ],
      },
      {
        component: "ConfirmationCard",
        title: "Confirm",
        question: "Charge the customer?",
        action: {
          kind: "request_approval",
          label: "Charge",
          payload: { summary: "Charge $49" },
        },
      },
      {
        component: "Image",
        url: "https://example.com/chart.png",
        alt: "Revenue chart",
      },
      {
        component: "FilePreview",
        file: {
          file_id: "file_123-abc",
          filename: "contract.pdf",
          media_type: "application/pdf",
          size_bytes: 204800,
        },
      },
    ];
    // 16 components exceeds the 5/message budget — validate in chunks of 5.
    for (let i = 0; i < components.length; i += MAX_COMPONENTS_PER_MESSAGE) {
      const chunk = components.slice(i, i + MAX_COMPONENTS_PER_MESSAGE);
      expect(() =>
        GenUISpecSchema.parse(validSpec({ components: chunk })),
      ).not.toThrow();
    }
  });

  it("accepts backend-allowlisted non-priority components (parity)", () => {
    const components = [
      {
        component: "Timeline",
        title: "Launch",
        events: [{ timestamp: "2026-10-01", title: "Ship" }],
      },
      {
        component: "BusinessPulse",
        title: "Health",
        score: 82,
        factors: [{ label: "Revenue", value: 90 }],
      },
      {
        component: "ScatterChart",
        title: "Scatter",
        points: [{ x: 1, y: 2, label: "a" }],
      },
      {
        component: "FunnelChart",
        title: "Funnel",
        stages: [
          { label: "Visit", value: 1000 },
          { label: "Signup", value: 100 },
        ],
      },
      {
        component: "RadarChart",
        title: "Radar",
        axes: ["a", "b", "c"],
        series: [{ name: "s", values: [1, 2, 3] }],
      },
      {
        component: "Heatmap",
        title: "Heat",
        rows: ["r1"],
        cols: ["c1"],
        values: [[5]],
      },
    ];
    for (const component of components) {
      expect(() =>
        GenUISpecSchema.parse(validSpec({ components: [component] })),
      ).not.toThrow();
    }
  });
});

// ---------------------------------------------------------------------------
// Rejections
// ---------------------------------------------------------------------------

describe("GenUISpecSchema — rejections", () => {
  it("rejects an unknown component name", () => {
    const spec = validSpec({
      components: [{ component: "EvilWidget", title: "x" }],
    });
    expect(() => GenUISpecSchema.parse(spec)).toThrow();
  });

  it("rejects unknown props (strict — extra=forbid parity)", () => {
    const spec = validSpec({
      components: [metricCard({ style: "color:red", onClick: "alert(1)" })],
    });
    expect(() => GenUISpecSchema.parse(spec)).toThrow();
  });

  it("rejects a nested component smuggled inside props", () => {
    const spec = validSpec({
      components: [
        metricCard({
          children: [{ component: "MetricCard", title: "x", value: "y" }],
        }),
      ],
    });
    expect(() => GenUISpecSchema.parse(spec)).toThrow();
  });

  it("rejects more than MAX_COMPONENTS_PER_MESSAGE components", () => {
    const spec = validSpec({
      components: Array.from(
        { length: MAX_COMPONENTS_PER_MESSAGE + 1 },
        (_, i) => metricCard({ title: `M${i}` }),
      ),
    });
    expect(() => GenUISpecSchema.parse(spec)).toThrow();
  });

  it("rejects an empty components array and empty source", () => {
    expect(() =>
      GenUISpecSchema.parse(validSpec({ components: [] })),
    ).toThrow();
    expect(() => GenUISpecSchema.parse(validSpec({ source: "" }))).toThrow();
  });

  it("rejects empty/short titles", () => {
    expect(() =>
      GenUISpecSchema.parse(
        validSpec({ components: [metricCard({ title: "" })] }),
      ),
    ).toThrow();
  });

  it("rejects invalid layout values", () => {
    expect(() =>
      GenUISpecSchema.parse(validSpec({ layout: "masonry" })),
    ).toThrow();
  });

  it("rejects over-budget chart points and series", () => {
    const tooManyPoints = {
      ...lineChart(),
      series: [
        {
          name: "s",
          points: Array.from({ length: MAX_CHART_POINTS + 1 }, (_, i) => ({
            x: `p${i}`,
            y: i,
          })),
        },
      ],
    };
    expect(() =>
      GenUISpecSchema.parse(validSpec({ components: [tooManyPoints] })),
    ).toThrow();

    const tooManySeries = {
      ...lineChart(),
      series: Array.from({ length: MAX_CHART_SERIES + 1 }, (_, i) => ({
        name: `s${i}`,
        points: [{ x: "a", y: 1 }],
      })),
    };
    expect(() =>
      GenUISpecSchema.parse(validSpec({ components: [tooManySeries] })),
    ).toThrow();
  });

  it("rejects over-budget tables and rows with unknown keys", () => {
    const tooManyRows = dataTable({
      rows: Array.from({ length: MAX_TABLE_ROWS + 1 }, (_, i) => ({
        name: `n${i}`,
        mrr: i,
      })),
    });
    expect(() =>
      GenUISpecSchema.parse(validSpec({ components: [tooManyRows] })),
    ).toThrow();

    const tooManyCols = dataTable({
      columns: Array.from({ length: MAX_TABLE_COLUMNS + 1 }, (_, i) => ({
        key: `c${i}`,
        label: `C${i}`,
      })),
      rows: [{ c0: "x" }],
    });
    expect(() =>
      GenUISpecSchema.parse(validSpec({ components: [tooManyCols] })),
    ).toThrow();

    const unknownKey = dataTable({ rows: [{ name: "x", hacker: 1 }] });
    expect(() =>
      GenUISpecSchema.parse(validSpec({ components: [unknownKey] })),
    ).toThrow();

    const badKey = dataTable({
      columns: [{ key: "not a key!", label: "Bad" }],
      rows: [],
    });
    expect(() =>
      GenUISpecSchema.parse(validSpec({ components: [badKey] })),
    ).toThrow();
  });

  it("rejects over-budget lists and action buttons", () => {
    const tooManyItems = {
      component: "List",
      items: Array.from({ length: MAX_LIST_ITEMS + 1 }, (_, i) => ({
        title: `t${i}`,
      })),
    };
    expect(() =>
      GenUISpecSchema.parse(validSpec({ components: [tooManyItems] })),
    ).toThrow();

    const tooManyActions = {
      component: "ActionCard",
      title: "t",
      actions: Array.from({ length: MAX_ACTION_BUTTONS + 1 }, (_, i) => ({
        kind: "open_url",
        label: `l${i}`,
        payload: { url: "https://example.com" },
      })),
    };
    expect(() =>
      GenUISpecSchema.parse(validSpec({ components: [tooManyActions] })),
    ).toThrow();
  });

  it("rejects invalid URLs and malformed action payloads", () => {
    const badImage = {
      component: "Image",
      url: "javascript:alert(1)",
      alt: "x",
    };
    expect(() =>
      GenUISpecSchema.parse(validSpec({ components: [badImage] })),
    ).toThrow();

    const badOpenUrl = {
      component: "ActionCard",
      title: "t",
      actions: [
        { kind: "open_url", label: "x", payload: { url: "ftp://example.com" } },
      ],
    };
    expect(() =>
      GenUISpecSchema.parse(validSpec({ components: [badOpenUrl] })),
    ).toThrow();

    const emptyMessage = {
      component: "ActionCard",
      title: "t",
      actions: [
        {
          kind: "continue_conversation",
          label: "x",
          payload: { message: "  " },
        },
      ],
    };
    expect(() =>
      GenUISpecSchema.parse(validSpec({ components: [emptyMessage] })),
    ).toThrow();

    const emptySummary = {
      component: "ConfirmationCard",
      title: "t",
      question: "Sure?",
      action: { kind: "request_approval", label: "x", payload: {} },
    };
    expect(() =>
      GenUISpecSchema.parse(validSpec({ components: [emptySummary] })),
    ).toThrow();
  });

  it("rejects path traversal in filenames", () => {
    const evil = {
      component: "FilePreview",
      file: {
        file_id: "abc",
        filename: "../../etc/passwd",
        media_type: "text/plain",
        size_bytes: 10,
      },
    };
    expect(() =>
      GenUISpecSchema.parse(validSpec({ components: [evil] })),
    ).toThrow();
  });

  it("rejects radar/heatmap dimension mismatches", () => {
    const badRadar = {
      component: "RadarChart",
      title: "r",
      axes: ["a", "b", "c"],
      series: [{ name: "s", values: [1, 2] }],
    };
    expect(() =>
      GenUISpecSchema.parse(validSpec({ components: [badRadar] })),
    ).toThrow();

    const badHeatmap = {
      component: "Heatmap",
      title: "h",
      rows: ["r1", "r2"],
      cols: ["c1"],
      values: [[1]],
    };
    expect(() =>
      GenUISpecSchema.parse(validSpec({ components: [badHeatmap] })),
    ).toThrow();
  });

  it("rejects specs over the 64 KiB serialized ceiling", () => {
    // DataTable cell strings are unbounded per-field; the byte ceiling
    // is what rejects them. 50 rows x 12 cols x 200 chars >> 64 KiB.
    const cols = Array.from({ length: 12 }, (_, i) => ({
      key: `c${i}`,
      label: `C${i}`,
    }));
    const bigCell = "x".repeat(200);
    const rows = Array.from({ length: 50 }, () =>
      Object.fromEntries(cols.map((c) => [c.key, bigCell])),
    );
    const spec = validSpec({
      components: [
        { component: "DataTable", title: "Big", columns: cols, rows },
      ],
    });
    const bytes = new TextEncoder().encode(JSON.stringify(spec)).length;
    expect(bytes).toBeGreaterThan(MAX_SPEC_BYTES);
    expect(() => GenUISpecSchema.parse(spec)).toThrow();
  });

  it("rejects non-object input", () => {
    expect(() => GenUISpecSchema.parse(null)).toThrow();
    expect(() => GenUISpecSchema.parse("nope")).toThrow();
    expect(() => GenUISpecSchema.parse([])).toThrow();
  });
});
