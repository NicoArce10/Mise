# AGENTS.md

Orientation for any AI agent contributing to Mise. Pair this with `CLAUDE.md` (identity and scope) and the public docs under `docs/`.

## Read first
1. `CLAUDE.md` — product identity, core promise, engineering principles.
2. `docs/product.md` — what Mise is and what it is not.
3. `docs/evals.md` — the only source of truth for published metrics.
4. `docs/cockpit_visual_direction.md` — design tokens for every UI surface.
5. `docs/competitive_benchmark.md` — how Mise compares to Veryfi / Klippa.

## Hard rules (non-negotiable)
- **Opus 4.7 only**, no fallback to a weaker model. Model id is `claude-opus-4-7`.
- **Never send**: `temperature`, `top_p`, `top_k`, `budget_tokens`, last-assistant prefill. All return HTTP 400 on 4.7. Control cost with `output_config.effort`.
- **Thinking is `{"type": "adaptive"}` or absent.** Never `{"type": "enabled"}`.
- **Structured output via `output_config.format = {type: "json_schema", ...}`.** Pydantic validates every response before it leaves the backend.
- **No OCR library in the critical path.** PDFs and images go straight to Opus 4.7 vision.
- **No LangChain / LlamaIndex / orchestration wrappers.** We call the Messages API directly.
- **No raw chain-of-thought in the UI.** The product surface is decision summaries with provenance and confidence.
- **Every public metric comes from `evals/run_eval.py`.** No estimates, no "around 90%".
- **Never commit secrets.** `.env` is gitignored; `.env.example` is the template.

## Anchors the product must serve
- **One-sentence pitch, frozen**: *Mise turns any menu into a searchable dish graph. Drop any source, get a JSON catalog that plugs into anything.* All narrative — landing copy, README, demo, written summary — ladders up to this.
- The **primary product surface is search + JSON catalog export**, not the Review Cockpit. The Cockpit is the audit view for the identity layer underneath.
- Five demo-critical moments must be demonstrable end-to-end: natural-language search, `Marghertia` typo merge, `Funghi` non-merge, `burrata +3` as modifier, `Chef's Special` as ephemeral — plus `GET /api/catalog/{run_id}.json` downloaded on camera.

## Commit convention
- `feat(area): short imperative summary`
- `fix(area): ...`
- `docs(area): ...`
- `chore(area): ...`
- `eval(area): ...` for changes to the harness or datasets

`area` is one of: `frontend`, `backend`, `evals`, `docs`, `infra`.

## What NOT to do
- Do not scaffold UI without reading `docs/cockpit_visual_direction.md`. The aesthetic is locked to "Editorial / Cartographic".
- Do not leak raw chain-of-thought into user-facing output.
- Do not invent numbers in the video, README, or written summary. If a metric has not been measured, it does not appear.
- Do not add dependencies without a direct justification.
