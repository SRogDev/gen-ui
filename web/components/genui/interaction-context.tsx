"use client";

import { createContext, type ReactNode, useContext } from "react";
import type { GenUIInteractionApi } from "@/lib/genui/interaction";

/**
 * Safe default: GenUI components stay renderable in isolation (unit tests,
 * previews) where no runtime exists. Interactions become real only under
 * `GenUIInteractionProvider`, which `mind-chat.tsx` mounts inside the
 * AssistantRuntimeProvider with an API built from `useAui()`.
 *
 * This module deliberately imports nothing from `@assistant-ui/*`
 * (ESM-only): the runtime is injected as a value, so importing this module
 * never breaks jest's node_modules transform boundary.
 */
const noopApi: GenUIInteractionApi = {
  selectForConversation: () => {},
  dispatchAction: () => {},
  confirmAction: () => {},
  denyAction: () => {},
};

const GenUIInteractionContext = createContext<GenUIInteractionApi>(noopApi);

export function useGenUIInteraction(): GenUIInteractionApi {
  return useContext(GenUIInteractionContext);
}

export function GenUIInteractionProvider({
  value,
  children,
}: {
  value: GenUIInteractionApi;
  children: ReactNode;
}) {
  return (
    <GenUIInteractionContext.Provider value={value}>
      {children}
    </GenUIInteractionContext.Provider>
  );
}
