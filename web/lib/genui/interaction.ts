/**
 * GenUI interaction dispatch (U5).
 *
 * GenUI plan §17: a click becomes a GenUI action event → Polygrow intent →
 * LangGraph → Harness. Components NEVER mutate Polygrow state directly;
 * everything travels through the Assistant UI runtime (`thread.append`),
 * i.e. through the existing conversation → graph path. §18: no component
 * implements its own permission system — approval authority stays in the
 * graph's existing `human_interrupt` flow; the card is a messenger, not a
 * gate.
 *
 * The pure resolvers are unit-tested; the only impure boundary is the
 * runtime client, injected as a minimal structural interface (easy to fake).
 */

import type { GenUIAction } from "./schemas";
import { formatSelectionMessage, type GenUISelection } from "./selection";

/** Marker prefix identifying GenUI action events in the conversation. */
export const GENUI_ACTION_MARKER = "[genui-action]";

/** Minimal structural subset of the AssistantClient used here. */
export interface GenUIThreadLike {
  append: (message: string) => void;
}
export interface GenUIComposerLike {
  getState: () => { text: string };
  setText: (text: string) => void;
}
export interface GenUIAuiLike {
  thread: GenUIThreadLike;
  composer: GenUIComposerLike;
}

function payloadString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  return typeof value === "string" ? value : "";
}

/**
 * Prepend a captured selection to the Mind composer draft.
 *
 * Visible, editable and deletable by the user; it travels with the next
 * message through the normal send path, so the Send button and the Enter
 * key behave identically. Repeated clicks of the same point do not
 * duplicate the block.
 */
export function appendSelectionToComposer(
  aui: GenUIAuiLike,
  selection: GenUISelection,
): void {
  const block = formatSelectionMessage(selection);
  const current = aui.composer.getState().text;
  if (current.startsWith(block)) return;
  aui.composer.setText(current ? `${block}\n\n${current}` : block);
}

export type ResolvedActionDispatch =
  | { kind: "send_message"; text: string }
  | { kind: "open_url"; url: string };

/**
 * The interaction surface GenUI components consume (via React context).
 * Built once per Mind thread from the Assistant UI runtime client.
 */
export interface GenUIInteractionApi {
  /** Chart/table selection → prepended to the Mind composer draft. */
  selectForConversation: (selection: GenUISelection) => void;
  /** ActionCard click → runtime dispatch (never direct mutation). */
  dispatchAction: (action: GenUIAction) => void;
  /** ConfirmationCard confirm → dispatch the wrapped action. */
  confirmAction: (card: { question: string; action: GenUIAction }) => void;
  /** ConfirmationCard deny → marked denial message to the graph. */
  denyAction: (card: { question: string }) => void;
}

/**
 * Build the interaction API from a runtime client. Pure factory —
 * the only impure boundary is the injected client.
 */
export function createGenUIInteractionApi(
  aui: GenUIAuiLike,
): GenUIInteractionApi {
  return {
    selectForConversation: (selection) =>
      appendSelectionToComposer(aui, selection),
    dispatchAction: (action) => dispatchGenUIAction(aui, action),
    confirmAction: (card) => confirmGenUIAction(aui, card),
    denyAction: (card) => denyGenUIAction(aui, card),
  };
} /**
 * Pure resolution of a GenUI action to its dispatch target.
 * - `continue_conversation` → the action's message, sent as a user message.
 * - `request_approval` → a marked intent message; the graph's existing
 *   approval flow decides — the component never gates execution itself.
 * - `open_url` → the Zod-validated http(s) URL (plan §26: frontend boundary
 *   is stricter than the backend here).
 */
export function resolveActionDispatch(
  action: GenUIAction,
): ResolvedActionDispatch {
  if (action.kind === "open_url") {
    return { kind: "open_url", url: payloadString(action.payload, "url") };
  }
  if (action.kind === "request_approval") {
    return {
      kind: "send_message",
      text: `${GENUI_ACTION_MARKER}:request_approval ${payloadString(
        action.payload,
        "summary",
      )}`.trim(),
    };
  }
  return {
    kind: "send_message",
    text: payloadString(action.payload, "message"),
  };
}

/**
 * Dispatch an ActionCard action. Conversation actions go through
 * `thread.append` → LangGraph → Harness; URLs open in a new tab.
 */
export function dispatchGenUIAction(
  aui: { thread: GenUIThreadLike },
  action: GenUIAction,
): void {
  const resolved = resolveActionDispatch(action);
  if (resolved.kind === "open_url") {
    if (!resolved.url) return; // defense in depth; Zod already enforces
    window.open(resolved.url, "_blank", "noopener,noreferrer");
    return;
  }
  if (!resolved.text) return;
  aui.thread.append(resolved.text);
}

/**
 * ConfirmationCard confirm: dispatch the wrapped action. The card performs
 * no permission check of its own — authority stays with the existing
 * LangGraph/Harness approval mechanism.
 */
export function confirmGenUIAction(
  aui: { thread: GenUIThreadLike },
  card: { action: GenUIAction },
): void {
  dispatchGenUIAction(aui, card.action);
}

/**
 * ConfirmationCard deny: notify the graph with a marked denial message so
 * it can react (re-plan, drop the action). The message is human-readable;
 * the marker keeps it attributable in message telemetry.
 */
export function denyGenUIAction(
  aui: { thread: GenUIThreadLike },
  card: { question: string },
): void {
  aui.thread.append(`${GENUI_ACTION_MARKER}:denied ${card.question}`.trim());
}
