#!/usr/bin/env python
"""Search eval harness.

Runs the golden queries in `evals/search_golden.json` against the
fixture dish graph and writes a report to `submissions/metrics.json`.

Why this exists
---------------
The submission must defend every number it claims. This harness gives us:

    * Top-1 accuracy — did the vernacular query land on the correct dish?
    * Top-3 recall — did the correct dish show up in the top 3?
    * Zero-invention rate — for queries the menu cannot satisfy, does
      Mise correctly return zero matches instead of hallucinating?

Modes
-----
    --mode fallback (default)  — deterministic search_fallback. No API
                                  key required. This is the number we
                                  commit to `submissions/metrics.json`.
    --mode real                — calls Opus 4.7 search. Requires
                                  ANTHROPIC_API_KEY. Written to
                                  `evals/reports/search_real.json`.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "backend"))

try:
    from dotenv import load_dotenv

    load_dotenv(REPO_ROOT / ".env")
except ImportError:
    pass

from app.ai.search import search_dishes, search_fallback  # noqa: E402

from fixtures.bistro_argentino import build_fixture  # noqa: E402

GOLDEN_PATH = REPO_ROOT / "evals" / "search_golden.json"
REPORTS_DIR = REPO_ROOT / "evals" / "reports"
METRICS_PATH = REPO_ROOT / "submissions" / "metrics.json"


def _run(mode: str) -> dict:
    golden = json.loads(GOLDEN_PATH.read_text(encoding="utf-8"))
    cockpit = build_fixture()

    use_real = mode == "real"
    if use_real and not os.environ.get("ANTHROPIC_API_KEY"):
        print("[search-eval] --mode real requires ANTHROPIC_API_KEY", file=sys.stderr)
        sys.exit(2)

    def search(q: str):
        return (
            search_dishes(query=q, cockpit=cockpit, top_k=5)
            if use_real
            else search_fallback(query=q, cockpit=cockpit, top_k=5)
        )

    positives = golden["queries"]
    negatives = golden.get("negatives", [])

    top1_hits = 0
    top3_hits = 0
    query_rows: list[dict] = []
    per_query_latencies: list[int] = []

    t0 = time.time()
    for row in positives:
        q = row["query"]
        expected = row["expected_top_1"]
        r = search(q)
        ids = [m.dish_id for m in r.matches]
        top1 = ids[0] if ids else None
        hit1 = top1 == expected
        hit3 = expected in ids[:3]
        if hit1:
            top1_hits += 1
        if hit3:
            top3_hits += 1
        per_query_latencies.append(r.latency_ms)
        query_rows.append(
            {
                "query": q,
                "intent": row.get("intent", ""),
                "expected_top_1": expected,
                "top_1": top1,
                "top_3": ids[:3],
                "hit@1": hit1,
                "hit@3": hit3,
                "latency_ms": r.latency_ms,
            }
        )

    non_invent_hits = 0
    neg_rows: list[dict] = []
    for row in negatives:
        q = row["query"]
        r = search(q)
        # Fallback considers it "no invention" when it returns zero matches.
        # Real mode is stricter: the model must explicitly decline. We
        # accept both "empty matches" and "interpretation includes
        # refusal language".
        refused = len(r.matches) == 0 or any(
            phrase in r.interpretation.lower()
            for phrase in ("no ", "not on this menu", "cannot", "won't invent")
        )
        if refused:
            non_invent_hits += 1
        neg_rows.append(
            {
                "query": q,
                "returned_matches": len(r.matches),
                "interpretation": r.interpretation,
                "refused": refused,
            }
        )

    elapsed_s = round(time.time() - t0, 3)
    p = len(positives)
    n = len(negatives)
    report = {
        "mode": mode,
        "fixture": golden.get("fixture", "bistro_argentino"),
        "positives_count": p,
        "negatives_count": n,
        "top1_accuracy": round(top1_hits / p, 3) if p else None,
        "top3_accuracy": round(top3_hits / p, 3) if p else None,
        "zero_invention_rate": round(non_invent_hits / n, 3) if n else None,
        "avg_latency_ms": (
            round(sum(per_query_latencies) / max(1, len(per_query_latencies)), 1)
        ),
        "total_wall_seconds": elapsed_s,
        "positives": query_rows,
        "negatives": neg_rows,
    }
    return report


def _write_submission_metrics(report: dict) -> None:
    """Publish a narrow, honest slice of the eval for the submission.

    submissions/metrics.json is what the README cites. It only contains
    numbers that came out of this run — no aspirational values, no
    unrelated legacy fields.
    """
    payload = {
        "fixture": report["fixture"],
        "mode": report["mode"],
        "positives_count": report["positives_count"],
        "negatives_count": report["negatives_count"],
        "top1_accuracy": report["top1_accuracy"],
        "top3_accuracy": report["top3_accuracy"],
        "zero_invention_rate": report["zero_invention_rate"],
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "reproduce_with": "python evals/run_search_eval.py --mode fallback",
    }
    METRICS_PATH.parent.mkdir(parents=True, exist_ok=True)
    METRICS_PATH.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(prog="run_search_eval")
    parser.add_argument("--mode", choices=["fallback", "real"], default="fallback")
    parser.add_argument(
        "--no-publish",
        action="store_true",
        help="Do not overwrite submissions/metrics.json (useful for experiments).",
    )
    args = parser.parse_args()

    report = _run(args.mode)

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    out_path = REPORTS_DIR / f"search_{args.mode}.json"
    out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(f"[search-eval] fixture={report['fixture']} mode={args.mode}")
    print(f"  top1  = {report['top1_accuracy']}")
    print(f"  top3  = {report['top3_accuracy']}")
    print(f"  zero_invention = {report['zero_invention_rate']}")
    print(f"  avg latency = {report['avg_latency_ms']} ms")
    print(f"  report: {out_path}")

    if args.mode == "fallback" and not args.no_publish:
        _write_submission_metrics(report)
        print(f"  submission metrics: {METRICS_PATH}")

    # Exit nonzero when top1 dropped below 0.75 so CI catches regressions.
    ok = (report["top1_accuracy"] or 0.0) >= 0.75 and (
        report["zero_invention_rate"] or 0.0
    ) >= 0.66
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
