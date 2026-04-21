#!/usr/bin/env python
"""Mise eval harness.

Usage:
    python evals/run_eval.py --bundle bundle_01_italian
    python evals/run_eval.py --bundle all

Modes:
    --mode fallback (default) — deterministic pipeline, no API key required.
    --mode real — calls Opus 4.7 (reads ANTHROPIC_API_KEY).

The harness exercises the same pipeline used by the backend `/api/process`
endpoint, then compares the output to each bundle's `expected.json`.
No metric is ever estimated; every number surfaced in the submission
must come from a report this script produced.
"""
from __future__ import annotations

import argparse
import json
import mimetypes
import sys
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

# Ensure `backend/app/...` is importable without installing as a package.
REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "backend"))

from app.domain.models import SourceDocument, SourceKind  # noqa: E402
from app.pipeline import PipelineInput, run_pipeline  # noqa: E402

BUNDLES_DIR = REPO_ROOT / "evals" / "datasets"
REPORTS_DIR = REPO_ROOT / "evals" / "reports"


def _kind_from_filename(name: str) -> SourceKind:
    low = name.lower()
    if low.endswith(".pdf"):
        return SourceKind.PDF
    if "chalk" in low or "board" in low:
        return SourceKind.BOARD
    if "instagram" in low or "post" in low:
        return SourceKind.POST
    return SourceKind.PHOTO


def _make_source(path: Path) -> SourceDocument:
    mime, _ = mimetypes.guess_type(str(path))
    return SourceDocument(
        id=f"src-{path.stem}",
        filename=path.name,
        kind=_kind_from_filename(path.name),
        content_type=mime or "application/octet-stream",
        sha256="deadbeef",
    )


def _bundle_inputs(bundle_dir: Path, mode: str) -> list[PipelineInput]:
    inputs: list[PipelineInput] = []
    for path in sorted((bundle_dir / "evidence").iterdir()):
        if path.is_file():
            src = _make_source(path)
            data = path.read_bytes() if mode == "real" else None
            inputs.append(PipelineInput(source=src, data=data, filepath=path))
    return inputs


@dataclass
class BundleMetrics:
    bundle_id: str
    sources_ingested: int
    canonical_count: int
    modifier_count: int
    ephemeral_count: int
    merge_precision: float
    merge_recall: float
    non_merge_accuracy: float
    modifier_routing_accuracy: float
    ephemeral_routing_accuracy: float
    time_to_review_pack_seconds: float
    demo_critical: dict[str, bool]


def _name_set(items: list[Any], key: str) -> set[str]:
    return {i[key] if isinstance(i, dict) else getattr(i, key) for i in items}


def _evaluate_bundle(
    bundle_dir: Path, mode: str
) -> BundleMetrics:
    bundle_id = bundle_dir.name
    expected = json.loads((bundle_dir / "expected.json").read_text(encoding="utf-8"))

    t0 = time.time()
    cockpit = run_pipeline(
        processing_id=f"eval-{bundle_id}",
        batch_id=f"eval-batch-{bundle_id}",
        inputs=_bundle_inputs(bundle_dir, mode),
        mode="real" if mode == "real" else "fallback",
    )
    elapsed = time.time() - t0

    # ----- merges -----
    expected_canonical_names = {c["canonical_name"] for c in expected["canonical_dishes"]}
    produced_names = {d.canonical_name for d in cockpit.canonical_dishes}
    correct_merges = len(expected_canonical_names & produced_names)
    total_expected = len(expected_canonical_names)
    total_produced = len(produced_names)
    merge_precision = (
        correct_merges / total_produced if total_produced else 1.0
    )
    merge_recall = correct_merges / total_expected if total_expected else 1.0

    # ----- non-merges -----
    expected_non_merges = expected.get("expected_non_merges", [])
    non_merge_hits = 0
    for nm in expected_non_merges:
        left = nm["left"]
        right = nm["right"]
        both_present = left in produced_names and right in produced_names
        if both_present:
            non_merge_hits += 1
    non_merge_accuracy = (
        non_merge_hits / len(expected_non_merges)
        if expected_non_merges
        else 1.0
    )

    # ----- modifiers -----
    expected_modifiers = expected.get("expected_modifiers", [])
    produced_modifier_texts = {m.text for m in cockpit.modifiers}
    modifier_hits = sum(
        1 for em in expected_modifiers if em["text"] in produced_modifier_texts
    )
    modifier_acc = (
        modifier_hits / len(expected_modifiers) if expected_modifiers else 1.0
    )

    # ----- ephemerals -----
    expected_ephemeral = expected.get("expected_ephemeral", [])
    produced_ephemeral_texts = {e.text for e in cockpit.ephemerals}
    ephemeral_hits = sum(
        1 for ee in expected_ephemeral if ee["text"] in produced_ephemeral_texts
    )
    ephemeral_acc = (
        ephemeral_hits / len(expected_ephemeral) if expected_ephemeral else 1.0
    )

    # ----- demo-critical -----
    demo_critical: dict[str, bool] = {}
    # Marghertia → Margherita (bundle 01 only)
    if bundle_id == "bundle_01_italian":
        margherita = next(
            (d for d in cockpit.canonical_dishes if d.canonical_name == "Margherita"),
            None,
        )
        demo_critical["marghertia_to_margherita"] = (
            margherita is not None
            and any("Marghertia" in a or a == "Pizza Marghertia" for a in margherita.aliases)
        )
        demo_critical["pizza_vs_calzone_funghi_separate"] = (
            "Pizza Funghi" in produced_names and "Calzone Funghi" in produced_names
        )
        demo_critical["add_burrata_modifier"] = (
            "add burrata +3" in produced_modifier_texts
        )
    if bundle_id == "bundle_02_taqueria":
        demo_critical["tacos_al_pastor_reorder_merge"] = (
            "Tacos al Pastor" in produced_names or "Al Pastor Tacos" in produced_names
        ) and (
            # Merged into a single canonical if either is present but not both.
            not ("Tacos al Pastor" in produced_names and "Al Pastor Tacos" in produced_names)
        )
        demo_critical["add_guacamole_modifier"] = (
            "add guacamole +2" in produced_modifier_texts
        )
    if bundle_id == "bundle_03_bistro":
        demo_critical["chef_special_ephemeral"] = (
            "Chef's Special" in produced_ephemeral_texts
        )

    return BundleMetrics(
        bundle_id=bundle_id,
        sources_ingested=len(cockpit.sources),
        canonical_count=len(cockpit.canonical_dishes),
        modifier_count=len(cockpit.modifiers),
        ephemeral_count=len(cockpit.ephemerals),
        merge_precision=round(merge_precision, 3),
        merge_recall=round(merge_recall, 3),
        non_merge_accuracy=round(non_merge_accuracy, 3),
        modifier_routing_accuracy=round(modifier_acc, 3),
        ephemeral_routing_accuracy=round(ephemeral_acc, 3),
        time_to_review_pack_seconds=round(elapsed, 3),
        demo_critical=demo_critical,
    )


