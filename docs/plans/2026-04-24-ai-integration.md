# Mise — AI Integration Plan (Milestone 4)

> Produced by `writing-plans` skill on 2026-04-21 (dated 2026-04-24 per milestone timeline).
> Expansion of `docs/plans/2026-04-22-architecture.md` §5 tasks T4.1 → T4.10.
> Gate 3 green (all checks, incl. `scripts/smoke_api.py` re-run 2026-04-21).

## Goal
Replace the mock pipeline from Milestone 3 with real Opus 4.7 calls, deterministic validation, and an eval harness that measures the four demo-critical decisions on the three bundles. Cockpit renders real decisions; no raw thinking leaks to the frontend.

## Non-negotiables (from `4th_prompt.md`, `docs/plans/2026-04-22-architecture.md` §0)
- Anthropic Messages API via `anthropic` SDK directly. No LangChain, no LlamaIndex.
- Model: `claude-opus-4-7` (from `ANTHROPIC_MODEL` env; no fallback).
- Vision-native: PDFs and images go as `image` (base64) content blocks. No external OCR.
- `thinking: {type: "adaptive"}` **only** on reconciliation pairs classified AMBIGUOUS by the deterministic gate.
- No `budget_tokens`, `temperature`, `top_p`, `top_k`, or assistant prefills.
- Structured output via `output_config: {format: {type: "json_schema", ...}}`, parsed via `client.messages.parse()` into Pydantic models.
- Deterministic retry on validation failure (once, tightened prompt). Second failure raises.
- Prompt caching (`cache_control: ephemeral`) on each system prompt.
- No raw model thinking in Cockpit payloads.

## Task breakdown

### T4.1 — Anthropic SDK + client wrapper
**Do:**
- Add `anthropic>=0.40.0` to `backend/requirements.txt`. `pip install -r`.
- `backend/app/ai/client.py`: lazy-singleton `get_client()` reads `ANTHROPIC_API_KEY`. Typed helper `call_opus(system, content, schema, thinking=False, effort="high", max_tokens=4096)`. Returns parsed Pydantic instance. Implements one tightened-retry on validation failure.
**Accept:** `from app.ai.client import get_client` works; unit test with mocked SDK asserts no `budget_tokens`/`temperature` keys in request.

### T4.2 — Deterministic reconciliation gate
**Do:** `backend/app/reconciliation/gate.py` implements architecture §2.1 verbatim:
- `normalize(s)`, `lev_ratio(x,y)`, `tokens(xs)`, `jaccard(A,B)`, `dish_type(c)` with `DISH_TYPE_LEX`.
- Classifier `classify_pair(a, b) -> ReconciliationClass`.
**Accept:** TDD covers the four demo-critical cases:
- `Marghertia` vs `Margherita` → AMBIGUOUS (lev_ratio 0.10, name_close)
- `Pizza Funghi` vs `Calzone Funghi` → AMBIGUOUS (type_differ)
- `Tacos al Pastor` vs `Al Pastor Tacos` → OBVIOUS_MERGE (name_exact after normalize)
- `Margherita` vs `Caesar Salad` → OBVIOUS_NON_MERGE (not name_close)

### T4.3 — Prompts
**Do:** three markdown files with frontmatter in `backend/app/ai/prompts/`:
- `extraction.md` — input: one `SourceDocument` (PDF or image); output: `list[DishCandidate]`.
- `reconciliation.md` — input: two `DishCandidate`s + optional context; output: `ReconciliationResult`. Enables adaptive thinking at the API level only on AMBIGUOUS pairs.
- `routing.md` — input: one `DishCandidate` the regex could not classify; output: `RoutingDecision`.
**Accept:** each prompt loads via `prompts.load("extraction")`; frontmatter fields parsed.

### T4.4 — Extraction wrapper
**Do:** `backend/app/ai/extraction.py` — one call per `SourceDocument`. PDF/image sent as base64 `image` content block. System prompt cached. Response parsed into `list[DishCandidate]` with IDs generated server-side.
**Accept:** unit test (SDK mocked) asserts content contains `image` block and not `text`-only; parses sample JSON into DishCandidate.

### T4.5 — Reconciliation wrapper
**Do:** `backend/app/ai/reconciliation.py` — takes pair `(a, b)`, calls gate. If `OBVIOUS_MERGE` or `OBVIOUS_NON_MERGE` returns deterministic `ReconciliationResult` without API call. If AMBIGUOUS, calls Opus with `thinking: {type: "adaptive"}`, `output_config: {effort: "xhigh"}`. Updates `ProcessingRun.adaptive_thinking_pairs` counter via store.
**Accept:** unit test covers all three classes; adaptive flag propagates.

