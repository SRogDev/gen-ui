"""Pydantic schemas for the GenUI semantic component catalog (U3 backend half).

Strict allowlist (GenUI plan §1.1, §5-§6, §26):

- The model decides WHAT: one of the finite semantic component names below.
- Polygrow controls HOW: visual rendering is U4's registry; Zod is the final
  frontend boundary. The model can never dictate colors, spacing, typography,
  or breakpoints, and can never instantiate arbitrary HTML/CSS/React/JS.

Validation boundaries (GenUI plan §21):

    LLM structured output
        ↓
    Pydantic (this module) — unknown names, malformed props, invalid
    URLs/file refs, and over-budget payloads are REJECTED here
        ↓
    Assistant UI transport (ui_message envelope, ADR-001)
        ↓
    Zod (U4) — final frontend boundary
        ↓
    allowlisted renderer (U4)

Data honesty (GenUI plan §13-§14): every spec carries ``source``, the
tool/capability that produced the data. Deterministic metrics are computed
server-side by tools; the schema cannot distinguish hallucinated numbers
from real ones, so the graph only attaches specs built from validated tool
outputs (see ``decision.py`` and ``docs/genui-backend-u3.md``).
"""

from typing import Annotated, Any, Literal

from pydantic import (
    AnyHttpUrl,
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)

GENUI_SPEC_VERSION = "1"

# MVP budgets (GenUI plan §12). Hard rejects, not user-visible limits.
MAX_COMPONENTS_PER_MESSAGE = 5
MAX_CHART_POINTS = 60  # points per series
MAX_CHART_SERIES = 6
MAX_TABLE_ROWS = 50
MAX_TABLE_COLUMNS = 12
MAX_LIST_ITEMS = 30
MAX_TIMELINE_EVENTS = 30
MAX_ACTION_BUTTONS = 4  # per ActionCard
MAX_SPEC_BYTES = 65_536  # serialized JSON ceiling
# The schema is flat by construction (layout + component list), so nesting
# depth is 1 — inside the §11 ~2-level guard by design.
MAX_NESTING_DEPTH = 2


class _Strict(BaseModel):
    """Base: unknown props are forbidden (malformed model output rejected)."""

    model_config = ConfigDict(extra="forbid")


DeltaDirection = Literal["up", "down", "flat"]
GenUILayout = Literal["stack", "grid-2", "full"]


# ---------------------------------------------------------------------------
# Information
# ---------------------------------------------------------------------------


class MetricCardProps(_Strict):
    component: Literal["MetricCard"]
    title: str = Field(min_length=1, max_length=120)
    value: str = Field(min_length=1, max_length=60)
    delta: str | None = Field(default=None, max_length=20)
    delta_direction: DeltaDirection | None = None
    caption: str | None = Field(default=None, max_length=200)


class ComparisonItem(_Strict):
    label: str = Field(min_length=1, max_length=80)
    value: str = Field(min_length=1, max_length=60)
    delta: str | None = Field(default=None, max_length=20)


class ComparisonCardProps(_Strict):
    component: Literal["ComparisonCard"]
    title: str = Field(min_length=1, max_length=120)
    items: list[ComparisonItem] = Field(min_length=2, max_length=6)


class InsightCardProps(_Strict):
    component: Literal["InsightCard"]
    title: str = Field(min_length=1, max_length=120)
    body: str = Field(min_length=1, max_length=2000)
    severity: Literal["info", "success", "warning"] = "info"


class StatItem(_Strict):
    label: str = Field(min_length=1, max_length=80)
    value: str = Field(min_length=1, max_length=60)


class StatGroupProps(_Strict):
    component: Literal["StatGroup"]
    title: str | None = Field(default=None, max_length=120)
    stats: list[StatItem] = Field(min_length=1, max_length=8)


# ---------------------------------------------------------------------------
# Visualization
# ---------------------------------------------------------------------------


class ChartPoint(_Strict):
    x: str = Field(min_length=1, max_length=40)
    y: float


class ChartSeries(_Strict):
    name: str = Field(min_length=1, max_length=60)
    points: list[ChartPoint] = Field(min_length=1, max_length=MAX_CHART_POINTS)


class _CartesianChartProps(_Strict):
    title: str = Field(min_length=1, max_length=120)
    x_label: str | None = Field(default=None, max_length=60)
    y_label: str | None = Field(default=None, max_length=60)
    series: list[ChartSeries] = Field(min_length=1, max_length=MAX_CHART_SERIES)


class LineChartProps(_CartesianChartProps):
    component: Literal["LineChart"]


class BarChartProps(_CartesianChartProps):
    component: Literal["BarChart"]


class AreaChartProps(_CartesianChartProps):
    component: Literal["AreaChart"]


class PieSlice(_Strict):
    label: str = Field(min_length=1, max_length=60)
    value: float = Field(ge=0)


class PieChartProps(_Strict):
    component: Literal["PieChart"]
    title: str = Field(min_length=1, max_length=120)
    slices: list[PieSlice] = Field(min_length=2, max_length=12)