def _aggregate(bundles: list[BundleMetrics]) -> dict[str, Any]:
    if not bundles:
        return {}

    def avg(key: str) -> float:
        return round(sum(getattr(b, key) for b in bundles) / len(bundles), 3)

    return {
        "bundles": len(bundles),
        "merge_precision": avg("merge_precision"),
        "merge_recall": avg("merge_recall"),
        "non_merge_accuracy": avg("non_merge_accuracy"),
        "modifier_routing_accuracy": avg("modifier_routing_accuracy"),
        "ephemeral_routing_accuracy": avg("ephemeral_routing_accuracy"),
        "time_to_review_pack_seconds": avg("time_to_review_pack_seconds"),
        "sources_ingested": sum(b.sources_ingested for b in bundles),
        "canonical_count": sum(b.canonical_count for b in bundles),
        "modifier_count": sum(b.modifier_count for b in bundles),
        "ephemeral_count": sum(b.ephemeral_count for b in bundles),
        "demo_critical_all_pass": all(
            all(b.demo_critical.values()) for b in bundles if b.demo_critical
        ),
    }


def main() -> int:
    parser = argparse.ArgumentParser(prog="run_eval")
    parser.add_argument("--bundle", default="all")
    parser.add_argument("--mode", choices=["fallback", "real"], default="fallback")
    parser.add_argument("--out", default=None)
    args = parser.parse_args()

    if args.bundle == "all":
        bundle_dirs = sorted(d for d in BUNDLES_DIR.iterdir() if d.is_dir())
    else:
        bundle_dirs = [BUNDLES_DIR / args.bundle]

    results: list[BundleMetrics] = []
    for bd in bundle_dirs:
        if not (bd / "expected.json").exists():
            continue
        print(f"[mise] evaluating {bd.name} (mode={args.mode})")
        metrics = _evaluate_bundle(bd, args.mode)
        results.append(metrics)
        print(f"  merge_precision={metrics.merge_precision} "
              f"non_merge_acc={metrics.non_merge_accuracy} "
              f"mod_acc={metrics.modifier_routing_accuracy} "
              f"eph_acc={metrics.ephemeral_routing_accuracy}")
        for k, v in metrics.demo_critical.items():
            mark = "PASS" if v else "FAIL"
            print(f"  [{mark}] {k}")

    report = {
        "mode": args.mode,
        "bundles": [asdict(b) for b in results],
        "aggregate": _aggregate(results),
    }

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    out_path = Path(args.out) if args.out else REPORTS_DIR / f"eval_{args.mode}.json"
    out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"[mise] report written: {out_path}")

    # Return 0 if all demo-critical checks pass, 1 otherwise (useful for CI).
    ok = all(all(m.demo_critical.values()) for m in results if m.demo_critical)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
