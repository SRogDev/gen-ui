"""GenUI backend (U3): Pydantic-validated structured UI output for ai_mind.

Strict allowlist (GenUI plan §1.1, §5-§6, §26): the model chooses WHAT from
a finite semantic catalog; Polygrow controls HOW (rendering is U4, Zod is the
final frontend boundary). No arbitrary HTML/CSS/React/JS can pass validation.
"""

from ai_services.app.genui.decision import decide_genui_spec, genui_decision_node
from ai_services.app.genui.schemas import (
    GENUI_SPEC_VERSION,
    MAX_ACTION_BUTTONS,
    MAX_CHART_POINTS,
    MAX_CHART_SERIES,
    MAX_COMPONENTS_PER_MESSAGE,
    MAX_LIST_ITEMS,
    MAX_NESTING_DEPTH,
    MAX_SPEC_BYTES,
    MAX_TABLE_COLUMNS,
    MAX_TABLE_ROWS,
    MAX_TIMELINE_EVENTS,
    GenUISpec,
    parse_genui_spec,
)

__all__ = [
    "GENUI_SPEC_VERSION",
    "MAX_ACTION_BUTTONS",
    "MAX_CHART_POINTS",
    "MAX_CHART_SERIES",
    "MAX_COMPONENTS_PER_MESSAGE",
    "MAX_LIST_ITEMS",
    "MAX_NESTING_DEPTH",
    "MAX_SPEC_BYTES",
    "MAX_TABLE_COLUMNS",
    "MAX_TABLE_ROWS",
    "MAX_TIMELINE_EVENTS",
    "GenUISpec",
    "decide_genui_spec",
    "genui_decision_node",
    "parse_genui_spec",
]
