"""U3: Pydantic validation for the GenUI semantic component catalog.

Strict allowlist (GenUI plan §1.1, §5-§6, §26): the model chooses WHAT from a
finite catalog; Polygrow controls HOW. Unknown component names, malformed
props, invalid URLs/file refs, and over-budget payloads must fail validation
so the decision hook can fall back to text (GenUI plan §21).
"""

import json

import pytest
from pydantic import ValidationError

from ai_services.app.genui.schemas import (
    MAX_COMPONENTS_PER_MESSAGE,
    parse_genui_spec,
)


def _valid_spec(**overrides):
    base = {
        "version": "1",
        "layout": "grid-2",
        "source": "stripe.get_mrr",
        "components": [
            {
                "component": "MetricCard",
                "title": "MRR",
                "value": "$13,200",
                "delta": "+32%",
                "delta_direction": "up",
            },
            {
                "component": "LineChart",
                "title": "Revenue trend",
                "series": [
                    {
                        "name": "revenue",
                        "points": [
                            {"x": "Jan", "y": 10000.0},
                            {"x": "Feb", "y": 11500.0},
                            {"x": "Mar", "y": 13200.0},
                        ],
                    }
                ],
            },
            {
                "component": "DataTable",
                "title": "Top plans",
                "columns": [
                    {"key": "plan", "label": "Plan"},
                    {"key": "mrr", "label": "MRR", "numeric": True},
                ],
                "rows": [
                    {"plan": "Pro", "mrr": 8200},
                    {"plan": "Starter", "mrr": 5000},
                ],
            },
            {
                "component": "ActionCard",
                "title": "Next step",
                "actions": [
                    {
                        "kind": "continue_conversation",
                        "label": "Explain the jump",
                        "payload": {"message": "Why did revenue jump in March?"},
                    }
                ],
            },
        ],
    }
    base.update(overrides)
    return base


def test_valid_spec_passes():
    spec = parse_genui_spec(_valid_spec())
    assert spec.version == "1"
    assert spec.layout == "grid-2"
    assert len(spec.components) == 4
    assert spec.components[0].component == "MetricCard"


def test_unknown_component_name_rejected():
    bad = _valid_spec()
    bad["components"] = [{"component": "DeathStar", "title": "x"}]
    with pytest.raises(ValidationError):
        parse_genui_spec(bad)


def test_malformed_props_rejected():
    # missing required title
    bad = _valid_spec()
    bad["components"] = [{"component": "MetricCard", "value": "$1"}]
    with pytest.raises(ValidationError):
        parse_genui_spec(bad)

    # unknown extra prop is forbidden
    bad = _valid_spec()
    bad["components"] = [
        {
            "component": "MetricCard",
            "title": "MRR",
            "value": "$1",
            "background": "#123456",
        }
    ]
    with pytest.raises(ValidationError):
        parse_genui_spec(bad)

    # wrong prop type
    bad = _valid_spec()
    bad["components"] = [
        {"component": "MetricCard", "title": "MRR", "value": "$1", "delta": 42}
    ]
    with pytest.raises(ValidationError):
        parse_genui_spec(bad)


def test_excessive_component_count_rejected():
    bad = _valid_spec()
    card = {"component": "MetricCard", "title": "M", "value": "1"}
    bad["components"] = [dict(card) for _ in range(MAX_COMPONENTS_PER_MESSAGE + 1)]
    with pytest.raises(ValidationError):
        parse_genui_spec(bad)


def test_excessive_chart_points_rejected():
    bad = _valid_spec()
    bad["components"] = [
        {
            "component": "LineChart",
            "title": "Too much",
            "series": [
                {
                    "name": "s",
                    "points": [{"x": str(i), "y": float(i)} for i in range(61)],
                }
            ],
        }
    ]
    with pytest.raises(ValidationError):
        parse_genui_spec(bad)


def test_excessive_table_rows_rejected():
    bad = _valid_spec()
    bad["components"] = [
        {
            "component": "DataTable",
            "title": "Too many",
            "columns": [{"key": "a", "label": "A"}],
            "rows": [{"a": i} for i in range(51)],
        }
    ]
    with pytest.raises(ValidationError):
        parse_genui_spec(bad)


