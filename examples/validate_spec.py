"""Minimal runnable example: validate a GenUI spec with the copied schemas.

Loads ``python/genui/schemas.py`` directly by file path. This is deliberate:
``schemas.py`` depends only on pydantic, while the package ``__init__`` and
``decision.py`` expect the original Polygrow package layout (see README.md,
"Dependency boundary"), so they are not imported here.

Run (needs pydantic, e.g. ``pip install pydantic`` or any venv that has it):

    python3 examples/validate_spec.py

Expected output: the valid spec is accepted and printed, and the spec with an
unknown component name is rejected with a pydantic ValidationError.
"""

import importlib.util
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCHEMAS_PATH = HERE.parent / "python" / "genui" / "schemas.py"


def load_schemas():
    spec = importlib.util.spec_from_file_location("genui_schemas", SCHEMAS_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"cannot load {SCHEMAS_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main() -> int:
    schemas = load_schemas()
    parse = schemas.parse_genui_spec

    valid = {
        "version": "1",
        "layout": "stack",
        "source": "example-tool",
        "components": [
            {"component": "MetricCard", "title": "MRR", "value": "$12,400"},
            {
                "component": "MetricCard",
                "title": "Churn",
                "value": "1.8%",
                "delta": "-0.3 pts",
                "delta_direction": "down",
            },
        ],
    }
    spec = parse(valid)
    print("VALID spec accepted:")
    print(json.dumps(json.loads(spec.model_dump_json()), indent=2))

    invalid = {
        "version": "1",
        "layout": "stack",
        "source": "example-tool",
        "components": [{"component": "SuperWidget", "title": "Nope"}],
    }
    try:
        parse(invalid)
    except Exception as exc:  # pydantic.ValidationError
        print(f"INVALID spec rejected as expected: {type(exc).__name__}")
        print(str(exc).splitlines()[0])
        return 0
    print("ERROR: invalid spec was accepted, expected rejection")
    return 1


if __name__ == "__main__":
    sys.exit(main())
