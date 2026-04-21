# Mise — AI Handoff Brief

Single-page, self-contained summary of the project for an AI reviewer. If you are an AI reading this to check alignment, read this file first and only open linked docs if a specific claim needs verification.

## Identity

**Mise is the trust layer for dish-level menu data.** It reconciles noisy evidence (photos, PDFs, chalkboards, social posts) into canonical dish records with provenance, confidence, and decision summaries. It is positioned upstream of any restaurant catalog system.

**Not** an OCR product. **Not** a delivery-app integration. **Not** a chatbot wrapper. The category is identity reasoning under ambiguity, powered by Claude Opus 4.7 vision and adaptive thinking.

**Users.** Operations teams at catalog platforms, delivery marketplaces, and restaurant groups — anyone who owns the "what does this restaurant serve" problem at scale.

**Submission target.** Anthropic Claude Opus 4.7 hackathon, deadline Sun 26 Apr 2026, 20:00 EST. Solo dev. Primary lanes: main prize + Best use of Claude Opus 4.7.

## Thesis (why this wins)

1. A defensible category: a trust layer, not yet another OCR tool.
2. Opus 4.7 is visible in the product surface, not only in narration — four load-bearing pillars (see below).
3. One memorable before/after frame — messy evidence on the left, canonical dish cards with provenance on the right.
4. Measured reconciliation quality on a synthetic golden set, not adjectives.
5. Human-in-the-loop Review Cockpit with confidence, provenance, and moderation per decision. Reads as enterprise, not toy.

## The four demo-critical decisions

Every milestone is checked against whether these render end-to-end:

1. **`Marghertia` → `Margherita`.** Typo merge across three sources (PDF + photo + chalkboard). Confidence ≈ 0.94.
2. **`Pizza Funghi` ≠ `Calzone Funghi`.** Same ingredients, different dish type. Separate canonical entries. This is the adaptive-thinking showcase.
3. **`add burrata +3`.** A modifier attached to Margherita via regex + sectional heuristic.
4. **`Chef's Special`.** An ephemeral item routed to its own lane — no stable name, no fixed price.

## The four Opus 4.7 pillars (mapped to code locations)

| Pillar | Where it lives in the architecture |
|---|---|
| **Vision-native ingestion** | `backend/app/ai/extraction.py`, one Opus 4.7 call per `SourceDocument`, image and PDF bytes go in a single `content` block. No OCR, no chunker. |
| **Adaptive thinking on ambiguity only** | Deterministic prefilter in `backend/app/reconciliation/gate.py` classifies pairs as `OBVIOUS_MERGE | OBVIOUS_NON_MERGE | AMBIGUOUS`. Only `AMBIGUOUS` pairs call `thinking: {type: "adaptive"}`. The Cockpit shows a live caption `"Adaptive thinking engaged on N pairs"`. |
| **Structured output + deterministic validation** | Every model response constrained with `output_config: {format: {type: "json_schema", ...}}`, parsed with `client.messages.parse(...)` into Pydantic, then re-validated by `backend/app/domain/validators.py`. Reasoning and validation are architecturally separated. |
| **Decision summaries with provenance** | `CanonicalDish.decision: DecisionSummary` surfaced in every dish card. Each card shows `source_ids` back to every source, plus confidence. Raw model thinking is never shown. |

**Core-guaranteed vs optional call sites.** Opus 4.7 is called in two places that must work for the demo (extraction per source; reconciliation on `AMBIGUOUS` pairs) and in one optional place (routing, only if the deterministic regex fails to classify a line). The three MVP bundles are designed so the regex covers every routable line, meaning the optional call stays cold in the demo and the MVP does not depend on it.

## Opus 4.7 API shape

**Confirmed by Anthropic docs** (authoritative):