def test_table_row_keys_must_match_columns():
    bad = _valid_spec()
    bad["components"] = [
        {
            "component": "DataTable",
            "title": "Mismatch",
            "columns": [{"key": "a", "label": "A"}],
            "rows": [{"zzz": 1}],
        }
    ]
    with pytest.raises(ValidationError):
        parse_genui_spec(bad)


def test_invalid_action_kind_rejected():
    bad = _valid_spec()
    bad["components"] = [
        {
            "component": "ActionCard",
            "title": "Evil",
            "actions": [
                {
                    "kind": "run_arbitrary_js",
                    "label": "pwn",
                    "payload": {"code": "alert(1)"},
                }
            ],
        }
    ]
    with pytest.raises(ValidationError):
        parse_genui_spec(bad)


def test_action_payload_validated_per_kind():
    bad = _valid_spec()
    bad["components"] = [
        {
            "component": "ActionCard",
            "title": "Bad URL",
            "actions": [
                {
                    "kind": "open_url",
                    "label": "open",
                    "payload": {"url": "javascript:alert(1)"},
                }
            ],
        }
    ]
    with pytest.raises(ValidationError):
        parse_genui_spec(bad)

    bad["components"][0]["actions"] = [
        {"kind": "continue_conversation", "label": "go", "payload": {}}
    ]
    with pytest.raises(ValidationError):
        parse_genui_spec(bad)


def test_invalid_file_ref_rejected():
    bad = _valid_spec()
    bad["components"] = [
        {
            "component": "FilePreview",
            "file": {
                "file_id": "../../etc/passwd",
                "filename": "../../../etc/passwd",
                "media_type": "application/pdf",
                "size_bytes": 10,
            },
        }
    ]
    with pytest.raises(ValidationError):
        parse_genui_spec(bad)


def test_invalid_image_url_rejected():
    bad = _valid_spec()
    bad["components"] = [
        {"component": "Image", "url": "not-a-url", "alt": "x"},
    ]
    with pytest.raises(ValidationError):
        parse_genui_spec(bad)


def test_missing_source_rejected():
    bad = _valid_spec()
    del bad["source"]
    with pytest.raises(ValidationError):
        parse_genui_spec(bad)


def test_invalid_layout_rejected():
    bad = _valid_spec(layout="masonry-3col")
    with pytest.raises(ValidationError):
        parse_genui_spec(bad)


def test_non_mapping_candidate_rejected():
    with pytest.raises((ValidationError, TypeError, ValueError)):
        parse_genui_spec("just a string")


def test_oversize_payload_rejected():
    bad = _valid_spec()
    bad["components"] = [
        {
            "component": "InsightCard",
            "title": "Big",
            "body": "x" * 70000,
        }
    ]
    with pytest.raises((ValidationError, ValueError)):
        parse_genui_spec(bad)


def test_serialization_round_trip():
    """Specs persist as JSONB (U7) — never rendered HTML. The validated spec
    must survive a JSON round trip byte-identical in meaning."""
    spec = parse_genui_spec(_valid_spec())
    payload = spec.model_dump(mode="json")
    blob = json.dumps(payload)
    spec2 = parse_genui_spec(json.loads(blob))
    assert spec2.model_dump(mode="json") == payload


def test_goal_progress_bounds():
    with pytest.raises(ValidationError):
        parse_genui_spec(
            _valid_spec(
                components=[
                    {
                        "component": "GoalProgress",
                        "title": "G",
                        "current": 5,
                        "target": 0,
                        "source": "x",
                    }
                ]
            )
        )


def test_confirmation_card_requires_action():
    spec = parse_genui_spec(
        _valid_spec(
            components=[
                {
                    "component": "ConfirmationCard",
                    "title": "Approve?",
                    "question": "Run the refund?",
                    "action": {
                        "kind": "request_approval",
                        "label": "Approve refund",
                        "payload": {"summary": "Refund $20 to customer 123"},
                    },
                }
            ]
        )
    )
    assert spec.components[0].component == "ConfirmationCard"
