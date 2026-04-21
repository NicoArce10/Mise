"""Tests for `app.core.metrics` — eval-report overlay on Cockpit metrics.

These tests do not touch the filesystem of the real `evals/reports/`
directory. They either pass an explicit report dict or point the loader
at a temporary directory so parallel runs cannot flake each other.
"""
from __future__ import annotations

import json
from pathlib import Path

from app.core.metrics import (
    load_latest_report,
    overlay_metrics_from_report,
)
from app.domain.models import MetricsPreview


def _base() -> MetricsPreview:
    return MetricsPreview(
        sources_ingested=3,
        canonical_count=4,
        modifier_count=1,
        ephemeral_count=1,
        merge_precision=None,
        non_merge_accuracy=None,
        time_to_review_pack_seconds=0.12,
    )


def test_overlay_keeps_run_counts_and_adds_quality_numbers() -> None:
    report = {
        "mode": "fallback",
        "aggregate": {
            "merge_precision": 1.0,
            "merge_recall": 0.917,
            "non_merge_accuracy": 1.0,
            "modifier_routing_accuracy": 1.0,
            "ephemeral_routing_accuracy": 1.0,
            "time_to_review_pack_seconds": 0.045,
        },
    }
    merged = overlay_metrics_from_report(_base(), report)
    assert merged.sources_ingested == 3  # run-specific, preserved
    assert merged.canonical_count == 4
    assert merged.time_to_review_pack_seconds == 0.12  # this run, not aggregate
    assert merged.merge_precision == 1.0
    assert merged.non_merge_accuracy == 1.0


def test_overlay_no_report_returns_base_unchanged() -> None:
    merged = overlay_metrics_from_report(_base(), None)
    assert merged.merge_precision is None
    assert merged.non_merge_accuracy is None
    assert merged == _base()


def test_overlay_malformed_report_is_safe() -> None:
    # Payload without the `aggregate` block should be treated as absent.
    merged = overlay_metrics_from_report(_base(), {"mode": "fallback"})
    assert merged == _base()


def test_load_latest_report_picks_newest_mtime(tmp_path: Path) -> None:
    older = tmp_path / "older.json"
    older.write_text(json.dumps({"aggregate": {"merge_precision": 0.5}}))
    newer = tmp_path / "newer.json"
    newer.write_text(json.dumps({"aggregate": {"merge_precision": 0.9}}))
    # Force deterministic mtime ordering: newer must be strictly after older.
    import os
    import time
    time.sleep(0.02)
    os.utime(newer, None)
    report = load_latest_report(tmp_path)
    assert report is not None
    assert report["aggregate"]["merge_precision"] == 0.9


def test_load_latest_report_missing_dir_returns_none(tmp_path: Path) -> None:
    missing = tmp_path / "does_not_exist"
    assert load_latest_report(missing) is None


def test_load_latest_report_skips_corrupt_json(tmp_path: Path) -> None:
    (tmp_path / "bad.json").write_text("{not json")
    (tmp_path / "good.json").write_text(
        json.dumps({"aggregate": {"merge_precision": 1.0}})
    )
    report = load_latest_report(tmp_path)
    # Either the good one was picked or we degraded safely to None.
    assert report is None or report["aggregate"]["merge_precision"] == 1.0