### T4.6 — Routing (regex-first, LLM optional)
**Do:** `backend/app/ai/routing.py` — deterministic regex handles modifier detection:
- `MODIFIER_REGEX = r'^\s*(add|extra|with|without|sin|con)\s+.+\s+[+\-]?\$?\d+(\.\d{1,2})?\s*$'` (case-insensitive)
- `EPHEMERAL_HINTS = {"chef's special", "del giorno", "daily", "today only", "tonight only"}`
- All other inputs → `CANONICAL`.
- LLM fallback path stubbed but not called on the three MVP bundles (per §5 T4.5 — "stretch").
**Accept:** unit tests cover `add burrata +3` → modifier, `Chef's Special` → ephemeral, `Margherita` → canonical.

### T4.7 — Validators + pipeline wiring
**Do:**
- `backend/app/domain/validators.py`: `validate_reconciliation_result`, `validate_routing_decision`, enforce confidence in [0,1], summary ≤ 240.
- Replace `_advance_pipeline_mock` in `backend/app/api/processing.py` with `_advance_pipeline_real` that runs extraction → gate → reconciliation → routing → materialize cockpit. Fall back to fixture on any hard error so the demo stays alive.
- `MISE_PIPELINE_MODE` env (`real` | `mock`, default `mock`) selects the branch — demo-safe toggle.
**Accept:** `MISE_PIPELINE_MODE=real` with a known bundle produces a CockpitState with the 4 demo-critical entries.

### T4.8 — Eval harness
**Do:** `evals/run_eval.py`:
- CLI: `--bundle {name|all}`, `--out <path>`.
- For each bundle, builds a batch from `evidence/*`, runs the real pipeline, compares to `expected.json`.
- Computes: `merge_precision`, `non_merge_accuracy`, `modifier_routing_accuracy`, `ephemeral_routing_accuracy`, `time_to_review_pack_seconds`.
- Writes JSON + Markdown report.
**Accept:** `python evals/run_eval.py --bundle bundle_01_italian` runs end-to-end and reports ≥1 correct merge (Margherita) and ≥1 correct non-merge (Funghi).

### T4.9 — Cockpit metrics from report
**Do:** on pipeline completion, read the most recent eval report (if present under `evals/reports/`) and populate `CockpitState.metrics_preview`.
**Accept:** Cockpit metrics pane reads numbers from the eval report file, not static values.

### T4.10 — Tests (mocked) + audit
**Do:** `backend/tests/test_ai_integration.py`, `test_reconciliation_gate.py`, `test_routing.py`, `test_validators.py`. Mock the SDK at the boundary — no network in unit tests.
**Accept:** `pytest -q` green; the 4 demo-critical cases pass; no `temperature`/`budget_tokens` visible in any outgoing payload across tests.

## Progress tracking
- [x] T4.1 — Client wrapper (`backend/app/ai/client.py`; banned-knob tests green)
- [x] T4.2 — Deterministic gate (`backend/app/reconciliation/gate.py`; 7 gate tests green)
- [x] T4.3 — Prompts (`backend/app/ai/prompts/{extraction,reconciliation,routing}.md` with frontmatter)
- [x] T4.4 — Extraction wrapper (vision-native, with fixture fallback for offline/CI mode)
- [x] T4.5 — Reconciliation wrapper (gate → adaptive thinking on AMBIGUOUS; type-differ narrative in non-merge summary)
- [x] T4.6 — Routing (regex-first, ephemeral hints). LLM fallback stubbed per plan.
- [x] T4.7 — Pipeline wiring (`MISE_PIPELINE_MODE` env toggle; falls back to fixture on hard error)
- [x] T4.8 — Eval harness (`evals/run_eval.py`; 3/3 bundles demo-critical pass in fallback mode)
- [x] T4.9 — Cockpit metrics from latest report (`backend/app/core/metrics.py`, `apply_latest_report()` wired in `pipeline._build_cockpit`; `merge_precision` / `non_merge_accuracy` now read from `evals/reports/*.json` mtime-newest; pure-function overlay is independently tested with 6 cases)
- [x] T4.10 — Tests (53/53 backend green — gate, routing, pipeline, AI client guardrails, upload/process/review/models/api, metrics overlay)

## Gate 4 partial status (2026-04-21)
- [x] `python evals/run_eval.py --bundle all` runs end-to-end in fallback mode
- [x] All four demo-critical decisions pass (`demo_critical_all_pass: true`)
  - Marghertia → Margherita merge with typo alias preserved ✓
  - Pizza Funghi vs Calzone Funghi kept separate ✓
  - `add burrata +3` routed as modifier attached to Margherita ✓
  - `Chef's Special` routed as ephemeral ✓
- [x] Backend guardrails prevent `temperature`/`top_p`/`top_k`/`budget_tokens` from ever being sent
- [x] No raw model thinking in any response payload (decisions are capped 240 chars and validated by Pydantic)
- [ ] Real-mode end-to-end run against live Opus 4.7 on bundles — **deferred** (requires spend authorization; fallback report stands in for CI)
- [ ] Hero frame renders at 1440×900 with real-data decisions — Cockpit already consumes the backend (M3 wiring) so this is a 1-minute smoke once real-mode is enabled
