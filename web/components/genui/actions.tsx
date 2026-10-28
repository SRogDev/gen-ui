"use client";

import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GenUIComponent } from "@/lib/genui/schemas";
import { useGenUIInteraction } from "./interaction-context";

type ActionCardProps = Extract<GenUIComponent, { component: "ActionCard" }>;
type ConfirmationCardProps = Extract<
  GenUIComponent,
  { component: "ConfirmationCard" }
>;

/**
 * U5: clicks dispatch through the Assistant UI runtime —
 * GenUI action event → Polygrow intent → LangGraph → Harness (plan §17).
 * Components never mutate state directly and never gate execution: approval
 * authority stays in the graph's existing `human_interrupt` flow (§18).
 */
export function ActionCard({ title, description, actions }: ActionCardProps) {
  const { dispatchAction } = useGenUIInteraction();
  return (
    <div className="rounded-xl border border-white/[0.08] bg-depth p-4 shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      {description ? (
        <p className="mt-1 text-sm text-text-secondary">{description}</p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action.label}
            variant="outline"
            size="sm"
            onClick={() => dispatchAction(action)}
            className="border-white/10 bg-white/[0.03]"
          >
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

/**
 * Confirm dispatches the wrapped action; deny notifies the graph with a
 * marked denial message. The card implements no permission system of its
 * own — the existing Harness approval flow governs execution.
 */
export function ConfirmationCard({
  title,
  question,
  confirm_label,
  deny_label,
  action,
}: ConfirmationCardProps) {
  const { confirmAction, denyAction } = useGenUIInteraction();
  return (
    <div className="rounded-xl border border-warning/30 bg-warning/[0.05] p-4 shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
      <div className="flex items-start gap-3">
        <TriangleAlert
          className="mt-0.5 h-5 w-5 shrink-0 text-warning"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
          <p className="mt-1 text-sm text-text-secondary">{question}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => confirmAction({ question, action })}
            >
              {confirm_label}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => denyAction({ question })}
              className="border-white/10 bg-white/[0.03]"
            >
              {deny_label}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
