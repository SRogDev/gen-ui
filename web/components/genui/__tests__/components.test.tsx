/**
 * Render tests for the 16 U4 GenUI semantic components.
 *
 * Verifies: each component renders its content, uses Polygrow design tokens
 * (never default shadcn styling), meets accessibility basics, and the
 * DataTable supports sort/filter/select.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ActionCard, ConfirmationCard } from "../actions";
import { GoalProgress } from "../bi";
import {
  ComparisonCard,
  InsightCard,
  KPIGroup,
  MetricCard,
  StatGroup,
} from "../cards";
import {
  GenUIAreaChart,
  GenUIBarChart,
  GenUILineChart,
  GenUIPieChart,
} from "../charts";
import { GenUIFilePreview, GenUIImage } from "../content";
import { DataTable, GenUIList } from "../data";

// Recharts needs ResizeObserver; jsdom does not provide it.
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

// jsdom does not implement matchMedia (used by usePrefersReducedMotion).
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

const CHART_SERIES = [
  {
    name: "2026",
    points: [
      { x: "Jan", y: 10000 },
      { x: "Feb", y: 11200 },
      { x: "Mar", y: 9800 },
    ],
  },
  {
    name: "2025",
    points: [
      { x: "Jan", y: 8000 },
      { x: "Feb", y: 9000 },
      { x: "Mar", y: 8500 },
    ],
  },
];

describe("information components", () => {
  it("MetricCard renders value in mono with Polygrow tokens", () => {
    const { container } = render(
      <MetricCard
        component="MetricCard"
        title="MRR"
        value="$12,400"
        delta="+12%"
        delta_direction="up"
        caption="vs last month"
      />,
    );
    expect(screen.getByText("MRR")).toBeInTheDocument();
    const value = screen.getByText("$12,400");
    expect(value).toHaveClass("font-mono");
    expect(value).toHaveClass("text-text-primary");
    expect(container.querySelector(".bg-depth")).toBeInTheDocument();
    expect(screen.getByText("+12%")).toHaveClass("text-success");
    expect(screen.getByText("vs last month")).toBeInTheDocument();
  });

  it("MetricCard shows down delta in error color", () => {
    render(
      <MetricCard
        component="MetricCard"
        title="Churn"
        value="4.1%"
        delta="-0.8%"
        delta_direction="down"
      />,
    );
    expect(screen.getByText("-0.8%")).toHaveClass("text-error");
  });

  it("ComparisonCard renders labeled rows", () => {
    render(
      <ComparisonCard
        component="ComparisonCard"
        title="Q1 vs Q2"
        items={[
          { label: "Q1", value: "$10k" },
          { label: "Q2", value: "$12k", delta: "+20%" },
        ]}
      />,
    );
    expect(screen.getByText("Q1 vs Q2")).toBeInTheDocument();
    expect(screen.getByText("$12k")).toBeInTheDocument();
    expect(screen.getByText("+20%")).toBeInTheDocument();
  });

  it("InsightCard renders severity styling", () => {
    const { rerender } = render(
      <InsightCard
        component="InsightCard"
        title="Churn risk"
        body="Churn rose in SMB."
        severity="warning"
      />,
    );
    expect(screen.getByText("Churn risk")).toBeInTheDocument();
    expect(screen.getByText("Churn rose in SMB.")).toBeInTheDocument();
    rerender(
      <InsightCard
        component="InsightCard"
        title="All good"
        body="Stable."
        severity="success"
      />,
    );
    expect(screen.getByText("All good")).toBeInTheDocument();
  });

  it("StatGroup and KPIGroup render stat grids", () => {
    render(
      <StatGroup
        component="StatGroup"
        title="Funnel"
        stats={[{ label: "Leads", value: "1,204" }]}
      />,
    );
    expect(screen.getByText("Funnel")).toBeInTheDocument();
    expect(screen.getByText("1,204")).toHaveClass("font-mono");

    render(
      <KPIGroup
        component="KPIGroup"
        kpis={[
          { label: "NRR", value: "112%", delta: "+2%", delta_direction: "up" },
        ]}
      />,
    );
    expect(screen.getByText("NRR")).toBeInTheDocument();
    expect(screen.getByText("+2%")).toHaveClass("text-success");
  });
});

describe("chart components", () => {
  it("LineChart renders title, axes and legend", () => {
    render(
      <GenUILineChart
        component="LineChart"
        title="Revenue trend"
        x_label="Month"
        y_label="USD"
        series={CHART_SERIES}
      />,
    );
    expect(screen.getByText("Revenue trend")).toBeInTheDocument();
    expect(screen.getByText("2026")).toBeInTheDocument();
    expect(screen.getByText("2025")).toBeInTheDocument();
    // Polygrow surface, not default shadcn
    expect(document.querySelector(".bg-depth")).toBeInTheDocument();
  });

  it("BarChart, AreaChart, PieChart render", () => {
    const { unmount } = render(
      <GenUIBarChart
        component="BarChart"
        title="Signups"
        series={[CHART_SERIES[0]]}
      />,
    );
    expect(screen.getByText("Signups")).toBeInTheDocument();
    unmount();

    const { unmount: u2 } = render(
      <GenUIAreaChart
        component="AreaChart"
        title="Growth"
        series={[CHART_SERIES[0]]}
      />,
    );
    expect(screen.getByText("Growth")).toBeInTheDocument();
    u2();

    render(
      <GenUIPieChart
        component="PieChart"
        title="Share"
        slices={[
          { label: "Direct", value: 60 },
          { label: "Referral", value: 40 },
        ]}
      />,
    );
    expect(screen.getByText("Share")).toBeInTheDocument();
    expect(screen.getByText("Direct")).toBeInTheDocument();
    expect(screen.getByText("Referral")).toBeInTheDocument();
  });

  it("charts expose an accessible name", () => {
    render(
      <GenUILineChart
        component="LineChart"
        title="Revenue trend"
        series={[CHART_SERIES[0]]}
      />,
    );
    expect(
      screen.getByRole("img", { name: "Revenue trend" }),
    ).toBeInTheDocument();
  });
});

describe("data components", () => {
  const columns = [
    { key: "name", label: "Name", numeric: false },
    { key: "mrr", label: "MRR", numeric: true },
  ];
  const rows = [
    { name: "Acme", mrr: 1200 },
    { name: "Globex", mrr: 800 },
    { name: "Initech", mrr: 2500 },
  ];

  function renderTable() {
    return render(
      <DataTable
        component="DataTable"
        title="Customers"
        columns={columns}
        rows={rows}
      />,
    );
  }

  it("DataTable renders rows and columns", () => {
    renderTable();
    expect(screen.getByText("Customers")).toBeInTheDocument();
    expect(screen.getByText("Acme")).toBeInTheDocument();
    // numeric formatting + mono
    expect(screen.getByText("1,200")).toHaveClass("font-mono");
  });

  it("DataTable sorts by column on header click", () => {
    renderTable();
    const nameHeader = screen.getByRole("button", {
      name: /ordenar por name/i,
    });
    fireEvent.click(nameHeader); // asc
    let cells = screen.getAllByRole("cell");
    // first data cell of first row (after checkbox cell)
    expect(cells[1]).toHaveTextContent("Acme");
    fireEvent.click(nameHeader); // desc
    cells = screen.getAllByRole("cell");
    expect(cells[1]).toHaveTextContent("Initech");
  });

  it("DataTable filters rows", () => {
    renderTable();
    fireEvent.change(screen.getByLabelText("Filtrar filas"), {
      target: { value: "globex" },
    });
    expect(screen.getByText("Globex")).toBeInTheDocument();
    expect(screen.queryByText("Acme")).not.toBeInTheDocument();
  });

  it("DataTable selects rows", () => {
    renderTable();
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[1]); // first data row
    expect(screen.getByText(/1 seleccionada/)).toBeInTheDocument();
  });

  it("List renders items with values", () => {
    render(
      <GenUIList
        component="List"
        title="Todos"
        items={[
          { title: "Ship v2", subtitle: "Friday", value: "P0" },
          { title: "Blog post" },
        ]}
      />,
    );
    expect(screen.getByText("Todos")).toBeInTheDocument();
    expect(screen.getByText("Ship v2")).toBeInTheDocument();
    expect(screen.getByText("P0")).toHaveClass("font-mono");
  });
});

describe("BI components", () => {
  it("GoalProgress renders percentage and accessible progressbar", () => {
    render(
      <GoalProgress
        component="GoalProgress"
        title="ARR goal"
        current={750000}
        target={1000000}
        unit="USD"
      />,
    );
    expect(screen.getByText("ARR goal")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    const bar = screen.getByRole("progressbar", { name: "ARR goal" });
    expect(bar).toHaveAttribute("aria-valuenow", "75");
    expect(screen.getByText("750,000 USD")).toBeInTheDocument();
  });
});

describe("action components", () => {
  it("ActionCard renders enabled buttons (U5 dispatches on click)", () => {
    render(
      <ActionCard
        component="ActionCard"
        title="Next step"
        description="Approve the launch."
        actions={[
          {
            kind: "continue_conversation",
            label: "Explain",
            payload: { message: "Explain" },
          },
        ]}
      />,
    );
    expect(screen.getByText("Next step")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Explain" });
    expect(button).not.toBeDisabled();
    // No-op interaction context outside a provider: clicking is safe.
    fireEvent.click(button);
  });

  it("ConfirmationCard renders question with enabled confirm/deny", () => {
    render(
      <ConfirmationCard
        component="ConfirmationCard"
        title="Confirm charge"
        question="Charge the customer $49?"
        confirm_label="Charge"
        deny_label="Cancel"
        action={{
          kind: "request_approval",
          label: "Charge",
          payload: { summary: "Charge $49" },
        }}
      />,
    );
    expect(screen.getByText("Charge the customer $49?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Charge" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).not.toBeDisabled();
  });
});

describe("content components", () => {
  it("GenUIImage renders img with alt and caption", () => {
    render(
      <GenUIImage
        component="Image"
        url="https://example.com/chart.png"
        alt="Revenue chart"
        caption="Q3 revenue"
      />,
    );
    const img = screen.getByAltText("Revenue chart");
    expect(img).toHaveAttribute("src", "https://example.com/chart.png");
    expect(screen.getByText("Q3 revenue")).toBeInTheDocument();
  });

  it("GenUIImage falls back gracefully on load error", () => {
    render(
      <GenUIImage
        component="Image"
        url="https://example.com/broken.png"
        alt="Broken"
      />,
    );
    fireEvent.error(screen.getByAltText("Broken"));
    expect(screen.getByText(/no se pudo cargar/i)).toBeInTheDocument();
  });

  it("GenUIFilePreview renders file metadata", () => {
    const { container } = render(
      <GenUIFilePreview
        component="FilePreview"
        file={{
          file_id: "file_123",
          filename: "contract.pdf",
          media_type: "application/pdf",
          size_bytes: 204800,
        }}
      />,
    );
    expect(screen.getByText("contract.pdf")).toBeInTheDocument();
    expect(screen.getByText(/application\/pdf/)).toBeInTheDocument();
    expect(screen.getByText(/200.0 KB/)).toBeInTheDocument();
    expect(container.querySelector(".bg-depth")).toBeInTheDocument();
  });
});

describe("end-to-end: backend-shaped spec through Zod → registry → render", () => {
  it("renders a U3-conformant multi-component spec", async () => {
    const { parseGenUISpec } = await import("@/lib/genui/schemas");
    const { PolygrowGenUIRenderer } = await import("../registry");

    // Shape mirrors what U3's decide_genui_spec emits (Pydantic-validated).
    const wireSpec = {
      version: "1",
      layout: "grid-2",
      source: "stripe-tool",
      components: [
        {
          component: "MetricCard",
          title: "MRR",
          value: "$48,200",
          delta: "+8.2%",
          delta_direction: "up",
          caption: "vs last month",
        },
        {
          component: "LineChart",
          title: "MRR trend",
          x_label: "Month",
          y_label: "USD",
          series: [
            {
              name: "MRR",
              points: [
                { x: "Jul", y: 41200 },
                { x: "Aug", y: 44500 },
                { x: "Sep", y: 48200 },
              ],
            },
          ],
        },
        {
          component: "GoalProgress",
          title: "Q4 ARR target",
          current: 578400,
          target: 800000,
          unit: "USD",
        },
        {
          component: "InsightCard",
          title: "Takeaway",
          body: "Growth is accelerating in the mid-market segment.",
          severity: "success",
        },
      ],
    };

    // 1. Zod boundary accepts the backend-shaped spec.
    const parsed = parseGenUISpec(wireSpec);
    expect(parsed).not.toBeNull();
    expect(parsed?.components).toHaveLength(4);

    // 2. Registry renders it inside the chat message area.
    const { container } = render(
      <div className="min-w-0 flex-1">
        <PolygrowGenUIRenderer name="polygrow-genui" data={wireSpec} />
      </div>,
    );
    expect(within(container).getByText("$48,200")).toBeInTheDocument();
    expect(within(container).getByText("MRR trend")).toBeInTheDocument();
    expect(within(container).getByText("Q4 ARR target")).toBeInTheDocument();
    expect(
      within(container).getByText(/accelerating in the mid-market/),
    ).toBeInTheDocument();
    // grid-2 layout applied
    expect(container.querySelector(".sm\\:grid-cols-2")).toBeInTheDocument();
  });
});
