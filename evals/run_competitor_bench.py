#!/usr/bin/env python
"""Side-by-side benchmark harness: Mise vs Veryfi Menu Parser.

The purpose of this script is to produce an honest, reproducible
comparison between Mise's `/api/catalog` output and Veryfi's
`/api/v8/partner/menus/` response for the same menu file.

Usage
-----
    # Run Mise only (no Veryfi credentials required):
    python evals/run_competitor_bench.py --bundle bundle_01_italian --mise-mode real

    # Run both (needs Veryfi credentials):
    export VERYFI_CLIENT_ID=...
    export VERYFI_USERNAME=...
    export VERYFI_API_KEY=...
    python evals/run_competitor_bench.py --bundle bundle_01_italian --mise-mode real --with-veryfi

What the script measures
------------------------
1.  **Wall-clock latency** from file upload to structured JSON response.
2.  **Coverage**: number of dishes returned.
3.  **Alias support**: whether each dish carries an aliases/synonyms field.
4.  **Search-term support**: whether each dish carries diner-vernacular search terms.
5.  **LTO / daily-special lane**: whether daily specials are returned in a
    separate bucket from the canonical menu.

No metric is ever estimated. Every row in the generated report comes from
an actual API call this script made in this run.

Output
------
A Markdown report in ``evals/reports/competitor_<bundle>_<timestamp>.md``
and a JSON version alongside it for downstream processing.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "backend"))

try:
    from dotenv import load_dotenv

    load_dotenv(REPO_ROOT / ".env")
except ImportError:
    pass

from app.domain.models import SourceDocument, SourceKind  # noqa: E402
from app.pipeline import PipelineInput, run_pipeline  # noqa: E402

BUNDLES_DIR = REPO_ROOT / "evals" / "datasets"
REPORTS_DIR = REPO_ROOT / "evals" / "reports"


@dataclass
class EngineResult:
    engine: str
    ok: bool
    latency_seconds: float
    dish_count: int
    has_aliases: bool
    has_search_terms: bool
    has_lto_lane: bool
    raw: dict[str, Any] = field(default_factory=dict)
    error: str | None = None


def _first_menu_file(bundle_dir: Path) -> Path:
    evidence = bundle_dir / "evidence"
    if not evidence.exists():
        raise FileNotFoundError(f"No evidence/ dir in {bundle_dir}")
    for candidate in sorted(evidence.iterdir()):
        if candidate.is_file() and candidate.suffix.lower() in {
            ".pdf",
            ".jpg",
            ".jpeg",
            ".png",
            ".webp",
        }:
            return candidate
    raise FileNotFoundError(f"No menu file in {evidence}")


def _run_mise(menu_path: Path, mode: str) -> EngineResult:
    kind = {
        ".pdf": SourceKind.PDF,
        ".jpg": SourceKind.PHOTO,
        ".jpeg": SourceKind.PHOTO,
        ".png": SourceKind.PHOTO,
        ".webp": SourceKind.PHOTO,
    }[menu_path.suffix.lower()]

    data = menu_path.read_bytes()
    source = SourceDocument(
        name=menu_path.name,
        kind=kind,
        mime=f"image/{menu_path.suffix[1:]}" if kind != SourceKind.PDF else "application/pdf",
        data=data,
    )

    started = time.perf_counter()
    try:
        cockpit = run_pipeline(
            PipelineInput(sources=[source], mode=mode),
        )
        latency = time.perf_counter() - started

        has_aliases = any(d.aliases for d in cockpit.canonical_dishes)
        has_search_terms = any(getattr(d, "search_terms", None) for d in cockpit.canonical_dishes)
        has_lto_lane = len(cockpit.ephemerals) > 0 or any(
            getattr(d, "ephemeral", False) for d in cockpit.canonical_dishes
        )

        return EngineResult(
            engine="mise",
            ok=True,
            latency_seconds=round(latency, 2),
            dish_count=len(cockpit.canonical_dishes),
            has_aliases=has_aliases,
            has_search_terms=has_search_terms,
            has_lto_lane=has_lto_lane,
            raw={
                "canonical_dishes": [d.canonical_name for d in cockpit.canonical_dishes],
                "ephemerals": [e.name for e in cockpit.ephemerals],
            },
        )
    except Exception as exc:  # noqa: BLE001
        return EngineResult(
            engine="mise",
            ok=False,
            latency_seconds=round(time.perf_counter() - started, 2),
            dish_count=0,
            has_aliases=False,
            has_search_terms=False,
            has_lto_lane=False,
            error=str(exc),
        )


def _run_veryfi(menu_path: Path) -> EngineResult:
    """Hit Veryfi's menu parser API. Returns ok=False if creds are missing."""
    required = ("VERYFI_CLIENT_ID", "VERYFI_USERNAME", "VERYFI_API_KEY")
    if any(not os.environ.get(k) for k in required):
        return EngineResult(
            engine="veryfi",
            ok=False,
            latency_seconds=0.0,
            dish_count=0,
            has_aliases=False,
            has_search_terms=False,
            has_lto_lane=False,
            error=(
                "Skipped — set VERYFI_CLIENT_ID / VERYFI_USERNAME / VERYFI_API_KEY "
                "to run against the real Veryfi Menu Parser."
            ),
        )

    try:
        import httpx  # noqa: PLC0415
    except ImportError:
        return EngineResult(
            engine="veryfi",
            ok=False,
            latency_seconds=0.0,
            dish_count=0,
            has_aliases=False,
            has_search_terms=False,
            has_lto_lane=False,
            error="httpx not installed — run `pip install httpx`.",
        )

    import base64  # noqa: PLC0415

    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "CLIENT-ID": os.environ["VERYFI_CLIENT_ID"],
        "AUTHORIZATION": f'apikey {os.environ["VERYFI_USERNAME"]}:{os.environ["VERYFI_API_KEY"]}',
    }
    payload = {
        "file_name": menu_path.name,
        "file_data": base64.b64encode(menu_path.read_bytes()).decode("ascii"),
    }

    started = time.perf_counter()
    try:
        response = httpx.post(
            "https://api.veryfi.com/api/v8/partner/menus/",
            headers=headers,
            json=payload,
            timeout=120.0,
        )
        latency = time.perf_counter() - started
        response.raise_for_status()
        data = response.json()
    except Exception as exc:  # noqa: BLE001
        return EngineResult(
            engine="veryfi",
            ok=False,
            latency_seconds=round(time.perf_counter() - started, 2),
            dish_count=0,
            has_aliases=False,
            has_search_terms=False,
            has_lto_lane=False,
            error=f"Veryfi API error: {exc}",
        )

    # Veryfi returns { "line_items": [ { "name": ..., "price": ..., "category": ... } ] }
    # — per current docs at https://www.veryfi.com/api/restaurant-menu-ocr/
    items = data.get("line_items") or data.get("items") or []
    names = [str(item.get("name") or item.get("title") or "").strip() for item in items]
    names = [n for n in names if n]

    has_aliases = any(
        "aliases" in item or "synonyms" in item or "also_known_as" in item for item in items
    )
    has_search_terms = any(
        "search_terms" in item or "vernacular" in item for item in items
    )
    # Veryfi does not distinguish a "daily specials" lane in its public schema.
    has_lto_lane = "specials" in data or "limited_time_offers" in data

    return EngineResult(
        engine="veryfi",
        ok=True,
        latency_seconds=round(latency, 2),
        dish_count=len(names),
        has_aliases=has_aliases,
        has_search_terms=has_search_terms,
        has_lto_lane=has_lto_lane,
        raw={"dish_names": names[:40]},
    )


