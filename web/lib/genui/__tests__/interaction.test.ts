import {
  appendSelectionToComposer,
  confirmGenUIAction,
  denyGenUIAction,
  dispatchGenUIAction,
  GENUI_ACTION_MARKER,
  type GenUIAuiLike,
  resolveActionDispatch,
} from "@/lib/genui/interaction";
import type { GenUIAction } from "@/lib/genui/schemas";
import { GENUI_CONTEXT_MARKER } from "@/lib/genui/selection";

function fakeAui(draft = "") {
  const append = jest.fn();
  const setText = jest.fn();
  const aui: GenUIAuiLike = {
    thread: { append },
    composer: { getState: () => ({ text: draft }), setText },
  };
  return { aui, append, setText };
}

const continueAction: GenUIAction = {
  kind: "continue_conversation",
  label: "Analizar",
  payload: { message: "Analiza estas métricas" },
};
const approvalAction: GenUIAction = {
  kind: "request_approval",
  label: "Aprobar",
  payload: { summary: "Lanzar campaña Q4" },
};
const urlAction: GenUIAction = {
  kind: "open_url",
  label: "Ver reporte",
  payload: { url: "https://example.com/reporte" },
};

describe("resolveActionDispatch", () => {
  test("continue_conversation resolves to the action message", () => {
    expect(resolveActionDispatch(continueAction)).toEqual({
      kind: "send_message",
      text: "Analiza estas métricas",
    });
  });

  test("request_approval resolves to a marked intent message", () => {
    const resolved = resolveActionDispatch(approvalAction);
    expect(resolved.kind).toBe("send_message");
    if (resolved.kind === "send_message") {
      expect(resolved.text.startsWith(GENUI_ACTION_MARKER)).toBe(true);
      expect(resolved.text).toContain("Lanzar campaña Q4");
    }
  });

  test("open_url resolves to the validated URL", () => {
    expect(resolveActionDispatch(urlAction)).toEqual({
      kind: "open_url",
      url: "https://example.com/reporte",
    });
  });
});

describe("dispatchGenUIAction", () => {
  test("sends conversation actions through the runtime thread (never direct mutation)", () => {
    const { aui, append } = fakeAui();
    dispatchGenUIAction(aui, continueAction);
    expect(append).toHaveBeenCalledTimes(1);
    expect(append).toHaveBeenCalledWith("Analiza estas métricas");
  });

  test("request_approval travels as a marked message for the graph's approval flow", () => {
    const { aui, append } = fakeAui();
    dispatchGenUIAction(aui, approvalAction);
    expect(append).toHaveBeenCalledTimes(1);
    const text = append.mock.calls[0][0] as string;
    expect(text).toContain(GENUI_ACTION_MARKER);
  });

  test("open_url opens a new tab and never touches the thread", () => {
    const open = jest.spyOn(window, "open").mockImplementation(() => null);
    try {
      const { aui, append } = fakeAui();
      dispatchGenUIAction(aui, urlAction);
      expect(open).toHaveBeenCalledWith(
        "https://example.com/reporte",
        "_blank",
        "noopener,noreferrer",
      );
      expect(append).not.toHaveBeenCalled();
    } finally {
      open.mockRestore();
    }
  });
});

describe("confirmGenUIAction / denyGenUIAction", () => {
  const card = {
    question: "¿Lanzamos la campaña?",
    action: approvalAction,
  };

  test("confirm dispatches the wrapped action — the card gates nothing itself", () => {
    const { aui, append } = fakeAui();
    confirmGenUIAction(aui, card);
    expect(append).toHaveBeenCalledTimes(1);
    expect(append.mock.calls[0][0] as string).toContain(GENUI_ACTION_MARKER);
  });

  test("deny notifies the graph with a marked denial message", () => {
    const { aui, append } = fakeAui();
    denyGenUIAction(aui, card);
    expect(append).toHaveBeenCalledTimes(1);
    const text = append.mock.calls[0][0] as string;
    expect(text).toContain(GENUI_ACTION_MARKER);
    expect(text).toContain("denied");
    expect(text).toContain("¿Lanzamos la campaña?");
  });
});

describe("appendSelectionToComposer", () => {
  const selection = {
    type: "chart-point" as const,
    chartKind: "LineChart" as const,
    chartTitle: "Monthly revenue",
    points: [{ metric: "Revenue", period: "Mar", value: 13200 }],
  };

  test("prepends the context block to the existing draft", () => {
    const { aui, setText } = fakeAui("¿por qué cayó?");
    appendSelectionToComposer(aui, selection);
    expect(setText).toHaveBeenCalledTimes(1);
    const next = setText.mock.calls[0][0] as string;
    expect(next.startsWith(GENUI_CONTEXT_MARKER)).toBe(true);
    expect(next).toContain("Monthly revenue");
    expect(next).toContain("¿por qué cayó?");
  });

  test("works on an empty draft", () => {
    const { aui, setText } = fakeAui("");
    appendSelectionToComposer(aui, selection);
    const next = setText.mock.calls[0][0] as string;
    expect(next.startsWith(GENUI_CONTEXT_MARKER)).toBe(true);
  });

  test("does not duplicate the identical block on repeated clicks", () => {
    const { aui, setText } = fakeAui("");
    appendSelectionToComposer(aui, selection);
    const first = setText.mock.calls[0][0] as string;
    const second = fakeAui(first);
    appendSelectionToComposer(second.aui, selection);
    expect(second.setText).not.toHaveBeenCalled();
  });
});

describe("createGenUIInteractionApi", () => {
  test("wires selections to the composer and actions to the thread", async () => {
    const { createGenUIInteractionApi } = await import(
      "@/lib/genui/interaction"
    );
    const { aui, append, setText } = fakeAui("");
    const api = createGenUIInteractionApi(aui);
    api.selectForConversation({
      type: "chart-point",
      chartKind: "LineChart",
      chartTitle: "T",
      points: [{ metric: "M", period: "P", value: 1 }],
    });
    expect(setText).toHaveBeenCalledTimes(1);
    api.dispatchAction(continueAction);
    expect(append).toHaveBeenCalledWith("Analiza estas métricas");
  });
});
