"""Surface the latest eval report inside Cockpit payloads.

Gate 4 requires the Cockpit metrics pane to read from the most recent
`evals/reports/*.json` rather than from static mock numbers. This
module locates the report (newest by mtime) and merges its aggregate
values into an already-built `MetricsPreview`.

The lookup is best-effort: if no report exists (fresh clone, fresh CI
shell) the per-run numbers from the pipeline stand. This keeps the
demo deterministic without tying the app to a file that is optional.
"""
from __future__ import annotations

import json
import logging
from functools import lru_cache
from pathlib import Path
from typing import Any

from ..domain.models import MetricsPreview

logger = logging.getLogger(__name__)

# metrics.py -> core -> app -> backend -> <project root>
_PROJECT_ROOT = Path(__file__).resolve().parents[3]
_REPORTS_DIR = _PROJECT_ROOT / "evals" / "reports"


def _reports_dir() -> Path:
    """Indirection so tests can monkeypatch the module attribute."""
    return _REPORTS_DIR


def load_latest_report(reports_dir: Path | None = None) -> dict[str, Any] | None:
    """Return the parsed content of the newest `*.json` under `evals/reports/`.

    Returns `None` if the directory is missing, empty, or every candidate
    fails to parse. Never raises — we always want the demo to render.
    """
    directory = reports_dir if reports_dir is not None else _reports_dir()
    if not directory.is_dir():
        return None
    candidates = sorted(
        directory.glob("*.json"),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    for path in candidates:
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            logger.warning("[mise] skipping eval report %s: %s", path.name, exc)
            continue
    return None


def overlay_metrics_from_report(
    base: MetricsPreview,
    report: dict[str, Any] | None,
) -> MetricsPreview:
    """Overlay aggregate quality metrics onto `base`.

    `base` carries the per-run counts (sources ingested, canonicals,
    modifiers, ephemerals, time-to-pack). We keep those because they
    describe *this* run. We replace `merge_precision` and
    `non_merge_accuracy` with the harness aggregate when available —
    those are the judge-visible quality numbers and must be measured,
    never invented.

    Pass `report=None` explicitly to return `base` unchanged. Callers
    typically pass `load_latest_report()` so the I/O happens at the
    call site, not inside this pure function (testability).
    """
    if not report:
        return base
    aggregate = report.get("aggregate") if isinstance(report, dict) else None
    if not isinstance(aggregate, dict):
        return base
    updates: dict[str, Any] = {}
    if "merge_precision" in aggregate:
        updates["merge_precision"] = float(aggregate["merge_precision"])
    if "non_merge_accuracy" in aggregate:
        updates["non_merge_accuracy"] = float(aggregate["non_merge_accuracy"])
    if not updates:
        return base
    return base.model_copy(update=updates)


def apply_latest_report(base: MetricsPreview) -> MetricsPreview:
    """Convenience: load the newest report and overlay it.

    Keep I/O separated from the pure overlay helper so unit tests can
    exercise the overlay without filesystem setup.
    """
    return overlay_metrics_from_report(base, load_latest_report())


@lru_cache(maxsize=1)
def _cached_latest_report_mtime() -> float:
    """Smoke cache. Tests clear via `clear_cache()`."""
    directory = _reports_dir()
    if not directory.is_dir():
        return 0.0
    files = list(directory.glob("*.json"))
    return max((p.stat().st_mtime for p in files), default=0.0)


def clear_cache() -> None:
    _cached_latest_report_mtime.cache_clear()
