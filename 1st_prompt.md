# Prompt 1 — Architecture, domain models, contracts, mock data, plan

## Read first (in this order)
- `claude.md`
- `AGENTS.md`
- `docs/product.md`
- `docs/hackathon_rules.md`
- `docs/acceptance_criteria.md`
- `docs/judging_strategy.md`
- `docs/demo_script.md`
- `docs/evals.md`
- `docs/cockpit_visual_direction.md`
- `docs/extras.md`
- `docs/preflight.md` — verify Gate 0 is green before proceeding

## Skills to invoke
1. `brainstorming` — confirm ambiguities with the user before designing
2. `writing-plans` — produce the implementation plan in `docs/plans/YYYY-MM-DD-architecture.md`

Do NOT write code in this milestone.

## Goal
Produce the minimal, composable architecture that serves the hero frame in `docs/demo_script.md` and lets `evals/run_eval.py` measure the four demo-critical decisions.

## Constraints (hard)
- Keep the solution simple and composable
- Messages API is the core path — no orchestration frameworks (no LangChain, no LlamaIndex)
- Do not design around Managed Agents in the MVP
- No external OCR in the critical path — images and PDFs go directly to Opus 4.7 vision
- No exposure of raw model thinking to the frontend
- Architecture must separate extraction, reconciliation, routing, and validation into distinct layers
- In-memory storage acceptable for MVP; Supabase only if a concrete milestone requires it

## Deliverables

All written to `docs/plans/YYYY-MM-DD-architecture.md` unless noted.

1. **Architecture diagram** — text-based (mermaid or ascii), showing: evidence ingest → extraction layer → reconciliation layer → routing layer → validation layer → API → Cockpit. Label which layer Opus 4.7 is called from and where adaptive thinking is engaged.
2. **Domain models** — Pydantic schemas for: `SourceDocument`, `EvidenceRecord`, `DishCandidate`, `ReconciliationResult`, `RoutingDecision`, `DecisionSummary`, `ModerationStatus`, `Modifier`, `CanonicalDish`, `EphemeralItem`, `ProcessingRun`, `MetricsPreview`, `CockpitState`. Every field typed, every enum explicit, no `Any`. Modifiers may carry `parent_dish_id: UUID | None` and be surfaced as unattached when null.
3. **API contracts** — OpenAPI-flavored description of the endpoints the frontend needs for the MVP. At minimum: upload, start processing, fetch processing status, fetch review cockpit state, approve/edit/reject a canonical dish.
4. **Mock data plan** — exact mock fixtures required to render the Cockpit without the backend. Must include all four demo-critical decisions and the hero-frame bundle.
5. **Implementation order** — the sequence of work across milestones 2-4, mapped to bite-sized tasks with acceptance criteria. Reference the skills to invoke per task.
6. **Verification plan** — for each layer, the exact command or UI interaction that proves correctness. Pipeline layers verify against `evals/datasets/`; UI verifies against the hero frame spec.

## Anchor
Everything in this plan ultimately serves one artifact: the hero frame described in `docs/demo_script.md`, section "The single most important frame". If a decision in this plan does not serve that frame or the four demo-critical decisions, it should be cut.

## Acceptance criteria (Gate 1)
- The plan exists at `docs/plans/YYYY-MM-DD-architecture.md` and is committed
- All four demo-critical decisions appear explicitly in the mock data plan
- The architecture shows Opus 4.7 is invoked in extraction and in reconciliation (with `thinking: {type: "adaptive"}` engaged only on pairs classified as `AMBIGUOUS` by the deterministic gate). Routing uses Opus only as an optional fallback for lines the deterministic regex cannot classify.
- The API contract is consumable by the Cockpit without any additional design decisions
- A user review of the plan has been completed and approved in chat
