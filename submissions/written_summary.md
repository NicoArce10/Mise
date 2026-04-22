# Mise — Hackathon Written Summary

> Every number below is copied verbatim from `submissions/metrics.json`, which mirrors the latest `evals/reports/eval_real.json`. **Measured on live `claude-opus-4-7` via the Anthropic Messages API on 2026-04-21.** Re-run `python evals/run_eval.py --bundle all --mode real` to regenerate.

## Problem

I'm building a dish-first review app in beta in Argentina. Every restaurant I add, I do it by hand: I feed screenshots and PDFs into Claude Code, then clean the output myself, one record at a time. It works. It does not scale. And it taught me something I did not expect when I started: **the hard problem of a dish-first app is not the UI. It is turning messy restaurant reality into clean, structured, searchable dish records.**

Menus arrive as PDFs, screenshots, Instagram posts, chalkboards, and inconsistent naming across branches. The same plate appears as `Marghertia` on a scanned PDF, `Margherita` on a POS export, and `Margheritta Napoletana` on a hand-edited image — three strings, one dish, zero trust. When that identity layer breaks, search fragments, reviews split across duplicates, analytics lie, and the product stops feeling trustworthy. This is not a feature I invented for the hackathon. It is the bottleneck I have been working around since I started loading restaurants myself.

## User

Me first — a solo builder onboarding restaurants by hand on weekends. The same wall is hit at scale by **catalog operations teams at food platforms, delivery aggregators, multi-location restaurant groups, and restaurant software companies** — the people whose job is turning multi-source menu evidence into a single canonical record the rest of the business can query. Today they work across PDFs, CSV exports, and photographs with spreadsheets and judgement. They cannot explain the merges they made a week later, and nobody audits them until something goes wrong in production. Mise is the ingestion engine I needed; it is the same bottleneck they hire teams to manage.

## Solution

Evidence in: PDFs, images, CSVs, chalkboards, Instagram posts. Canonical pack out: dishes, aliases, ingredients, modifiers, ephemerals — each one with provenance back to every source, a confidence number, and a one-line decision summary. The hero frame of the demo says it in eight words: **three messy sources in, one trustworthy dish record out**. Claude Opus 4.7 is used where the mess is human — extracting candidates, spotting duplicates, proposing canonical names. Everything else is deterministic: a pure-Python gate decides merges on normalized strings, a router classifies candidates as canonical / modifier / ephemeral, and a JSON schema validates every LLM output before anything reaches the Cockpit. A human still approves, but the work moves from *"compare tabs in a spreadsheet"* to *"read a decision and click Approve, Edit, or Reject."*

## Why Opus 4.7

Mise uses Claude Opus 4.7 along four pillars, each visible in the product rather than declared in a slide:

1. **Vision-native ingestion.** PDFs go to Opus 4.7 as native `document` blocks; photos and chalkboards go as base64 `image` blocks. No external OCR in the critical path.
2. **Adaptive thinking with a deterministic gate.** A pure-Python classifier (`reconciliation/gate.py`) splits every candidate pair into `OBVIOUS_MERGE`, `OBVIOUS_NON_MERGE`, or `AMBIGUOUS`. Only AMBIGUOUS pairs enable `thinking: {"type": "adaptive"}`. Deep reasoning is reserved for the cases that need it; the cheap ones never touch the model.
3. **Structured output with deterministic validation.** Every call uses `output_config.format = {type: "json_schema", ...}` and is parsed into Pydantic models. A `ValidationError` triggers exactly one tightened retry; a second failure is a hard fail. Reasoning and safety are separated by design.
4. **Decision summaries in the Cockpit, not raw thinking traces.** Every canonical dish, modifier, and ephemeral carries a ≤240-character summary with provenance and confidence. The model's internal thinking is never forwarded to the UI.

All four pillars are exercised and verified by the 53-test backend suite (`pytest -q`), including explicit guardrail tests that assert no `temperature`, `top_p`, `top_k`, or `budget_tokens` is ever sent.

## Measured outcomes

