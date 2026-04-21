# Bonus Prize Strategy

## Primary targets (confirmed)
1. **Main prize** — overall top 3 / top 1
2. **Best use of Claude Opus 4.7** (also referenced by the user as the "Keep Thinking" lane)

Everything in this document is subordinated to those two.

## Secondary upside (only if time on day 5 permits)
3. **Best use of Managed Agents** — batch async reconciliation over many restaurants. Requires the core MVP to be fully green first. If not green by day 4 evening, drop without hesitation.

> **Authoritative scope decision:** see `docs/scope_freeze.md`. Managed Agents and Supabase are **out of the MVP path** and can only be revisited once Gate 4 is green and at least 12 clear hours remain before submission. No MVP task, test, doc, or commit touches them before then.

## Hard exclusions
- No pivot to bonus lanes mid-project. If a bonus lane would require a UI or architectural change that hurts the Cockpit or the hero frame, it is rejected.
- No bonus lane is allowed to delay the demo video recording.

## How Mise earns "Best use of Opus 4.7" / "Keep Thinking"

The judging rubric for this lane rewards products where Opus 4.7 is doing work that a weaker model or a classical pipeline cannot. Mise targets four load-bearing demonstrations:

### 1. Vision-native ingestion (visible in the upload and processing views)
Images and PDFs go directly to Opus 4.7. No external OCR service is called. The demo video explicitly narrates this at the ingestion cut. Backend architecture shows a single `extract_from_evidence()` call with the image bytes in the message content.

### 2. Adaptive thinking on ambiguous reconciliations (visible in the processing view)
The reconciliation layer tries a deterministic rule first. Only when two candidates are ambiguous does the backend invoke Opus 4.7 with adaptive thinking enabled (`thinking: {type: "adaptive"}`). The processing view surfaces an inline label "Adaptive thinking engaged on 2 pairs" so the judge sees that the feature is used selectively, not thrown at everything.

Budget guidance (Opus 4.7 API shape — authoritative over any older phrasing elsewhere in this repo):
- Simple reconciliations: Messages API call, no `thinking` block
- Ambiguous pairs: `thinking: {type: "adaptive"}`. `budget_tokens` is **removed** on Opus 4.7 and returns HTTP 400 — do not pass it. Cost is controlled with `output_config: {effort: "xhigh"}` and a `max_tokens` cap; for the whole agentic loop, `output_config: {task_budget: {type: "tokens", total: N}}` (beta header `task-budgets-2026-03-13`) is the documented ceiling
- `temperature`, `top_p`, `top_k` are also removed on Opus 4.7 — do not pass any sampling parameter
- The gate between the two branches is deterministic and lives in `docs/plans/2026-04-22-architecture.md` §2.1, not model-decided

### 3. Structured output plus deterministic validation (visible in the Cockpit decision summaries)
Every Opus 4.7 response is constrained with `output_config: {format: {type: "json_schema", json_schema: ...}}` and parsed into a Pydantic model via `client.messages.parse(...)`. The backend re-validates shape, allowed enum values, and routing rules before the decision reaches the frontend. Reasoning (the model's job) and safety/validation (the backend's job) are architecturally separated. This is called out in the written summary as a production-grade pattern, not a demo trick.

Note: assistant-message prefills are **removed** on Opus 4.6 / 4.7 (HTTP 400). If output shape needs to be guided further, do it through the system prompt and `output_config`, never through a prefilled last-assistant turn.

### 4. Decision summaries in the Cockpit (the product surface)
Each canonical dish card carries a short, human-readable decision summary, provenance back to every source, and a confidence score. Raw model thinking is never exposed to the UI. The judges see the *output* of adaptive thinking as an enterprise artifact, not a chat transcript.

## How Mise earns the main prize

The four judging criteria, with the concrete artifact that earns each:

| Criterion | Artifact |
|---|---|
| Impact | Positioning as a trust layer upstream of catalog management, a defensible category (`docs/product.md` + `README.md` hero paragraph) |
| Demo | Hero frame and 3-minute shot list (`docs/demo_script.md`) |
| Opus 4.7 use | The four demonstrations above, operationalized in backend and Cockpit |
| Depth and execution | The eval harness with measured metrics on a synthetic golden set (`docs/evals.md`) + the Review Cockpit with moderation states, provenance, and human-in-the-loop |

## Managed Agents — if and only if time allows

Scope if pursued:
- One async job: "reconcile this folder of multi-restaurant evidence into canonical packs, on a schedule"
- Surface in Cockpit: a "Batch" tab listing pending and completed jobs, one new card style
- Written summary adds one paragraph explaining the async pattern

Hard gates before starting Managed Agents work:
- All four demo-critical decisions pass in `evals/run_eval.py`
- The 3-minute video has been recorded with at least one clean take
- There are at least 12 hours left before submission deadline

If any of these is not true on day 4 evening, Managed Agents is cut for this submission.

## What we explicitly do NOT pursue
- Any "most creative use" prize that would pull us away from the enterprise trust-layer positioning
- Any community or social prizes that require promotion work during build time
- Any integration-specific prize (X partner integration) that would force unrelated dependencies