# Schema-allowed for later phases (GenUI plan §8, U4 renders the MVP subset).
class ScatterPoint(_Strict):
    x: float
    y: float
    label: str | None = Field(default=None, max_length=60)


class ScatterChartProps(_Strict):
    component: Literal["ScatterChart"]
    title: str = Field(min_length=1, max_length=120)
    points: list[ScatterPoint] = Field(min_length=1, max_length=200)


class FunnelStage(_Strict):
    label: str = Field(min_length=1, max_length=60)
    value: float = Field(ge=0)


class FunnelChartProps(_Strict):
    component: Literal["FunnelChart"]
    title: str = Field(min_length=1, max_length=120)
    stages: list[FunnelStage] = Field(min_length=2, max_length=10)


class RadarSeries(_Strict):
    name: str = Field(min_length=1, max_length=60)
    values: list[float] = Field(min_length=3, max_length=8)


class RadarChartProps(_Strict):
    component: Literal["RadarChart"]
    title: str = Field(min_length=1, max_length=120)
    axes: list[str] = Field(min_length=3, max_length=8)
    series: list[RadarSeries] = Field(min_length=1, max_length=MAX_CHART_SERIES)

    @model_validator(mode="after")
    def _values_match_axes(self):
        for s in self.series:
            if len(s.values) != len(self.axes):
                raise ValueError(
                    f"radar series {s.name!r} has {len(s.values)} values "
                    f"but {len(self.axes)} axes"
                )
        return self


class HeatmapProps(_Strict):
    component: Literal["Heatmap"]
    title: str = Field(min_length=1, max_length=120)
    rows: list[str] = Field(min_length=1, max_length=20)
    cols: list[str] = Field(min_length=1, max_length=20)
    values: list[list[float]]

    @model_validator(mode="after")
    def _dims_match(self):
        if len(self.values) != len(self.rows) or any(
            len(r) != len(self.cols) for r in self.values
        ):
            raise ValueError(
                f"heatmap values must be {len(self.rows)}x{len(self.cols)}"
            )
        return self


# ---------------------------------------------------------------------------
# Data
# ---------------------------------------------------------------------------


class TableColumn(_Strict):
    key: str = Field(pattern=r"^[A-Za-z_][A-Za-z0-9_]{0,63}$")
    label: str = Field(min_length=1, max_length=80)
    numeric: bool = False


class DataTableProps(_Strict):
    component: Literal["DataTable"]
    title: str = Field(min_length=1, max_length=120)
    columns: list[TableColumn] = Field(min_length=1, max_length=MAX_TABLE_COLUMNS)
    rows: list[dict[str, str | int | float | bool | None]] = Field(
        min_length=1, max_length=MAX_TABLE_ROWS
    )

    @model_validator(mode="after")
    def _rows_match_columns(self):
        keys = {c.key for c in self.columns}
        for i, row in enumerate(self.rows):
            unknown = set(row) - keys
            if unknown:
                raise ValueError(f"row {i} has keys not in columns: {sorted(unknown)}")
        return self


class ListItem(_Strict):
    title: str = Field(min_length=1, max_length=120)
    subtitle: str | None = Field(default=None, max_length=200)
    value: str | None = Field(default=None, max_length=60)


class ListProps(_Strict):
    component: Literal["List"]
    title: str | None = Field(default=None, max_length=120)
    items: list[ListItem] = Field(min_length=1, max_length=MAX_LIST_ITEMS)


class TimelineEvent(_Strict):
    timestamp: str = Field(min_length=1, max_length=40)
    title: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=300)


class TimelineProps(_Strict):
    component: Literal["Timeline"]
    title: str = Field(min_length=1, max_length=120)
    events: list[TimelineEvent] = Field(min_length=1, max_length=MAX_TIMELINE_EVENTS)


# ---------------------------------------------------------------------------
# Business intelligence
# ---------------------------------------------------------------------------


class GoalProgressProps(_Strict):
    component: Literal["GoalProgress"]
    title: str = Field(min_length=1, max_length=120)
    current: float = Field(ge=0)
    target: float = Field(gt=0)
    unit: str | None = Field(default=None, max_length=20)


class PulseFactor(_Strict):
    label: str = Field(min_length=1, max_length=60)
    value: float


class BusinessPulseProps(_Strict):
    component: Literal["BusinessPulse"]
    title: str = Field(min_length=1, max_length=120)
    score: float = Field(ge=0, le=100)
    summary: str | None = Field(default=None, max_length=500)
    factors: list[PulseFactor] = Field(default_factory=list, max_length=8)


class KpiItem(_Strict):
    label: str = Field(min_length=1, max_length=60)
    value: str = Field(min_length=1, max_length=60)
    delta: str | None = Field(default=None, max_length=20)
    delta_direction: DeltaDirection | None = None


class KPIGroupProps(_Strict):
    component: Literal["KPIGroup"]
    title: str | None = Field(default=None, max_length=120)
    kpis: list[KpiItem] = Field(min_length=1, max_length=8)


# ---------------------------------------------------------------------------
# Actions — never mutate state directly (GenUI plan §17-§18).
# A click becomes a GenUI action event → Polygrow intent → LangGraph →
# Harness → UCE/tool. ConfirmationCard reuses the existing approval flow.
# ---------------------------------------------------------------------------


