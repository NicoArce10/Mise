# Mise — Hackathon Written Summary

> Template. Populate on submission day. Every number below must come from `submissions/metrics.json`. Every sentence must be consistent with the demo video.

## Problem
<!-- One paragraph. Enterprise-framed. Draw from docs/product.md "Problem" section. Describe why dish identity fragments across evidence sources and why this breaks downstream products. -->

## User
<!-- One paragraph. Name the users from docs/product.md and describe their current pain in operational terms. -->

## Solution
<!-- One paragraph introducing Mise as the trust layer for dish-level menu data. End with the hero-frame description: three messy sources in, one trustworthy dish record out. -->

## Why Opus 4.7
<!-- One paragraph. Four pillars condensed:
1. Vision-native ingestion (no external OCR in the critical path)
2. Adaptive thinking on ambiguous reconciliations, invoked selectively by a deterministic gate
3. Structured output plus deterministic validation — reasoning and safety separated by design
4. Decision summaries with provenance and confidence in the Cockpit — not raw thinking traces
-->

## Measured outcomes

Produced by `evals/run_eval.py --bundle all`, run on <YYYY-MM-DD HH:MM TZ>. Raw report: `submissions/metrics.json`.

| Metric | Value |
|---|---|
| Sources ingested (all bundles) | <fill from metrics.json> |
| Canonical dishes produced | <fill> |
| Modifiers routed | <fill> |
| Ephemerals routed | <fill> |
| Merge precision | <fill> |
| Merge recall | <fill> |
| Non-merge accuracy | <fill> |
| Modifier routing accuracy | <fill> |
| Ephemeral routing accuracy | <fill> |
| Time to review pack (p50) | <fill, in seconds> |

All four demo-critical decisions passed in this run:
- `Marghertia` → `Margherita` — merged
- `Pizza Funghi` and `Calzone Funghi` — kept separate
- `add burrata +3` — routed as modifier
- `Chef's special` — routed as ephemeral

## Architecture at a glance
<!-- Two or three sentences. Point to the four-layer design:
Evidence ingest → Extraction (Opus 4.7 vision) → Reconciliation (deterministic rule + Opus 4.7 adaptive thinking on ambiguous cases) → Routing + validation → Cockpit. -->

## Links

- **Demo video:** `<YouTube unlisted URL>` (≤ 3 minutes)
- **Repo:** `<GitHub URL>`
- **License:** MIT (see `LICENSE`)

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
- [ ] Word count under 600 (judges skim)
-->
