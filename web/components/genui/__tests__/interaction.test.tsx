/**
 * U5: GenUI interaction wiring tests (component level).
 *
 * Verifies that clicks on GenUI components route through the interaction
 * API — never direct state mutation — and that chart clicks without active
 * data are safe no-ops. The runtime itself is mocked at the context
 * boundary; `useAui` wiring is covered in `interaction-provider.test.tsx`.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { ActionCard, ConfirmationCard } from "../actions";
import { GenUILineChart } from "../charts";
import { DataTable } from "../data";

const mockSelectForConversation = jest.fn();
const mockDispatchAction = jest.fn();
const mockConfirmAction = jest.fn();
const mockDenyAction = jest.fn();

jest.mock("@/components/genui/interaction-context", () => ({
  useGenUIInteraction: () => ({
    selectForConversation: mockSelectForConversation,
    dispatchAction: mockDispatchAction,
    confirmAction: mockConfirmAction,
    denyAction: mockDenyAction,
  }),
}));

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

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ActionCard dispatch", () => {
  const action = {
    kind: "continue_conversation" as const,
    label: "Analizar",
    payload: { message: "Analiza esto" },
  };

  test("clicking a button dispatches the action (never direct mutation)", () => {
    render(<ActionCard component="ActionCard" title="T" actions={[action]} />);
    fireEvent.click(screen.getByRole("button", { name: "Analizar" }));
    expect(mockDispatchAction).toHaveBeenCalledTimes(1);
    expect(mockDispatchAction).toHaveBeenCalledWith(action);
  });
});

describe("ConfirmationCard dispatch", () => {
  const action = {
    kind: "request_approval" as const,
    label: "Aprobar",
    payload: { summary: "Lanzar campaña" },
  };
  const question = "¿Lanzamos la campaña?";

  function renderCard() {
    render(
      <ConfirmationCard
        component="ConfirmationCard"
        title="Confirmar"
        question={question}
        confirm_label="Sí, lanzar"
        deny_label="No"
        action={action}
      />,
    );
  }

  test("confirm dispatches the wrapped action", () => {
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: "Sí, lanzar" }));
    expect(mockConfirmAction).toHaveBeenCalledTimes(1);
    expect(mockConfirmAction).toHaveBeenCalledWith({ question, action });
  });

  test("deny notifies through the denial path", () => {
    renderCard();
    fireEvent.click(screen.getByRole("button", { name: "No" }));
    expect(mockDenyAction).toHaveBeenCalledTimes(1);
    expect(mockDenyAction).toHaveBeenCalledWith({ question });
  });
});

describe("chart click context", () => {
  test("clicking the chart surface without hover data is a safe no-op", () => {
    // jsdom gives ResponsiveContainer zero width, so the inner SVG chart
    // never mounts — Recharts click dispatch cannot run here. This test
    // pins the honest boundary: a click with no active data point must
    // never throw and never fabricate context. The click-state → selection
    // logic itself is unit-tested in lib/genui/__tests__/selection.test.ts.
    const { container } = render(
      <GenUILineChart
        component="LineChart"
        title="Revenue"
        series={[{ name: "2026", points: [{ x: "Jan", y: 100 }] }]}
      />,
    );
    const surface = container.querySelector(".recharts-responsive-container");
    expect(surface).not.toBeNull();
    fireEvent.click(surface as Element);
    expect(mockSelectForConversation).not.toHaveBeenCalled();
  });
});

describe("DataTable selection context", () => {
  function renderTable() {
    render(
      <DataTable
        component="DataTable"
        title="Customers"
        columns={[{ key: "name", label: "Name", numeric: false }]}
        rows={[{ name: "Acme" }, { name: "Beta" }]}
      />,
    );
  }

  test("selecting rows offers the conversation handoff", () => {
    renderTable();
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[1]); // first data row
    const ask = screen.getByRole("button", {
      name: /Preguntar sobre la selección/,
    });
    fireEvent.click(ask);
    expect(mockSelectForConversation).toHaveBeenCalledTimes(1);
    const selection = mockSelectForConversation.mock.calls[0][0];
    expect(selection.type).toBe("table-rows");
    expect(selection.tableTitle).toBe("Customers");
    expect(selection.rows).toEqual([{ name: "Acme" }]);
    // Captured selections clear: the button disappears after handoff.
    expect(
      screen.queryByRole("button", { name: /Preguntar sobre la selección/ }),
    ).not.toBeInTheDocument();
  });

  test("no handoff button without a selection", () => {
    renderTable();
    expect(
      screen.queryByRole("button", { name: /Preguntar sobre la selección/ }),
    ).not.toBeInTheDocument();
  });
});