- `thinking: {type: "adaptive"}` is the only thinking surface on 4.7. `type: "enabled"` and `budget_tokens` are not accepted. Source: [Adaptive thinking docs](https://platform.claude.com/docs/en/build-with-claude/adaptive-thinking) and the [model overview](https://platform.claude.com/docs/en/about-claude/models/overview#latest-models-comparison) (Extended thinking = No, Adaptive thinking = Yes).
- Cost is controlled with `output_config: {effort: "high"|"xhigh"|"max"}`, optionally `output_config: {task_budget: {type:"tokens", total:N}}` (beta header `task-budgets-2026-03-13`, Messages API only — not Claude Code). Source: [Task budgets docs](https://platform.claude.com/docs/en/build-with-claude/task-budgets).
- Model ID is literally `claude-opus-4-7`, no date suffix.

**Documented but not yet verified on this key** — the `claude-api` skill lists these as "removed on 4.7" but we do not treat them as a hard contract until `scripts/smoke_api.py` confirms them on your deployment (probes 5 and 6):

- `temperature`, `top_p`, `top_k` should be rejected with HTTP 400.
- Last-assistant-turn prefills should be rejected with HTTP 400 — use `output_config: {format}` to constrain shape.

If the smoke test flags either guardrail as accepted on your key, update this brief and `docs/plans/2026-04-22-architecture.md` §0 to reflect the deployment's actual behavior. Never rely on undocumented behavior in the code path.

## Architecture in one sentence

Four deterministic layers (ingestion → extraction → reconciliation → routing). Opus 4.7 is **core-guaranteed** at two call sites (extraction per source, reconciliation on ambiguous pairs only) and **optionally** invoked at a third (routing, only when the deterministic regex cannot classify a line). All responses are Pydantic-validated before they reach the frontend.

```
evidence → extract(Opus)                                    → DishCandidate[]
         → gate(Python)                                     → {OBVIOUS_MERGE | OBVIOUS_NON_MERGE | AMBIGUOUS}
         → reconcile(Opus on AMBIGUOUS only)                → ReconciliationResult[]
         → route(Python regex-first;
                 Opus only if regex fails to classify)      → RoutingDecision[]
         → validate(Pydantic)                               → CockpitState
```

On the three MVP bundles, the routing regex covers every line — the optional Opus call site stays cold in the demo. Full contract in `docs/plans/2026-04-22-architecture.md` §2–§3.

## Tech stack (frozen)

- **Frontend.** React + Vite + TypeScript, Tailwind v4, shadcn/ui. "Editorial / Cartographic" aesthetic (`docs/cockpit_visual_direction.md`).
- **Backend.** Python 3.11+, FastAPI, Pydantic v2, in-memory store.
- **AI.** Anthropic Python SDK, `claude-opus-4-7`.
- **No.** LangChain, LlamaIndex, OCR libraries, external DB (Supabase), Managed Agents (all excluded by `docs/scope_freeze.md`).

## Scope boundary (authoritative)

**In.** Upload evidence, extract, reconcile, route, review in Cockpit, produce measured eval report.

**Out (frozen, see `docs/scope_freeze.md`).** Managed Agents, Supabase/any DB, auth, external OCR, agent-orchestration frameworks, a 4th eval bundle, animation beyond the shot list.

**Soft cuts in order if schedule slips.** Bundle 03 polish → Cockpit hero overlay animation → edit flow → adaptive-thinking polling caption. Never cut: the four decisions, the eval, the video.

## Deliverables

- `demo.mp4` — 2:45–3:00, unlisted YouTube or Loom, linked from `submissions/README.md`.
- Written summary — in `submissions/`, consistent with the video.
- `submissions/metrics.json` — exact numbers shown in the video, produced by `evals/run_eval.py`, not invented.
- Public repo with MIT license, no secrets.

## Timeline (from `docs/timeline.md`)

| Day | Work |
|---|---|
| Tue 21 Apr | Architecture plan (this is done). Gate 0 smoke of Opus 4.7. First commit. |
| Wed 22 Apr | Milestone 2 — Review Cockpit with mock state. |
| Thu 23 Apr | Finish Cockpit, eval asset freeze. |
| Fri 24 Apr | Milestone 3 — FastAPI backend shell with fixtures. |
| Sat 25 Apr | Milestone 4 — AI integration. First eval run. |
| Sun 26 Apr | Second eval run, demo recording, submit. |

## Verification surface (what "done" means)

- `python scripts/smoke_api.py` exits 0 (all four Opus 4.7 probes green).
- `python scripts/generate_eval_bundles.py` has been run — 10 deterministic assets committed.
- `python evals/run_eval.py --bundle all` produces a report where the four demo-critical decisions all pass.
- Cockpit renders the four cards with provenance and confidence, driven by the backend on `127.0.0.1:8000`.
- `demo.mp4` exists, 2:45–3:00, and shows the hero frame within the first 10 seconds.

## Alignment checklist for an AI reviewer

Use these to judge whether the current state is winning-aligned:

- [ ] Does the project position itself as a trust layer, not an OCR tool, in README + product.md + demo shot list?
- [ ] Are all four Opus 4.7 pillars mapped to concrete code locations (vision-native extraction, gated adaptive thinking, structured+validated outputs, decision summaries with provenance)?
- [ ] Do the four demo-critical decisions appear in the frontend mock, the backend fixtures, and the three `expected.json` files?
- [ ] Is Opus 4.7 API shape respected everywhere (no `budget_tokens`, no sampling params, no prefills, `thinking:{type:"adaptive"}` only)?
- [ ] Is Managed Agents / Supabase kept out of the MVP path?
- [ ] Are all demo metrics produced by `evals/run_eval.py`, never adjectives?
- [ ] Is the hero frame authored, not improvised?

If every checkbox is "yes", alignment is green.
