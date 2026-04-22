# Mise

## Identity
Mise is a standalone open-source project built for the Claude Opus 4.7 Hackathon (April 2026).
It does not reuse code, schema, data, or assets from any prior product.

## Product
Mise is a **dish-understanding engine**.
Drop any menu — PDF, photo, chalkboard, Instagram post, any language — and get a **searchable dish graph**: a JSON catalog with canonical names, prices, ingredients, natural-language aliases, and the search terms a real diner actually types.
Then plug that catalog into anything: a delivery feed, a POS import, a review app, a search box.

## Core promise
Any menu in. A clean, searchable, integrable JSON catalog out.
Powered by Claude Opus 4.7 vision + identity reasoning under ambiguity — **not OCR**.

## Users
- Food-review and discovery apps onboarding restaurants (need canonical IDs and diner-vernacular aliases)
- Delivery platforms importing non-POS restaurants (Rappi, PedidosYa, Uber Eats, DoorDash)
- POS and catalog-migration teams consolidating multi-branch menus
- Multi-location restaurant groups reconciling branch variants
- Any team that today pays humans to normalize menus

## Scope
The MVP is the smallest believable end-to-end product:
1. Upload multi-source menu evidence (PDFs, photos, chalkboards, social posts).
2. Extract dish candidates with aliases and search terms — one Opus 4.7 vision call per source.
3. Reconcile identities across sources and branches. Adaptive thinking only on ambiguous pairs.
4. Route edge cases deterministically (`canonical` · `modifier` · `ephemeral` · `needs-review`).
5. Serve two read surfaces:
   - `POST /api/search` — natural-language search over the graph
   - `GET /api/catalog/{run_id}.json` — the full dish graph as plug-it-anywhere JSON
6. A Review Cockpit for auditing merge/split decisions with provenance — a secondary, trust-proof surface under the main search/catalog flow.

## Non-goals
- Not OCR-only
- Not menu management
- Not a POS
- Not a marketplace
- Not a mobile app
- No auto-publish to production

## Stack
- **Frontend**: React 18, Vite 5, TypeScript (strict), Tailwind v4, shadcn/ui.
- **Backend**: Python 3.11+, FastAPI, Pydantic v2.
- **Storage**: process-local in-memory store. Persistence is intentionally out of MVP scope; the stable JSON catalog is the external contract.
- **AI core**: Anthropic Messages API with `claude-opus-4-7`, via the `anthropic` Python SDK. No LangChain. No LlamaIndex. No external OCR in the critical path.

## Demo-critical decisions
The demo must show, in order:
1. A diner-style natural-language search that lands on the right dish via `search_terms` — e.g. *"mila napo con papas"* → **Milanesa Napolitana con Papas**.
2. `Marghertia` (typo) normalized to `Margherita` and merged across branches; typo preserved as alias.
3. `Pizza Funghi` vs `Calzone Funghi` kept separate despite identical ingredients.
4. `add burrata +3` attached as a **modifier** on Margherita, never surfaced as a standalone dish.
5. `Chef's Special` routed as **ephemeral** and kept out of the canonical catalog.
6. `GET /api/catalog/{run_id}.json` downloaded on camera as the "plug it into anything" output.

## Engineering principles
- Keep solutions simple and composable.
- Prefer workflows over autonomous agents.
- Separate reasoning (Opus 4.7) from deterministic validation (backend).
- Keep files typed and easy to inspect.
- Vision-native ingestion — no external OCR in the critical path.
- Never publish a metric that did not come from `evals/run_eval.py`.
- Never expose raw chain-of-thought in the UI — the surface is decisions with provenance and confidence.

## Opus 4.7 API shape (hard rules)
- Model id is literally `claude-opus-4-7`. No date suffix, no fallback to a weaker model.
- Thinking is `thinking: {type: "adaptive"}` or absent. Never `{type: "enabled"}` and never `budget_tokens`.
- Cost is controlled with `output_config.effort` (and optionally `output_config.task_budget` under the `task-budgets-2026-03-13` beta header).
- **Never send** `temperature`, `top_p`, `top_k`, or a last-assistant prefill. All return HTTP 400 on 4.7.
- Structured outputs go through `output_config.format = {type: "json_schema", ...}` and are validated with Pydantic before leaving the backend. Never hand-parse JSON out of `.content`.

## Key public documents
- `AGENTS.md` — orientation for AI agents working on the repo
- `docs/product.md` — product brief
- `docs/demo_script.md` — three-minute demo shot list
- `docs/evals.md` — evaluation harness specification (source of truth for all published numbers)
- `docs/cockpit_visual_direction.md` — locked design tokens
- `docs/references.md` — external references