Produced by `python evals/run_eval.py --bundle all --mode real` against live `claude-opus-4-7` on 2026-04-21. Raw report: `evals/reports/eval_real.json` (mirrored in `submissions/metrics.json`).

| Metric | Value |
|---|---|
| Bundles evaluated | 3 |
| Sources ingested (all bundles) | 10 |
| Canonical dishes produced | 15 |
| Modifiers routed | 5 |
| Ephemerals routed | 2 |
| Merge precision | 0.94 |
| Merge recall | 1.00 |
| Non-merge accuracy | 1.00 |
| Modifier routing accuracy | 1.00 |
| Ephemeral routing accuracy¹ | 0.67 |
| Time to review pack (aggregate) | 37.80 s |
| Total Opus 4.7 calls | 23 (10 extraction + 13 reconciliation) |
| Cache hit ratio on input tokens | 46.1% |
| Live-run cost | USD 0.96 |

¹ *Harness artifact, not product quality. The `expected.json` for bundle_03 lists `Chef's Special` as the ephemeral label; Opus 4.7 surfaced `Today's Chef's Special` with the ephemeral flag set. The accuracy metric uses literal equality, so it under-counts a correct routing. The `demo_critical.chef_special_ephemeral` check uses substring match and passes.*

All six demo-critical decisions passed in this run:

- `Marghertia` → `Margherita` — merged after typo normalization across three branches, adaptive thinking engaged.
- `Pizza Funghi` vs `Calzone Funghi` — kept separate on `type_differ` despite ingredient overlap.
- `add burrata +3` — routed as modifier attached to the Margherita dish on the same source.
- `Tacos al Pastor` vs `Al Pastor Tacos` — merged after token-order normalization, zero LLM call (deterministic gate).
- `add guacamole +2` — routed as unattached modifier (chalkboard had no parent dish).
- `Chef's Special` — routed as ephemeral via the extractor's `is_ephemeral_candidate` flag.

## Architecture at a glance

Four pure layers, one contract. **Evidence ingest** stores bytes and metadata in a process-local store. **Extraction** sends each source to Opus 4.7 vision. **Reconciliation** runs a deterministic gate and only calls Opus with adaptive thinking on `AMBIGUOUS` pairs. **Routing and validation** classify every candidate as canonical / modifier / ephemeral and enforce the JSON schema. The Cockpit reads one `GET /api/review/{processing_id}` and renders the entire review pack with decision summaries, provenance, and the metrics pane driven by the latest eval report.

## Links

- **Demo video:** `<YouTube unlisted URL — to be filled on submission day>` (≤ 3:00, ≥ 2:45)
- **Repo:** <https://github.com/NicoArce10/Mise>
- **License:** MIT (see `LICENSE`)
- **Live metrics:** `submissions/metrics.json` → mirrors `evals/reports/eval_real.json` (live `claude-opus-4-7` run on 2026-04-21)
- **Eval harness:** `python evals/run_eval.py --bundle all --mode real`
- **Preflight gates:** `docs/preflight.md`

## Acknowledgement

The ingestion engine is brand-new and built from scratch for this hackathon. It reuses no code, no schema, and no assets from any prior product. All restaurant menu material shown in the demo and in `evals/datasets/` was either created for this hackathon or used with explicit written permission from its owner. The builder's personal experience onboarding restaurants by hand is narrative framing, not code reuse.

---

<!--
Authoring checklist (delete before submitting):
- [ ] Every numeric value in "Measured outcomes" is copy-pasted from submissions/metrics.json
- [ ] Every claim in "Why Opus 4.7" maps to a visible element in the demo video
- [ ] No reuse of prior-product code, schema, or assets anywhere in this document or repo
- [ ] Builder's personal narrative is first-person, specific, and honest (no selling)
- [ ] If a real restaurant menu is shown, written permission is on file (e.g., WhatsApp screenshot)
- [ ] Video URL verified by opening it in an incognito tab
- [ ] Repo URL verified by opening it in an incognito tab
- [ ] Word count under 600 (judges skim)
-->