class GenUIAction(_Strict):
    kind: Literal["continue_conversation", "request_approval", "open_url"]
    label: str = Field(min_length=1, max_length=80)
    payload: dict[str, Any] = Field(default_factory=dict)

    @model_validator(mode="after")
    def _payload_matches_kind(self):
        payload = self.payload
        if self.kind == "continue_conversation":
            message = payload.get("message")
            if not isinstance(message, str) or not message.strip():
                raise ValueError(
                    "continue_conversation requires payload.message (non-empty str)"
                )
            if len(message) > 2000:
                raise ValueError("continue_conversation message exceeds 2000 chars")
        elif self.kind == "open_url":
            url = payload.get("url")
            if not isinstance(url, str):
                raise ValueError("open_url requires payload.url to be an http(s) URL")
            try:
                AnyHttpUrl(url)
            except ValueError as exc:
                raise ValueError(
                    f"open_url requires payload.url to be an http(s) URL: {exc}"
                ) from exc
        elif self.kind == "request_approval":
            summary = payload.get("summary")
            if not isinstance(summary, str) or not summary.strip():
                raise ValueError(
                    "request_approval requires payload.summary (non-empty str)"
                )
            if len(summary) > 500:
                raise ValueError("request_approval summary exceeds 500 chars")
        return self


class ActionCardProps(_Strict):
    component: Literal["ActionCard"]
    title: str = Field(min_length=1, max_length=120)
    description: str | None = Field(default=None, max_length=500)
    actions: list[GenUIAction] = Field(min_length=1, max_length=MAX_ACTION_BUTTONS)


class ConfirmationCardProps(_Strict):
    component: Literal["ConfirmationCard"]
    title: str = Field(min_length=1, max_length=120)
    question: str = Field(min_length=1, max_length=500)
    confirm_label: str = Field(default="Confirm", min_length=1, max_length=40)
    deny_label: str = Field(default="Deny", min_length=1, max_length=40)
    # Executed on confirm through the existing Harness approval flow (U5);
    # the card itself implements no permission system.
    action: GenUIAction


# ---------------------------------------------------------------------------
# Content
# ---------------------------------------------------------------------------


class FileRef(_Strict):
    file_id: str = Field(pattern=r"^[A-Za-z0-9_-]{1,128}$")
    filename: str = Field(min_length=1, max_length=255)
    media_type: str = Field(min_length=1, max_length=127)
    size_bytes: int = Field(ge=0)

    @field_validator("filename")
    @classmethod
    def _no_path_traversal(cls, v: str) -> str:
        if "/" in v or "\\" in v or ".." in v:
            raise ValueError("filename must not contain path separators")
        return v


class ImageProps(_Strict):
    component: Literal["Image"]
    url: AnyHttpUrl
    alt: str = Field(min_length=1, max_length=200)
    caption: str | None = Field(default=None, max_length=300)


class FilePreviewProps(_Strict):
    component: Literal["FilePreview"]
    file: FileRef
    title: str | None = Field(default=None, max_length=120)


# ---------------------------------------------------------------------------
# Root spec
# ---------------------------------------------------------------------------

GenUIComponent = Annotated[
    MetricCardProps
    | ComparisonCardProps
    | InsightCardProps
    | StatGroupProps
    | LineChartProps
    | BarChartProps
    | AreaChartProps
    | PieChartProps
    | ScatterChartProps
    | FunnelChartProps
    | RadarChartProps
    | HeatmapProps
    | DataTableProps
    | ListProps
    | TimelineProps
    | GoalProgressProps
    | BusinessPulseProps
    | KPIGroupProps
    | ActionCardProps
    | ConfirmationCardProps
    | ImageProps
    | FilePreviewProps,
    Field(discriminator="component"),
]


class GenUISpec(_Strict):
    """A validated GenUI message: layout + 1-5 allowlisted components.

    ``source`` names the tool/capability that produced the data (§13-§14).
    """

    version: Literal[GENUI_SPEC_VERSION] = GENUI_SPEC_VERSION
    layout: GenUILayout = "stack"
    source: str = Field(min_length=1, max_length=80)
    components: list[GenUIComponent] = Field(
        min_length=1, max_length=MAX_COMPONENTS_PER_MESSAGE
    )


def parse_genui_spec(data: Any) -> GenUISpec:
    """Validate a candidate spec mapping.

    Raises ``TypeError`` for non-mappings, ``pydantic.ValidationError`` for
    schema violations, and ``ValueError`` when the serialized payload exceeds
    ``MAX_SPEC_BYTES``. Never returns a partially-valid spec.
    """
    if not isinstance(data, dict):
        raise TypeError(f"GenUI spec must be a mapping, got {type(data).__name__}")
    spec = GenUISpec.model_validate(data)
    if len(spec.model_dump_json().encode("utf-8")) > MAX_SPEC_BYTES:
        raise ValueError(f"GenUI spec exceeds {MAX_SPEC_BYTES} bytes")
    return spec
