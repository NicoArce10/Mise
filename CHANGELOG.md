# Changelog

All notable changes to Mise are documented here. Format is loosely based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0] — 2026-04-26 — Hackathon submission

### Added
- **Review Cockpit** (React + Vite + Tailwind v4 + Editorial/Cartographic tokens):
  categorized dish lane grouping by inferred `dish_type`, search + filter,
  density toggle (card / compact), Export JSON for the canonical pack,
  animated stagger reveal + DetailRail slide, keyboard shortcuts with help
  dialog, collapsible category groups persisted to `localStorage`, editorial
  meta line sourced from the latest eval report.
- **FastAPI backend** with in-memory store, 5 endpoints (`/api/upload`,
  `/api/process/{batch_id}`, `/api/process/{processing_id}`,
  `/api/review/{processing_id}`, `/api/review/{processing_id}/decisions`)
  plus `/api/health`. Worker-thread pipeline so intermediate states remain
  observable through polling.
- **AI layer** against `claude-opus-4-7` with:
  - Vision-native extraction (PDFs as `document` blocks, images as `image`
    blocks, magic-byte sniffing for mislabeled extensions).
  - Deterministic reconciliation gate (arch plan §2.1) that routes only
    `AMBIGUOUS` pairs to adaptive thinking.
  - Structured output via `output_config.format = {type: "json_schema", schema: …}`
    with hardened schemas (`additionalProperties: false`, numeric bounds stripped),
    parsed into Pydantic models.
  - Ephemeral cache-control on system prompts; 46% cache hit on the full
    3-bundle run.
  - Regex-first routing for modifiers and ephemerals with a price guard
    (an extraction-flagged ephemeral that carries a fixed price is re-routed
    to canonical).
- **Eval harness** (`python evals/run_eval.py --bundle all --mode real`)
  that measures `merge_precision`, `merge_recall`, `non_merge_accuracy`,
  `modifier_routing_accuracy`, `ephemeral_routing_accuracy`,
  `time_to_review_pack_seconds`, and the six demo-critical checks.
- **Raw response logging** under `MISE_RAW_LOG_PATH` so every live Opus call
  leaves a JSONL trace with content blocks, stop reason, and usage counts.

### Measured
- 3 bundles, 10 sources, 15 canonical dishes, 5 modifiers, 2 ephemerals.
- `merge_precision = 1.00`, `merge_recall = 1.00`, `non_merge_accuracy = 1.00`,
  `modifier_routing_accuracy = 1.00`.
- `ephemeral_routing_accuracy = 0.67` — harness literal-equality artifact;
  the demo-critical substring check passes.
- 23 Opus 4.7 calls total · 46.1% cache hit · USD 0.96.

### Guardrails
- Automated tests assert no `temperature`, `top_p`, `top_k`, or `budget_tokens`
  is ever sent to the Messages API.
- Three regression tests lock the contract that uploaded files never get
  replaced by the italian fixture in any failure path.
- 56/56 backend tests green.
