# Mise Evaluation Harness

## Purpose
Produce measured, reportable evidence for the two claims Mise publishes:

1. The **identity graph** handles merge / non-merge / modifier / ephemeral decisions correctly.
2. The **search layer** resolves diner-style queries without inventing dishes.

Numbers surfaced in the demo video, written summary, and README come from these harnesses — never from estimation.

## Scope
Small enough to build and run in the hackathon window. Large enough to be credible.

- 3 synthetic restaurant bundles
- 30 to 50 evidence artifacts total
- Every demo-critical decision present at least once
- Runnable end-to-end with one command

## Dataset structure

All assets live under `evals/datasets/` and are authored by the team for the hackathon. No external sources, no real restaurant logos.

```
evals/
  datasets/
    bundle_01_italian/
      evidence/
        menu_pdf_branch_a.pdf
        menu_photo_branch_b.jpg
        chalkboard_branch_c.jpg
        instagram_post_special.png
      expected.json
    bundle_02_taqueria/
      evidence/
        menu_pdf_main.pdf
        menu_screenshot_delivery.png
        modifiers_chalkboard.jpg
      expected.json
    bundle_03_bistro/
      evidence/
        menu_pdf_dinner.pdf
        menu_pdf_lunch.pdf
        chef_special_board.jpg
      expected.json
  run_eval.py
  report_template.md
```

### Bundle 01 — Italian trattoria (three branches)
Carries the `Marghertia -> Margherita` typo case and the `Pizza Funghi != Calzone Funghi` non-merge case. Three branches with overlapping menus and minor name drift.

### Bundle 02 — Taqueria
Carries the `add guacamole +2` modifier case. Chalkboard photo contains inline modifiers that must not become dishes of their own.

### Bundle 03 — Modern bistro
Carries the `Chef's special` ephemeral case. Two stable menus plus one daily board photo whose items must be routed as ephemeral, not merged into the canonical catalog.

## `expected.json` schema

Each bundle ships a ground-truth file with this exact shape:

```json
{
  "bundle_id": "bundle_01_italian",
  "canonical_dishes": [
    {
      "canonical_name": "Margherita",
      "expected_aliases": ["Marghertia", "Pizza Margherita"],
      "expected_sources": ["menu_pdf_branch_a.pdf", "menu_photo_branch_b.jpg"],
      "expected_modifiers": [],
      "expected_route": "canonical"
    }
  ],
  "expected_non_merges": [
    {
      "left": "Pizza Funghi",
      "right": "Calzone Funghi",
      "reason": "different_dish_type"
    }
  ],
  "expected_modifiers": [
    { "text": "add burrata +3", "parent_dish": "Margherita" }
  ],
  "expected_ephemeral": []
}
```

## Metrics

All metrics are computed per bundle and aggregated.

| Metric | Definition | Target |
|---|---|---|
| `merge_precision` | correct merges / (correct merges + incorrect merges) | report measured value |
| `merge_recall` | correct merges / (correct merges + missed merges) | report measured value |
| `non_merge_accuracy` | correct non-merges / total expected non-merges | report measured value |
| `modifier_routing_accuracy` | modifiers correctly routed / total expected modifiers | report measured value |
| `ephemeral_routing_accuracy` | ephemerals correctly routed / total expected ephemerals | report measured value |
| `time_to_review_pack_seconds` | wall-clock seconds from ingestion start to cockpit-ready state | report measured value |

Rule: **never publish a number that was not produced by this harness**. If a metric cannot be computed in time, it is removed from the submission — not estimated.

## Run instructions

From repository root:

```bash
python evals/run_eval.py --bundle all --out evals/reports/$(date +%Y-%m-%d).json
```

Per-bundle run:

```bash
python evals/run_eval.py --bundle bundle_01_italian --out evals/reports/italian.json
```

Output is a single JSON file with per-bundle metrics and an aggregate section. A Markdown report is generated alongside it using `evals/report_template.md`.

## What counts as success for submission

Minimum bar for the submission to quote metrics in the video and written summary:

- All three bundles run end-to-end without crashes
- `merge_precision` is computed on at least 3 positive merge cases
- Each demo-critical decision is present in at least one bundle and correctly handled at least once in the reported run
- `time_to_review_pack_seconds` is reported honestly, including any human wait for adaptive thinking

## What we do not evaluate
- Subjective UI quality of the cockpit
- Qualitative prompt wording
- Anything requiring external data sources

These are out of scope for the harness by design. The harness measures pipeline correctness only.

## Search metrics

`submissions/metrics.json` is intentionally narrow: it contains the search
numbers quoted in the written summary. Reproduce it with:

```bash
python evals/run_search_eval.py --mode fallback
```

That harness grades `evals/search_golden.json` against
`evals/fixtures/bistro_argentino.py` and reports:

- `top1_accuracy`
- `top3_accuracy`
- `zero_invention_rate`

Identity-graph metrics stay in the `run_eval.py` report; search metrics stay
in `submissions/metrics.json`. Do not mix the two in copy unless both files
are shown or cited explicitly.
