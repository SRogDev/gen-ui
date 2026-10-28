"use client";

import type { ComponentType } from "react";
import {
  type GenUIComponent,
  type GenUILayout,
  parseGenUISpec,
} from "@/lib/genui/schemas";
import { cn } from "@/lib/utils";
import { ActionCard, ConfirmationCard } from "./actions";
import { GoalProgress } from "./bi";
import {
  ComparisonCard,
  InsightCard,
  KPIGroup,
  MetricCard,
  StatGroup,
} from "./cards";
import {
  GenUIAreaChart,
  GenUIBarChart,
  GenUILineChart,
  GenUIPieChart,
} from "./charts";
import { GenUIFilePreview, GenUIImage } from "./content";
import { DataTable, GenUIList } from "./data";

/**
 * Wire-contract name for the GenUI renderer.
 *
 * Verified against the installed `@assistant-ui/react-langgraph@0.14.x`:
 * the shim emits `values.ui = [{type:"ui", name:"polygrow-genui", props}]`,
 * the adapter converts via `uiMessageToDataPart` to
 * `{type:"data", name, data: props}`, and `useLangGraphRuntime` looks the
 * renderer up in `uiComponents.renderers[name]`.
 */
export const GENUI_RENDERER_NAME = "polygrow-genui";

// biome-ignore lint/suspicious/noExplicitAny: registry erases per-component prop types AFTER Zod validation (allowlist + Zod are the boundary)
const REGISTRY: Record<string, ComponentType<any>> = {
  MetricCard,
  ComparisonCard,
  InsightCard,
  StatGroup,
  LineChart: GenUILineChart,
  BarChart: GenUIBarChart,
  PieChart: GenUIPieChart,
  AreaChart: GenUIAreaChart,
  DataTable,
  List: GenUIList,
  GoalProgress,
  KPIGroup,
  ActionCard,
  ConfirmationCard,
  Image: GenUIImage,
  FilePreview: GenUIFilePreview,
};

/**
 * Backend-allowlisted names with no U4 renderer yet (GenUI plan §8 "later").
 * They resolve to a deterministic honest placeholder — never to arbitrary
 * React, never a crash. Real renderers land in later phases.
 */
const BACKEND_ONLY_COMPONENTS = new Set([
  "ScatterChart",
  "FunnelChart",
  "RadarChart",
  "Heatmap",
  "Timeline",
  "BusinessPulse",
]);

export function UnsupportedGenUIComponent({
  component,
}: {
  component: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 bg-depth/60 p-4 text-center">
      <p className="text-xs text-text-tertiary">
        La visualización “{component}” no está disponible en esta versión.
      </p>
    </div>
  );
}

/**
 * Resolve a semantic component name to its trusted implementation.
 * @throws Error with a typed message when the name is not allowlisted.
 */
// biome-ignore lint/suspicious/noExplicitAny: see REGISTRY comment above
export function resolveGenUIComponent(name: string): ComponentType<any> {
  const found = REGISTRY[name];
  if (found) return found;
  if (BACKEND_ONLY_COMPONENTS.has(name)) return UnsupportedGenUIComponent;
  throw new Error(`GenUI component "${name}" is not in the GenUI allowlist`);
}

function GenUILayoutView({
  layout,
  children,
}: {
  layout: GenUILayout;
  children: React.ReactNode;
}) {
  if (layout === "grid-2") {
    // Renderer-controlled responsive: 2 columns on sm+, stacked on mobile.
    // The model controls no breakpoints.
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    );
  }
  if (layout === "full") {
    return <div className="w-full">{children}</div>;
  }
  return <div className={cn("flex flex-col gap-4")}>{children}</div>;
}

export type PolygrowGenUIRendererProps = {
  /** ui_message name — always "polygrow-genui" on this path. */
  name: string;
  /** The validated GenUI spec (ui_message `props`). Re-validated here. */
  data: unknown;
};

/**
 * The `DataMessagePartComponent` registered at
 * `uiComponents.renderers["polygrow-genui"]`.
 *
 * `data` is re-validated with Zod (final boundary). A malformed spec renders
 * nothing — it can never instantiate arbitrary React.
 */
export function PolygrowGenUIRenderer({ data }: PolygrowGenUIRendererProps) {
  const spec = parseGenUISpec(data);
  if (!spec) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn("[genui] rejected invalid spec at render boundary");
    }
    return null;
  }
  return (
    <GenUILayoutView layout={spec.layout}>
      {spec.components.map((component: GenUIComponent, index: number) => {
        const Resolved = resolveGenUIComponent(component.component);
        return (
          <Resolved
            // biome-ignore lint/suspicious/noArrayIndexKey: message content is static, never reorders
            key={`${component.component}-${index}`}
            {...component}
          />
        );
      })}
    </GenUILayoutView>
  );
}
