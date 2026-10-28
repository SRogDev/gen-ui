"""GenUI decision hook (U3 backend half, U5 retry policy).

GenUI is OPTIONAL (GenUI plan §1.5): the default response is text-only. When
the graph carries a ``genui_candidate`` mapping — placed by executor/tools
from real, tool-produced data (never hallucinated, §13-§14) — this hook
validates it against the strict Pydantic allowlist:

    valid   → keep the JSON-safe spec as ``genui_spec``
    invalid → ONE retry (§21) → still invalid → drop it (fallback to text)

The node lives here (not in ``ai_mind/nodes.py``) so the GenUI backend stays
self-contained and importable without the network-at-import clients that
``nodes.py`` pulls in. ``graph.py`` wires it as
``response_formatter → genui_decision → memory_write``; the existing text
flow is untouched.

Retry model (U5): the retry regenerates the *candidate* — i.e. whoever
produces candidates (model/tooling, future work) gets exactly one more
chance via the ``regenerate`` callback. The node currently passes no
producer, so an invalid spec falls back immediately (same as U3) while the
policy, telemetry, and tests are real. No endless retries, ever.
"""

import time
from collections.abc import Callable
from typing import Any

import structlog

from ai_services.app.ai_mind.state import AIMindState
from ai_services.app.genui.schemas import parse_genui_spec

log = structlog.get_logger(__name__)

#: GenUI plan §21: exactly one regeneration attempt after a validation
#: failure, then fallback to text.
MAX_GENUI_RETRIES = 1


def _validate(candidate: Any) -> tuple[dict[str, Any] | None, str | None]:
    """Single validation pass.

    Returns ``(spec_dict, None)`` for a valid spec, ``(None, None)`` when no
    candidate was provided (text-only default), and ``(None, error)`` when
    the candidate fails validation. The spec dict is JSON-safe
    (``mode="json"``) — ready for the ``ui_message`` transport envelope,
    SSE serialization, and JSONB persistence (U7).
    """
    if candidate is None:
        return None, None
    try:
        spec = parse_genui_spec(candidate)
    except Exception as exc:  # noqa: BLE001 — validation boundary: any failure → text fallback
        return None, f"{type(exc).__name__}: {exc}"[:500]
    return spec.model_dump(mode="json"), None


def decide_genui_spec(
    candidate: Any,
    *,
    regenerate: Callable[[], Any] | None = None,
) -> tuple[dict[str, Any] | None, str | None]:
    """Validate an optional GenUI candidate spec, with one retry on failure.

    Args:
        candidate: raw candidate mapping (or ``None`` for text-only).
        regenerate: optional zero-arg callable producing a *fresh* candidate
            for the single retry. When ``None`` (no producer wired yet), an
            invalid spec falls back to text immediately.

    Returns ``(spec_dict, None)`` / ``(None, None)`` / ``(None, error)`` —
    same contract as U3. Telemetry (§23) is emitted via structlog:
    ``genui.decision`` (outcome, components, validation_ms),
    ``genui.spec_invalid`` (attempt, error), ``genui.retry`` (attempt),
    ``genui.fallback`` (reason).
    """
    if candidate is None:
        log.debug("genui.decision", outcome="text_only")
        return None, None

    start = time.perf_counter()
    spec, error = _validate(candidate)
    validation_ms = round((time.perf_counter() - start) * 1000, 2)

    if spec is not None:
        log.info(
            "genui.decision",
            outcome="valid",
            components=[c["component"] for c in spec["components"]],
            validation_ms=validation_ms,
        )
        return spec, None

    log.warning("genui.spec_invalid", attempt=0, error=error)

    if regenerate is None:
        log.warning("genui.fallback", reason="no_regenerator", error=error)
        return None, error

    log.info("genui.retry", attempt=1)
    try:
        retry_candidate = regenerate()
    except Exception as exc:  # noqa: BLE001 — a failing producer must not break the text flow
        log.warning(
            "genui.fallback",
            reason="regenerator_error",
            error=f"{type(exc).__name__}: {exc}"[:500],
        )
        return None, error

    start = time.perf_counter()
    retry_spec, retry_error = _validate(retry_candidate)
    retry_ms = round((time.perf_counter() - start) * 1000, 2)

    if retry_spec is not None:
        log.info(
            "genui.decision",
            outcome="valid_after_retry",
            components=[c["component"] for c in retry_spec["components"]],
            validation_ms=retry_ms,
        )
        return retry_spec, None

    log.warning("genui.spec_invalid", attempt=1, error=retry_error)
    log.warning("genui.fallback", reason="invalid_after_retry", error=retry_error)
    return None, retry_error


async def genui_decision_node(state: AIMindState) -> dict[str, Any]:
    """Graph node: validate ``state["genui_candidate"]`` into ``genui_spec``.

    Additive by design — when no candidate is present the node is a no-op
    and the text response flows through unchanged. The ``regenerate``
    callback is not wired here yet: candidate production (model/tooling) is
    future work; when it lands, this node is the place to pass it so the
    single retry regenerates from the producer.
    """
    candidate = state.get("genui_candidate")
    spec, _error = decide_genui_spec(candidate)
    return {"genui_spec": spec}
