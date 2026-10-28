/**
 * U5: GenUIInteractionProvider test.
 *
 * The provider is a thin value carrier (the runtime is injected by
 * `mind-chat.tsx`); this pins that consumers receive the provided API and
 * that the default outside a provider is a safe no-op.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import type { GenUIInteractionApi } from "@/lib/genui/interaction";
import {
  GenUIInteractionProvider,
  useGenUIInteraction,
} from "../interaction-context";

function Consumer({ label }: { label: string }) {
  const api = useGenUIInteraction();
  return (
    <button type="button" onClick={() => api.dispatchAction(label as never)}>
      {label}
    </button>
  );
}

test("provider delivers the injected API to consumers", () => {
  const dispatchAction = jest.fn();
  const api = {
    selectForConversation: jest.fn(),
    dispatchAction,
    confirmAction: jest.fn(),
    denyAction: jest.fn(),
  } satisfies GenUIInteractionApi;
  render(
    <GenUIInteractionProvider value={api}>
      <Consumer label="go" />
    </GenUIInteractionProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "go" }));
  expect(dispatchAction).toHaveBeenCalledTimes(1);
});

test("default context outside a provider is a safe no-op", () => {
  render(<Consumer label="noop" />);
  expect(() =>
    fireEvent.click(screen.getByRole("button", { name: "noop" })),
  ).not.toThrow();
});