def _render_markdown(bundle: str, menu_path: Path, results: list[EngineResult]) -> str:
    lines = [
        f"# Competitor benchmark · {bundle}",
        "",
        f"- **Bundle**: `{bundle}`",
        f"- **Input file**: `{menu_path.relative_to(REPO_ROOT)}`",
        f"- **Ran at**: {time.strftime('%Y-%m-%d %H:%M:%S %Z')}",
        "",
        "## Results",
        "",
        "| Engine | OK | Latency (s) | Dishes returned | Aliases | Search terms | Daily-specials lane |",
        "|--------|----|-------------|-----------------|---------|--------------|---------------------|",
    ]
    for r in results:
        lines.append(
            f"| {r.engine} | {'✅' if r.ok else '❌'} | "
            f"{r.latency_seconds} | {r.dish_count} | "
            f"{'yes' if r.has_aliases else 'no'} | "
            f"{'yes' if r.has_search_terms else 'no'} | "
            f"{'yes' if r.has_lto_lane else 'no'} |"
        )
    lines.append("")
    for r in results:
        if r.error:
            lines.extend([f"### {r.engine} — notes", "", f"> {r.error}", ""])
    lines.append("## Methodology")
    lines.append("")
    lines.append(
        "This report is generated by `evals/run_competitor_bench.py`. "
        "It runs each engine on the **same input file** and records "
        "wall-clock latency plus the presence/absence of five downstream-relevant "
        "fields. See `docs/competitive_benchmark.md` for scoring definitions "
        "and why those fields matter for onboarding and search."
    )
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", required=True, help="e.g. bundle_01_italian")
    parser.add_argument(
        "--mise-mode", default="fallback", choices=("fallback", "real"),
        help="'real' hits Opus 4.7 (needs ANTHROPIC_API_KEY); 'fallback' is deterministic.",
    )
    parser.add_argument(
        "--with-veryfi", action="store_true",
        help="Also call Veryfi's Menu Parser API.",
    )
    args = parser.parse_args()

    bundle_dir = BUNDLES_DIR / args.bundle
    if not bundle_dir.exists():
        print(f"✗ Bundle not found: {bundle_dir}", file=sys.stderr)
        return 1

    menu_path = _first_menu_file(bundle_dir)
    print(f"→ Input file: {menu_path.name}")

    results: list[EngineResult] = []

    print("→ Running Mise...")
    results.append(_run_mise(menu_path, args.mise_mode))
    print(f"  Mise: {results[-1].dish_count} dishes in {results[-1].latency_seconds}s")

    if args.with_veryfi:
        print("→ Running Veryfi...")
        results.append(_run_veryfi(menu_path))
        last = results[-1]
        if last.ok:
            print(f"  Veryfi: {last.dish_count} dishes in {last.latency_seconds}s")
        else:
            print(f"  Veryfi: {last.error}")

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    stamp = time.strftime("%Y%m%d_%H%M%S")
    md_path = REPORTS_DIR / f"competitor_{args.bundle}_{stamp}.md"
    json_path = REPORTS_DIR / f"competitor_{args.bundle}_{stamp}.json"

    md_path.write_text(_render_markdown(args.bundle, menu_path, results), encoding="utf-8")
    json_path.write_text(
        json.dumps(
            {
                "bundle": args.bundle,
                "input": str(menu_path.relative_to(REPO_ROOT)),
                "results": [r.__dict__ for r in results],
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    print(f"\n✓ Report: {md_path.relative_to(REPO_ROOT)}")
    print(f"✓ Raw:    {json_path.relative_to(REPO_ROOT)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
