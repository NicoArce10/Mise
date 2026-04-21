# Mise

## Identity
Mise is a brand-new standalone open-source hackathon project.
It must not reference any prior product in code, schema, UI, docs, naming, prompts, or assets.
Do not reuse pre-existing code.

## Agent orientation
Before touching anything, read `AGENTS.md` in the repo root. It defines read order, skill invocation sequence, commit convention, and hard rules.

## Product
Mise is the trust layer for dish-level menu data.
It turns messy menu evidence into canonical, reviewable dish records with provenance and confidence.

## Core promise
This is not software that reads menus.
It is software that decides when messy menu evidence refers to the same dish, and tells you why.

## Users
- Food delivery platforms
- Restaurant software companies
- Multi-location restaurant groups
- Catalog ops teams
- Food discovery products

## Scope
Build the smallest believable end-to-end product:
1. Upload multi-source menu evidence
2. Extract dish candidates
3. Reconcile identities across sources and branches
4. Route edge cases deterministically
5. Review Cockpit with provenance and moderation actions

## Non-goals
- Not OCR-only
- Not menu management
- Not a POS
- Not a marketplace
- Not a mobile app
- Not a continuation of any prior product
- No auto-publish to production

## Stack
- Frontend: React + Vite + Tailwind v4 + TypeScript + shadcn/ui
- Backend: Python 3.11+ + FastAPI + Pydantic v2
- DB/storage: in-memory for the MVP. Supabase is **out of MVP scope** — see `docs/scope_freeze.md`. It can only be revisited after Gate 4 is green and the demo video is recorded.
- AI core: Anthropic Messages API with `claude-opus-4-7` — called via the `anthropic` Python SDK directly. No LangChain, no LlamaIndex.
- Claude Managed Agents are **out of MVP scope** — see `docs/scope_freeze.md`. They can only be revisited after Gate 4 is green and the demo video is recorded, and only if they add signal for a specific bonus the judging strategy identifies.

## Workflow
Always follow the four milestones in this order:
1. `1st_prompt.md` — architecture, domain models, API contracts, mock data, implementation order, verification plan (no code)
2. `2nd_prompt.md` — Review Cockpit with mock data
3. `3rd_prompt.md` — FastAPI backend shell with mock responses
4. `4th_prompt.md` — Opus 4.7 integration and eval harness

Every milestone is gated by the corresponding entry in `docs/preflight.md`. Do not advance with a red gate.

Within each milestone:
1. Explore — read the docs listed at the top of the prompt
2. Plan — invoke the `writing-plans` skill, save to `docs/plans/YYYY-MM-DD-<milestone>.md`
3. Implement — invoke `executing-plans`, commit per bite-sized task
4. Verify — invoke `verification-before-completion` and run the acceptance criteria in the prompt

Do not start coding before the plan is written and approved.

## Verification
Every task must include a way to verify correctness.
For UI: runnable and visually inspectable.
For backend: testable endpoints.
For pipeline: mock and real sample inputs.

## Demo-critical decisions
The final demo must include:
- "Marghertia" normalized to "Margherita"
- "Pizza Funghi" and "Calzone Funghi" not merged
- "add burrata +3" treated as a modifier
- "Chef's special" treated as ephemeral

## Engineering principles
- Keep solutions simple and composable
- Prefer workflows over over-engineered autonomous agents
- Separate reasoning (Opus 4.7) from deterministic validation (backend)
- Keep files typed and easy to inspect
- Build the Review Cockpit first with mock data
- Vision-native ingestion — PDFs and images go to Opus 4.7 directly, no external OCR in the critical path
- Never publish a metric that did not come from `evals/run_eval.py`
- Never expose raw model thinking to the UI; the product surface is decisions with provenance and confidence

## Opus 4.7 API shape (hard rules for the code path)
- Model ID is literally `claude-opus-4-7`. No date suffix, no fallback to a weaker model.
- The only accepted thinking surface is `thinking: {type: "adaptive"}`. Do not send `type: "enabled"` or `budget_tokens`; both are rejected on 4.7.
- Cost is controlled with `output_config: {effort: "high"|"xhigh"|"max"}`, optionally `output_config: {task_budget: {type: "tokens", total: N}}` (beta header `task-budgets-2026-03-13`).
- Do not send `temperature`, `top_p`, or `top_k`. Do not rely on last-assistant-turn prefills. `scripts/smoke_api.py` probes both as guardrails — respect the result it reports on your key.
- Structured outputs go through `output_config: {format: {type: "json_schema", ...}}` and `client.messages.parse(...)` into Pydantic. Never hand-parse JSON from `.content`.
- The authoritative statement of the API shape is `docs/plans/2026-04-22-architecture.md` §0. If anything in this file disagrees with §0, §0 wins.

## Key documents
- `AGENTS.md` — orientation for agents
- `docs/project_brief.md` — one-page AI-reviewable summary of the whole project
- `docs/plans/2026-04-22-architecture.md` — Milestone 1 architecture plan; authoritative for API shape and domain models
- `docs/scope_freeze.md` — authoritative MVP scope boundary (hard exclusions, soft cuts, unfreeze conditions)
- `docs/product.md` — product brief
- `docs/hackathon_rules.md` — competition guardrails
- `docs/acceptance_criteria.md` — what must be true to submit
- `docs/judging_strategy.md` — how Mise targets the judging criteria and the top-1 conditions
- `docs/demo_script.md` — the 3-minute video shot list and the hero frame
- `docs/evals.md` — the evaluation harness specification
- `docs/cockpit_visual_direction.md` — locked design tokens for the Cockpit
- `docs/extras.md` — bonus prize strategy; deferred to `docs/scope_freeze.md` for scope authority
- `docs/preflight.md` — green-light checklist before each milestone
- `docs/references.md` — curated external docs