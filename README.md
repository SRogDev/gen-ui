# Gen UI

GenUI — Polygrow's original generative-UI system: a validated display
pipeline plus an Assistant UI renderer. The model chooses **what** to show
from a finite semantic catalog; the host controls **how** it renders.
No arbitrary HTML, CSS, React, or JavaScript can pass validation.

> Status: **experimental**. This system was extracted from Polygrow so
> experimentation can continue here, independently of Polygrow's later
> OpenUI integration. The code in this repo is the original GenUI system,
> not the OpenUI-based replacement.

## What it is

- **Backend validation (`python/genui/schemas.py`)**: Pydantic schemas for
  a strict component allowlist. Unknown component names, malformed props,
  invalid URLs/file refs, and over-budget payloads are rejected here.
- **Decision hook (`python/genui/decision.py`)**: validates an optional
  `genui_candidate` mapping into a JSON-safe `genui_spec`. Policy: exactly
  **one retry**, then fallback to plain text. GenUI is optional by design:
  the default response is text-only.
- **Frontend (`web/`)**: a Zod mirror of the backend schema (the final
  validation boundary before rendering) plus React components, a renderer
  registry, and an interaction layer that turns clicks into conversation
  actions. Components never mutate app state directly.
- **Actions**: exactly three action kinds — `continue_conversation`,
  `request_approval`, `open_url`. A confirmation card is a messenger, not a
  gate: approval authority stays with the host app's approval flow.

### The 22 components (display-only, no form/input components)

MetricCard, ComparisonCard, InsightCard, StatGroup, LineChart, BarChart,
AreaChart, PieChart, ScatterChart, FunnelChart, RadarChart, Heatmap,
DataTable, List, Timeline, GoalProgress, BusinessPulse, KPIGroup, ActionCard,
ConfirmationCard, Image, FilePreview.

### Honest limitation: no production producer

In Polygrow, no production code ever set `genui_candidate`: the decision
node validates a candidate if one is present, but nothing produces one in a
real turn. So this repo ships a **validated display pipeline + renderer**,
not a complete "model generates UI" loop. Any producer (model/tooling that
emits candidates from real, tool-produced data) is future work for whoever
builds on this code. Specs must still come from real tool-produced data,
never hallucinated data — the schema cannot tell a hallucinated number
from a real one.

## Origin

