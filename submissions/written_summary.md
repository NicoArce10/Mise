# Mise — Hackathon Written Summary

> Draft prepared ahead of submission day. Every number below is copied verbatim from `submissions/metrics.json`, which in turn reflects `evals/reports/eval_fallback.json`. Re-run `python evals/run_eval.py --bundle all` and refresh this file if anything upstream changes.

## Problem

Dish identity fragments across evidence. The same plate appears as `Marghertia` on a scanned PDF, `Margherita` in a POS export, and `Margheritta Napoletana` on a hand-edited image — three strings, one dish, zero trust. Every product downstream (delivery apps, POS catalogs, nutrition databases, price tiers) either inherits the mess or builds a bespoke reconciliation layer no one else can audit. The catalog operations team ends up doing it by hand, one tab at a time, with no evidence trail.

## User

Catalog operations at restaurant platforms — the people responsible for turning multi-source menu evidence into a single canonical record the rest of the business can query. Today they work across PDFs, CSV exports, and photographs with spreadsheets and judgement. They cannot explain the merges they made a week later, and nobody audits them until something goes wrong in production.

## Solution

Mise is the trust layer for dish-level menu data. Evidence in: PDFs, images, CSVs. Canonical pack out: dishes, aliases, ingredients, modifiers, ephemerals, each one with provenance, a confidence number, and a one-line decision summary. The hero frame of the demo says it in eight words: **three messy sources in, one trustworthy dish record out**. A human still approves, but the work moves from "compare tabs" to "read a decision and click."

## Why Opus 4.7

Mise uses Claude Opus 4.7 along four pillars, each visible in the product rather than declared in a slide:

1. **Vision-native ingestion.** PDFs and photos go to Opus as base64 `image` blocks. No external OCR in the critical path.
2. **Adaptive thinking with a deterministic gate.** A pure-Python classifier (`reconciliation/gate.py`) splits every candidate pair into `OBVIOUS_MERGE`, `OBVIOUS_NON_MERGE`, or `AMBIGUOUS`. Only AMBIGUOUS pairs enable `thinking: {"type": "adaptive"}`. Deep reasoning is reserved for the cases that need it; the cheap ones never touch the model.
3. **Structured output with deterministic validation.** Every call uses `output_config.format = {type: "json_schema", ...}` and is parsed into Pydantic models. A `ValidationError` triggers exactly one tightened retry; a second failure is a hard fail. Reasoning and safety are separated by design.
4. **Decision summaries in the Cockpit, not raw thinking traces.** Every canonical dish, modifier, and ephemeral carries a ≤240-character summary with provenance and confidence. The model's internal thinking is never forwarded to the UI.

All four pillars are exercised and verified by the 53-test backend suite (`pytest -q`), including explicit guardrail tests that assert no `temperature`, `top_p`, `top_k`, or `budget_tokens` is ever sent.

## Measured outcomes

Produced by `python evals/run_eval.py --bundle all`, mode `fallback`, run on 2026-04-21. Raw report: `submissions/metrics.json`. Re-run against `MISE_PIPELINE_MODE=real` before the final submission will replace these numbers (the harness writes `evals/reports/*.json` which the Cockpit reads at run time).

| Metric | Value |
|---|---|
| Bundles evaluated | 3 |
| Sources ingested (all bundles) | 10 |
| Canonical dishes produced | 14 |
| Modifiers routed | 5 |
| Ephemerals routed | 2 |
| Merge precision | 1.00 |
| Merge recall | 0.917 |
| Non-merge accuracy | 1.00 |
| Modifier routing accuracy | 1.00 |
| Ephemeral routing accuracy | 1.00 |
| Time to review pack (aggregate) | 0.045 s |

All four demo-critical decisions passed in this run:

- `Marghertia` → `Margherita` — merged, typo preserved as alias, adaptive thinking engaged.
- `Pizza Funghi` and `Calzone Funghi` — kept separate on `type_differ`.
- `add burrata +3` — routed as modifier, attached to the Margherita dish on the same source.
- `Chef's special` — routed as ephemeral on the ephemeral-hint regex.

## Architecture at a glance

Four pure layers, one contract. **Evidence ingest** stores bytes and metadata in a process-local store. **Extraction** sends each source to Opus 4.7 vision. **Reconciliation** runs a deterministic gate and only calls Opus with adaptive thinking on `AMBIGUOUS` pairs. **Routing and validation** classify every candidate as canonical / modifier / ephemeral and enforce the JSON schema. The Cockpit reads one `GET /api/review/{processing_id}` and renders the entire review pack with decision summaries, provenance, and the metrics pane driven by the latest eval report.

## Links

- **Demo video:** `<YouTube unlisted URL — to be filled on submission day>` (≤ 3:00, ≥ 2:45)
- **Repo:** <https://github.com/NicoArce10/Mise>
- **License:** MIT (see `LICENSE`)
- **Live metrics:** `submissions/metrics.json` → mirrors `evals/reports/eval_fallback.json`
- **Eval harness:** `python evals/run_eval.py --bundle all`
- **Preflight gates:** `docs/preflight.md`

## Acknowledgement

All assets in the demo and in `evals/datasets/` were created for this hackathon. No external restaurant names, logos, or menus were used.

---

<!--
Authoring checklist (delete before submitting):
- [ ] Every numeric value in "Measured outcomes" is copy-pasted from submissions/metrics.json
- [ ] Every claim in "Why Opus 4.7" maps to a visible element in the demo video
- [ ] No prior-product reference anywhere in this document
- [ ] Video URL verified by opening it in an incognito tab
- [ ] Repo URL verified by opening it in an incognito tab
- [ ] Word count under 600 (judges skim) — currently ~580 excluding the comment block
-->
