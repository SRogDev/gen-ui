import {
  chartClickToSelection,
  formatSelectionMessage,
  GENUI_CONTEXT_MARKER,
  MAX_TABLE_CONTEXT_ROWS,
  pieDatumToSelection,
  tableRowsToSelection,
} from "@/lib/genui/selection";

const ROWS = [
  { x: "Jan", Revenue: 10000, Cost: 4000 },
  { x: "Feb", Revenue: 12000, Cost: 5000 },
  { x: "Mar", Revenue: 13200, Cost: 5100 },
];

describe("chartClickToSelection", () => {
  const base = {
    chartKind: "LineChart" as const,
    chartTitle: "Monthly revenue",
    seriesNames: ["Revenue", "Cost"],
    rows: ROWS,
  };

  test("captures metric, period and value from a valid click", () => {
    const sel = chartClickToSelection({
      ...base,
      clickState: { activeTooltipIndex: 2, activeLabel: "Mar" },
    });
    expect(sel).not.toBeNull();
    expect(sel?.type).toBe("chart-point");
    expect(sel?.chartTitle).toBe("Monthly revenue");
    expect(sel?.points).toEqual([
      { metric: "Revenue", period: "Mar", value: 13200 },
      { metric: "Cost", period: "Mar", value: 5100 },
    ]);
  });

  test("falls back to the row x when the label is missing", () => {
    const sel = chartClickToSelection({
      ...base,
      clickState: { activeTooltipIndex: 0 },
    });
    expect(sel?.points[0]).toMatchObject({ metric: "Revenue", period: "Jan" });
  });

  test("returns null when the click has no active data (empty chart area)", () => {
    expect(chartClickToSelection({ ...base, clickState: {} })).toBeNull();
    expect(
      chartClickToSelection({ ...base, clickState: undefined }),
    ).toBeNull();
    expect(chartClickToSelection({ ...base, clickState: null })).toBeNull();
  });

  test("returns null for out-of-range indices", () => {
    expect(
      chartClickToSelection({
        ...base,
        clickState: { activeTooltipIndex: 99, activeLabel: "X" },
      }),
    ).toBeNull();
    expect(
      chartClickToSelection({
        ...base,
        clickState: { activeTooltipIndex: -1 },
      }),
    ).toBeNull();
  });

  test("skips null values instead of emitting empty points", () => {
    const sel = chartClickToSelection({
      ...base,
      rows: [{ x: "Apr", Revenue: null, Cost: 100 }],
      clickState: { activeTooltipIndex: 0, activeLabel: "Apr" },
    });
    expect(sel?.points).toEqual([
      { metric: "Cost", period: "Apr", value: 100 },
    ]);
  });

  test("returns null when every series value is null", () => {
    const sel = chartClickToSelection({
      ...base,
      rows: [{ x: "Apr", Revenue: null, Cost: null }],
      clickState: { activeTooltipIndex: 0, activeLabel: "Apr" },
    });
    expect(sel).toBeNull();
  });
});

describe("pieDatumToSelection", () => {
  test("captures slice label and value", () => {
    const sel = pieDatumToSelection("Traffic", { name: "Organic", value: 42 });
    expect(sel).toEqual({
      type: "chart-point",
      chartKind: "PieChart",
      chartTitle: "Traffic",
      points: [{ metric: "Organic", period: "Organic", value: 42 }],
    });
  });

  test("reads from the nested payload shape defensively", () => {
    const sel = pieDatumToSelection("Traffic", {
      payload: { name: "Paid", value: 10 },
    });
    expect(sel?.points[0]).toMatchObject({ metric: "Paid", value: 10 });
  });

  test("returns null for malformed datums", () => {
    expect(pieDatumToSelection("T", null)).toBeNull();
    expect(pieDatumToSelection("T", { name: "X" })).toBeNull();
    expect(pieDatumToSelection("T", { value: 1 })).toBeNull();
    expect(pieDatumToSelection("T", { name: "", value: 1 })).toBeNull();
  });
});

describe("tableRowsToSelection", () => {
  const rows = [
    { name: "Acme", mrr: 1200 },
    { name: "Beta", mrr: 800 },
    { name: "Gamma", mrr: 300 },
  ];

  test("captures the selected rows with counts", () => {
    const sel = tableRowsToSelection({
      tableTitle: "Top customers",
      rows,
      selectedIndices: new Set([0, 2]),
    });
    expect(sel).toMatchObject({
      type: "table-rows",
      tableTitle: "Top customers",
      selectedCount: 2,
      totalRows: 3,
      rows: [
        { name: "Acme", mrr: 1200 },
        { name: "Gamma", mrr: 300 },
      ],
    });
  });

  test("returns null when nothing is selected", () => {
    expect(
      tableRowsToSelection({
        tableTitle: "T",
        rows,
        selectedIndices: new Set(),
      }),
    ).toBeNull();
  });

  test("ignores out-of-range indices and bounds the embedded rows", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ n: i }));
    const sel = tableRowsToSelection({
      tableTitle: "T",
      rows: many,
      selectedIndices: new Set([0, 1, 2, 3, 4, 5, 6, 99]),
    });
    expect(sel?.selectedCount).toBe(7);
    expect(sel?.rows).toHaveLength(MAX_TABLE_CONTEXT_ROWS);
  });
});

describe("formatSelectionMessage", () => {
  test("chart-point message carries the marker and the data", () => {
    const msg = formatSelectionMessage({
      type: "chart-point",
      chartKind: "LineChart",
      chartTitle: "Monthly revenue",
      points: [{ metric: "Revenue", period: "Mar", value: 13200 }],
    });
    expect(msg.startsWith(GENUI_CONTEXT_MARKER)).toBe(true);
    expect(msg).toContain("Monthly revenue");
    expect(msg).toContain("Revenue");
    expect(msg).toContain("Mar");
    expect(msg).toContain("13,200");
  });

  test("table message notes truncation honestly", () => {
    const msg = formatSelectionMessage({
      type: "table-rows",
      tableTitle: "T",
      selectedCount: 7,
      totalRows: 10,
      rows: Array.from({ length: MAX_TABLE_CONTEXT_ROWS }, (_, i) => ({
        n: i,
      })),
    });
    expect(msg.startsWith(GENUI_CONTEXT_MARKER)).toBe(true);
    expect(msg).toContain("7");
    expect(msg).toContain("más");
  });
});