Extracted verbatim from [SRogDev/Polygrow](https://github.com/SRogDev/Polygrow),
branch `dev` at commit `aa37655`, on 2026-10-28. Polygrow itself is
untouched: this is a copy, not a move. File mapping:

| This repo | Polygrow source |
|---|---|
| `python/genui/__init__.py`, `schemas.py`, `decision.py` | `ai-services/src/ai_services/app/genui/` |
| `web/components/genui/` (+ `__tests__/`) | `web/components/genui/` (+ `__tests__/`) |
| `web/lib/genui/` (+ `__tests__/`) | `web/lib/genui/` (+ `__tests__/`) |
| `tests/test_genui_schemas.py` | `ai-services/tests/test_genui_schemas.py` |
| `examples/validate_spec.py` | new, written for this repo |

## Repository structure

```
README.md            this file
LICENSE              MIT
python/genui/        backend: __init__.py, schemas.py, decision.py
web/components/genui/  React renderer: cards, charts, data, bi, content,
                       actions, registry, interaction-context (+ tests)
web/lib/genui/       Zod schemas, selection, interaction dispatch,
                       reduced-motion helper (+ tests)
tests/               backend schema tests (verbatim, see note below)
examples/            minimal runnable Python example
```

## Quickstart (Python)

Requires Python 3.12+ and `pydantic` (v2):

```bash
python3 examples/validate_spec.py
```

The example loads `python/genui/schemas.py` directly by file path and
validates one valid spec (accepted) and one spec with an unknown component
name (rejected with a `ValidationError`). See `examples/validate_spec.py`
for the exact command and expected output.

## Web usage (snippet, not a runnable app)

This repo does **not** include a Next.js app. The web files are meant to be
dropped into an assistant-ui app that provides the pieces listed under
"Dependency boundary". Adapted from Polygrow's actual usage:

```tsx
import { AssistantRuntimeProvider, useAui } from "@assistant-ui/react";
import { GenUIInteractionProvider } from "@/components/genui/interaction-context";
import {
  GENUI_RENDERER_NAME, // "polygrow-genui"
  PolygrowGenUIRenderer,
} from "@/components/genui/registry";

// In your assistant-ui runtime setup, register the renderer:
useLangGraphRuntime({
  // ...your stream/create/load...
  uiComponents: {
    renderers: { [GENUI_RENDERER_NAME]: PolygrowGenUIRenderer },
  },
});

// Inside the runtime provider, wrap the thread so clicks dispatch
// through the runtime (see web/lib/genui/interaction.ts):
const aui = useAui();
const interactionApi = createGenUIInteractionApi(aui);
// <GenUIInteractionProvider value={interactionApi}>…</GenUIInteractionProvider>
```

The renderer takes the validated spec as `data`, re-validates it with Zod,
and renders nothing (`null`) for an invalid spec. A message carrying a
`polygrow-genui` UI part renders through this registry; without one, the
chat is plain text.

## Dependency boundary

Everything outside the copied set is a host responsibility. Nothing
Polygrow-wide was vendored.

**Python**

- `python/genui/schemas.py` — standalone: only `typing` + `pydantic`.
  This is what the example runs.
- `python/genui/decision.py` — included verbatim as reference. It needs
  `structlog` plus the LangGraph state shape it was written against
  (`AIMindState`, imported from Polygrow's `ai_mind` module). Its
  `decide_genui_spec()` is pure validation; `genui_decision_node()` only
  reads `state["genui_candidate"]` by dict access, but the module cannot be
  imported without that state type. It is **not** runnable standalone here.
- `python/genui/__init__.py` — verbatim; it re-exports through the
  original `ai_services.app.genui` package path, so it also only imports
  inside the original layout.

**Web**

- The web files use the `@/` path alias (a Next.js app whose `web/` is the
  project root) and expect these npm packages: `react`, `zod`,
  `lucide-react`, `recharts`.
- `@/lib/utils` (`cn`) — a class-name helper (clsx + tailwind-merge in
  Polygrow). Provide your own.
- `@/components/ui/button`, `@/components/ui/checkbox`,
  `@/components/ui/input`, `@/components/ui/table` — shadcn-style
  primitives. Provide your own equivalents.
- `@/lib/attachments/storage` (`getSignedUrl`, `isStorageConfigured`) —
  used only by `GenUIFilePreview`'s download button, which appears only
  when storage is configured. Everything else renders without it.
- No file in this repo imports `@assistant-ui/*` directly: the runtime is
  injected as a value through a minimal structural interface
  (`GenUIAuiLike`: `thread.append`, `composer.getState/setText`). You still
  need an assistant-ui app to supply that runtime.
- The web tests were written for a Jest + `@testing-library/react` setup
  (as in Polygrow's web app). They are included verbatim; running them
  requires that harness plus the alias and primitives above.
- `tests/test_genui_schemas.py` is verbatim and imports the original
  package path (`ai_services.app.genui.schemas`); it runs in its original
  layout, not against this repo's `python/` tree as-is. Polygrow's
  `test_genui_decision.py` is deliberately **excluded**: it needs a
  LangGraph graph plus `AIMindState`, so it is not self-contained.

## What is NOT included

These stay in Polygrow and are not part of GenUI: the Mind graph and its
LangGraph shim, the Capability Engine (UCE) and Governance/approval flow,
named-view persistence (`views.ts`), plugin surfaces, and any producer
that emits candidates. This repo is the display pipeline and renderer only.

## License

MIT. See `LICENSE`.
