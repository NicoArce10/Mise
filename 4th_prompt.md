# Prompt 4 — AI integration (Anthropic Messages API)

## Read first (in this order)
- The approved architecture plan from milestone 1 (`docs/plans/YYYY-MM-DD-architecture.md`)
- The backend from milestone 3
- `docs/judging_strategy.md` — section "Opus 4.7 Use" lists the four load-bearing pillars
- `docs/evals.md` — the harness this milestone unlocks
- `docs/preflight.md` — verify Gate 3 is green before proceeding

## Skills to invoke
1. `writing-plans` — expand this prompt into bite-sized tasks in `docs/plans/YYYY-MM-DD-ai-integration.md`
2. `executing-plans` — run the plan, committing per task
3. `claude-api` — Messages API patterns with Opus 4.7
4. `prompt-engineering-patterns` — **patterns only, not the LangChain code.** Use Pattern 1 (structured output with Pydantic), Pattern 5 (error recovery with confidence), and the caching-common-prefixes pattern. Translate every LangChain snippet in the skill to direct Anthropic SDK code before using it.
5. `systematic-debugging` — for prompt iteration and failure recovery
6. `verification-before-completion` — before marking done

## Goal
Replace the mock responses from milestone 3 with real Opus 4.7 calls, structured outputs, and deterministic validation, such that `evals/run_eval.py` runs end-to-end on all three bundles and the Cockpit renders real decisions.

## Hard constraints
- Use the Anthropic Messages API directly via the `anthropic` Python SDK. No LangChain, no LlamaIndex.
- `ANTHROPIC_MODEL=claude-opus-4-7` from `.env`. No fallback to a weaker model.
- Vision-native ingestion: PDFs and images are sent as `image` content blocks in the Messages API, not converted to text by an OCR library first.
- Structured output: every Opus 4.7 response is parsed into a Pydantic model before it is allowed to reach the router or the frontend. Malformed responses trigger a single deterministic retry with a tightened system prompt, then fail loudly.
- Adaptive thinking (`thinking: {type: "adaptive"}`) is invoked **only** on reconciliation pairs that the deterministic gate in `backend/app/reconciliation/gate.py` classifies as `AMBIGUOUS`. It is not a default. `budget_tokens` is not used — Opus 4.7 rejects it; cost is bounded with `output_config: {effort: "high"}` plus `max_tokens`.
- The frontend never receives raw model thinking. Only the decision summary, provenance, confidence, and routing decision reach the UI.
- Do not send `temperature`, `top_p`, `top_k`, or last-assistant-turn prefills. Shape is constrained with `output_config: {format: {type: "json_schema", ...}}` and parsed via `client.messages.parse(...)`. See `docs/plans/2026-04-22-architecture.md` §0 for the authoritative API shape and the smoke-test guardrails.

## Deliverables

### Prompt templates
Three system prompts live under `backend/app/ai/prompts/`:
- `extraction.md` — takes a single `SourceDocument` (PDF or image) and returns a list of `DishCandidate`s with spans and raw text. Role is scoped to a careful catalog librarian.
- `reconciliation.md` — takes two `DishCandidate`s and a short context; returns a merge decision with decision summary and confidence. Structured output required. On ambiguous pairs the caller enables extended thinking at the API level.
- `routing.md` — takes a `DishCandidate` that the deterministic regex could not classify, and returns the routing decision (canonical / modifier / ephemeral). Structured output required. This prompt is only invoked on the optional fallback path; the deterministic router handles the expected MVP inputs.

Each prompt file starts with a short frontmatter describing: purpose, input shape, output shape, whether adaptive thinking is enabled for the call, and how the output is validated.

### Request / response shapes
All defined in `backend/app/domain/models.py` (from milestone 1) and exercised in `backend/app/ai/` wrappers. Every Opus 4.7 call has:
- A typed input model
- A Pydantic response model
- A validator that enforces enum values and routing rules
- A deterministic retry on validation failure

### Where adaptive thinking is used
Documented both in code and in `docs/plans/YYYY-MM-DD-ai-integration.md`:
- NOT used for extraction
- NOT used for straightforward reconciliation (gate verdicts `OBVIOUS_MERGE` and `OBVIOUS_NON_MERGE`)
- USED for reconciliation when the gate yields `AMBIGUOUS` — typically when normalized names match but ingredients or dish type differ, or vice versa. The exact gate thresholds are frozen in `docs/plans/2026-04-22-architecture.md` §2.1.
- Effort level and `max_tokens` for each call site are documented in the milestone 4 plan. No `budget_tokens` anywhere in the code.

### Verification against the four demo-critical cases
The milestone is not done until `python evals/run_eval.py --bundle all` produces a report where:
- `Marghertia` is correctly merged with `Margherita`
- `Pizza Funghi` and `Calzone Funghi` are correctly kept separate
- `add burrata +3` is correctly routed as a modifier (attached to a canonical dish)
- `Chef's special` is correctly routed as ephemeral

If any of these fails, do not proceed to recording the demo video.

### Caching
Use `cache_control` on the system prompt for each of the three prompts. This keeps repeated eval runs affordable.

## Output
- `backend/app/ai/` package with typed wrappers per prompt
- Prompt templates under `backend/app/ai/prompts/`
- `evals/run_eval.py` populated and runnable
- A report in `evals/reports/` with the demo metrics for a representative run
- `backend/tests/test_ai_integration.py` with at least one test per prompt, mocked at the SDK boundary (no network in unit tests)

## Verification (Gate 4)
- `python evals/run_eval.py --bundle all` completes without crashes
- The report shows each demo-critical decision correctly handled at least once
- The Cockpit renders real backend responses derived from real Opus 4.7 calls on at least one end-to-end upload → review flow
- No raw model thinking appears in any frontend response payload
- `pytest -q` (backend) is green
