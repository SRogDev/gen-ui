/**
 * RED-first tests for the Polygrow GenUI registry.
 *
 * The registry maps semantic component names → trusted React implementations.
 * The AI can only select registered components; it can never create new ones.
 * Unknown names are rejected with a typed error — the allowlist is the
 * security boundary.
 */
import { render, screen } from "@testing-library/react";
import {
  GENUI_RENDERER_NAME,
  PolygrowGenUIRenderer,
  resolveGenUIComponent,
} from "../registry";

const PRIORITY_COMPONENTS = [
  "MetricCard",
  "ComparisonCard",
  "InsightCard",
  "StatGroup",
  "LineChart",
  "BarChart",
  "PieChart",
  "AreaChart",
  "DataTable",
  "List",
  "GoalProgress",
  "KPIGroup",
  "ActionCard",
  "ConfirmationCard",
  "Image",
  "FilePreview",
] as const;

// Backend-allowlisted but not in the U4 render set: must resolve to the
// deterministic fallback, never to arbitrary React and never throw.
const FALLBACK_COMPONENTS = [
  "ScatterChart",
  "FunnelChart",
  "RadarChart",
  "Heatmap",
  "Timeline",
  "BusinessPulse",
] as const;

function validSpec() {
  return {
    version: "1",
    layout: "stack",
    source: "test-tool",
    components: [
      {
        component: "MetricCard",
        title: "MRR",
        value: "$12,400",
        delta: "+12%",
        delta_direction: "up",
      },
    ],
  };
}

describe("resolveGenUIComponent", () => {
  it("resolves every U4 priority component", () => {
    for (const name of PRIORITY_COMPONENTS) {
      expect(() => resolveGenUIComponent(name)).not.toThrow();
      expect(resolveGenUIComponent(name)).toBeTruthy();
    }
  });

  it("resolves backend-valid non-priority components to the fallback", () => {
    for (const name of FALLBACK_COMPONENTS) {
      const Resolved = resolveGenUIComponent(name);
      const { container } = render(<Resolved component={name} title="T" />);
      // Honest placeholder: names the component, renders no model content.
      // (Spanish-first UI strings per U2 decision.)
      expect(container.textContent).toMatch(/no está disponible/i);
    }
  });

  it("rejects unknown component names with a typed error", () => {
    expect(() => resolveGenUIComponent("EvilWidget")).toThrow(
      /not in the GenUI allowlist/,
    );
    expect(() => resolveGenUIComponent("")).toThrow(
      /not in the GenUI allowlist/,
    );
  });
});

describe("PolygrowGenUIRenderer", () => {
  it("exposes the wire-contract renderer name", () => {
    expect(GENUI_RENDERER_NAME).toBe("polygrow-genui");
  });

  it("renders a valid spec", () => {
    render(<PolygrowGenUIRenderer name="polygrow-genui" data={validSpec()} />);
    expect(screen.getByText("MRR")).toBeInTheDocument();
    expect(screen.getByText("$12,400")).toBeInTheDocument();
  });

  it("renders nothing for malformed specs (never arbitrary React)", () => {
    const { container: c1 } = render(
      <PolygrowGenUIRenderer
        name="polygrow-genui"
        data={{ components: [{ component: "EvilWidget" }] }}
      />,
    );
    expect(c1).toBeEmptyDOMElement();

    const { container: c2 } = render(
      <PolygrowGenUIRenderer name="polygrow-genui" data={null} />,
    );
    expect(c2).toBeEmptyDOMElement();

    const { container: c3 } = render(
      <PolygrowGenUIRenderer name="polygrow-genui" data="nope" />,
    );
    expect(c3).toBeEmptyDOMElement();
  });

  it("applies the stack layout by default", () => {
    const { container } = render(
      <PolygrowGenUIRenderer name="polygrow-genui" data={validSpec()} />,
    );
    expect(container.firstChild).toHaveClass("flex-col");
  });

  it("applies the grid-2 layout", () => {
    const { container } = render(
      <PolygrowGenUIRenderer
        name="polygrow-genui"
        data={{
          ...validSpec(),
          layout: "grid-2",
          components: [
            {
              component: "MetricCard",
              title: "A",
              value: "1",
            },
            {
              component: "MetricCard",
              title: "B",
              value: "2",
            },
          ],
        }}
      />,
    );
    expect(container.firstChild).toHaveClass("grid");
  });

  it("applies the full layout", () => {
    const { container } = render(
      <PolygrowGenUIRenderer
        name="polygrow-genui"
        data={{ ...validSpec(), layout: "full" }}
      />,
    );
    expect(container.firstChild).toHaveClass("w-full");
  });
});
