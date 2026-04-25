<p align="center">
  <img src="assets/mise-hero-banner.png" alt="Mise — any menu, any language, ask like a customer" width="100%">
</p>

<h1 align="center">Mise</h1>

<p align="center">
  <em>Any menu. Any language. Ask like a customer.</em>
  <br>
  <sub>Drop a PDF, photo, chalkboard, or Instagram post. Get a searchable dish graph you can query in natural language — powered by Claude Opus 4.7.</sub>
</p>

<p align="center">
  <a href="#why-mise-exists">Why</a> ·
  <a href="#what-it-does">What it does</a> ·
  <a href="#the-json-catalog">JSON catalog</a> ·
  <a href="#architecture">Architecture</a> ·
  <a href="#plug-it-into-anything">Integrations</a> ·
  <a href="#quickstart">Quickstart</a> ·
  <a href="docs/demo_script.md">Demo</a> ·
  <a href="docs/evals.md">Evals</a>
</p>

<p align="center">
  <img alt="Built with Claude Opus 4.7" src="https://img.shields.io/badge/AI%20core-claude--opus--4--7-1a1a1c?style=flat-square&labelColor=f6f2ea">
  <img alt="Python 3.11+" src="https://img.shields.io/badge/python-3.11%2B-4b8bbe?style=flat-square&labelColor=f6f2ea">
  <img alt="TypeScript strict" src="https://img.shields.io/badge/typescript-strict-3178c6?style=flat-square&labelColor=f6f2ea">
  <img alt="FastAPI" src="https://img.shields.io/badge/api-FastAPI-009485?style=flat-square&labelColor=f6f2ea">
  <img alt="Vite + React" src="https://img.shields.io/badge/ui-Vite%20%2B%20React%2018-646cff?style=flat-square&labelColor=f6f2ea">
  <img alt="License MIT" src="https://img.shields.io/badge/license-MIT-ab5c3e?style=flat-square&labelColor=f6f2ea">
</p>

---

## Why Mise exists

Every food product — delivery app, review platform, POS, dish-reviews side-project — eventually hits the same wall: **menus are unstructured**. PDFs, phone photos, chalkboards, Instagram specials, in three languages, with typos, with branch-level variations, with modifiers that look like dishes and dishes that look like modifiers. Somebody then spends weeks manually loading that catalog into their system, one restaurant at a time.

Mise removes that wall.

**Drop any menu. Get a searchable dish graph.** A JSON catalog with canonical names, prices (USD, EUR, GBP, ARS, BRL, MXN, JPY, CHF and any other ISO-4217 code Opus reads off the menu), ingredients, and the *natural-language handles* a diner actually types — `mila napo`, `napo con papas`, `burger doble cheddar`, `pizza margherita classica`, `gluten-free pasta`. Then plug that catalog into anything: a search box, a delivery feed, a POS import, a review app.

The pipeline is **language-neutral by construction**: extraction prompts Opus to preserve the menu's source language for every field except where translation is requested explicitly. The Try It surface and the Catalog view auto-detect the menu's locale (Spanish / Italian / English) and adapt example queries, placeholder copy, and category headers to match — an Italian pizzeria never sees Argentine slang and vice versa.

It is not OCR. It is a **dish-understanding engine** powered by `claude-opus-4-7` — vision-native, identity-aware, and search-ready by construction.

## What it does

1. **Ingests** multi-source menu evidence — PDFs, photos, chalkboards, social posts, in any language — directly to Opus 4.7 vision. No external OCR in the critical path.
2. **Extracts** dish candidates with typo correction, reordered-compound normalization, and the diner-vernacular aliases and search terms — from a single Opus 4.7 structured-output call per source.
3. **Reconciles** candidates across sources through a deterministic prefilter that escalates only ambiguous pairs to Opus 4.7 with **adaptive thinking**, so one dish stays one dish across branches and typos.
4. **Routes** edge cases deterministically — `canonical` · `modifier` · `ephemeral` · `needs-review` — so a delivery feed never shows "add burrata +3" as a standalone item.
5. **Serves it back** two ways: a natural-language **search** endpoint (`POST /api/search/:run_id`) that takes "algo abundante con queso" and returns the right dishes, and an **export** endpoint (`GET /api/catalog/:run_id.json`) with the full catalog ready to plug into any system.

## The JSON catalog

The primary output. One endpoint, one shape, zero custom integration per restaurant. The contract is pinned by `schema_version` so downstream consumers can target a stable shape:

```json
{
  "schema_version": "mise.catalog.v1",
  "run_id": "run-abc123",
  "generated_at": "2026-04-25T12:34:56Z",
  "model": "claude-opus-4-7",
  "quality_signal": {
    "status": "ok",
    "confidence": 0.91,
    "flags": [],
    "reasons": [],
    "metrics": {
      "dish_count": 38,
      "missing_price_ratio": 0.0,
      "missing_category_ratio": 0.05,
      "sparse_ingredient_ratio": 0.10
    }
  },
  "sources": [
    { "id": "src-001", "filename": "menu_pdf.pdf", "kind": "pdf",
      "content_type": "application/pdf", "sha256": "07e1705..." }
  ],
  "dishes": [
    {
      "id": "dish-abc123",
      "canonical_name": "Milanesa Napolitana",
      "menu_category": "Carnes y Parrilla",
      "price": { "value": 8500, "currency": "ARS" },
      "aliases": ["Mila Napo", "Milanesa a la Napolitana", "Napolitana"],
      "search_terms": ["mila napo", "napo con papas", "milanesa abundante con queso y jamon"],
      "ingredients": ["breaded beef", "tomato", "mozzarella", "ham"],
      "modifiers": [
        {
          "id": "mod-papas",
          "text": "+ papas rústicas",
          "price_delta": { "value": 1200, "currency": "ARS" },
          "parent_dish_id": "dish-abc123",
          "sources": [{ "source_id": "src-001", "filename": "menu_pdf.pdf", "kind": "pdf" }]
        }
      ],
      "sources": [{ "source_id": "src-001", "filename": "menu_pdf.pdf", "kind": "pdf" }],
      "confidence": 0.92,
      "decision_summary": "Merged because the normalized name matches and ingredients are compatible.",
      "review_status": "approved"
    }
  ],
  "unattached_modifiers": [],
  "ephemerals": [],
  "counts": {
    "sources": 1,
    "dishes": 38,
    "modifiers_attached": 12,
    "modifiers_unattached": 0,
    "ephemerals": 0,
    "excluded_rejected": 0
  }
}
```

Every restaurant tech company re-invents this shape manually. Mise generates it from a photo. Two contract guarantees consumers can rely on:

- **`schema_version` is pinned.** Incompatible changes bump the version; additive fields with safe defaults are not breaking. A consumer pinning against `mise.catalog.v1` will keep parsing old runs forever.
- **`generated_at` is always a non-empty ISO-8601 UTC timestamp.** Falls back to request-time UTC if the pipeline didn't stamp one, so `Date.parse()` and `datetime.fromisoformat()` work out of the box. (We hit this exact bug in an earlier export and pinned a regression test for it.)

## Identity reasoning — why the search works

The search is only as good as the identity graph underneath it. These four demo decisions — anchored in the eval harness and the video — prove the identity layer holds up:

| Evidence | Decision | Why it matters for search |
|---|---|---|
| `Marghertia` (typo, Branch A) · `Margherita` (Branch B) · `+burrata` (Branch C) | **Merged** as `Margherita`, typo becomes an alias, burrata becomes a modifier | A query for "margarita con burrata" resolves to one dish, not three partial matches |
| `Pizza Funghi` · `Calzone Funghi` (identical ingredients) | **Kept separate** | Query "funghi sin masa cerrada" correctly returns the pizza, not the calzone |
| `add burrata +3` on a chalkboard | Routed as **modifier** attached to `Margherita` | Search never surfaces "add burrata" as a dish, and "margherita con burrata" composes the modifier into the result |
| `Chef's Special` from an Instagram post | Routed as **ephemeral** | The catalog doesn't fossilize a one-night special into a permanent dish |

## Architecture

```mermaid
flowchart LR
  subgraph Client
    UI[Search + Catalog UI<br/>React + Vite + TS]
  end

  subgraph API[FastAPI + Pydantic v2]
    UP[POST /api/upload]
    PR[POST /api/process/:batch_id]
    PS[GET /api/process/:run_id]
    SE[POST /api/search]
    CA[GET /api/catalog/:run_id.json]
    RV[GET /api/review/:run_id]
  end

  subgraph Pipeline
    EX[Extraction<br/>per source]
    RE[Reconciliation<br/>deterministic gate]
    RT[Routing<br/>canonical/modifier/ephemeral/needs-review]
    VA[Validation<br/>Pydantic + enum + invariants]
    ST[(In-memory Store)]
  end

  subgraph Opus[claude-opus-4-7]
    OX[extraction call<br/>vision: PDF / image]
    OR_A[reconciliation call<br/>adaptive thinking]
    ORT[routing call<br/>edge cases only]
    OS[search call<br/>adaptive thinking]
  end

  UI --> UP & PR & PS & RV & SE & CA
  UP --> ST
  PR --> EX --> OX --> VA --> RE
  RE -. gate = ambiguous .-> OR_A --> VA --> RT
  RT -. regex-unclassified .-> ORT --> VA --> ST
  ST --> RV & CA
  SE --> OS --> ST
```

Four deterministic layers plus two read surfaces. Opus 4.7 is **core-guaranteed** in four of them — extraction per source (structured output with diner-vernacular aliases and search terms), reconciliation on ambiguous pairs (adaptive thinking), routing of edge cases (`modifier` / `ephemeral` / `needs-review`), and natural-language search over the dish graph.

## Plug it into anything

The dish graph is the product. Every integration is the same two steps:

1. `POST /api/upload` → `POST /api/process/:batch_id` with the restaurant's menus.
2. `GET /api/catalog/:run_id.json` → drop the JSON into your system.

The contract is shape-only — no Mise-specific SDK, no webhook protocol, no integration code shipped in this repo. The three use-case templates below describe how the same JSON maps onto the systems most consumer-food products are already running internally; they are **shape compatibility, not announced partnerships**.

| Use-case template | What that consumer needs | What the catalog already provides |
|---|---|---|
| **Review & discovery app** onboarding a restaurant | Canonical dishes, aliases for user-typed reviews, stable IDs across branches | Full `canonical_dishes` with `aliases` and `search_terms`. A reviewer typing "mila napo" matches the canonical "Milanesa Napolitana". |
| **Delivery platform** importing a non-POS restaurant | Item list with prices, grouped modifiers, no one-night specials polluting the catalog | `canonical` items with `price` and `modifiers[]`; `ephemeral` items partitioned into a separate array, droppable at ingest. |
| **POS / catalog migration** across branches | Dedup across branch menus, typo normalization, structured modifiers | Reconciled items with typos folded into `aliases`, branch variants merged, modifiers attached to parents. |

The catalog is versioned per `run_id`, so re-uploading a new menu produces a diffable JSON the consuming system can apply as an update.

## Stack

- **Frontend** — React 18 · Vite 5 · TypeScript (strict, no `any`) · Tailwind v4 with `@theme` tokens · shadcn/ui · Fraunces / Instrument Serif / IBM Plex Sans / IBM Plex Mono
- **Backend** — Python 3.11+ · FastAPI 0.115 · Pydantic v2 · uvicorn · pytest
- **AI** — Anthropic Messages API with `claude-opus-4-7`. No LangChain, no LlamaIndex, no external OCR, no orchestration wrappers.
- **Storage** — process-local in-memory store. A stable JSON catalog is the external contract; persistence is intentionally out of scope for the MVP.

## Quickstart

Requirements — Node 20+, Python 3.11+, an Anthropic API key with access to `claude-opus-4-7`.

```bash
# 1. Clone and configure
git clone https://github.com/NicoArce10/Mise.git
cd Mise
cp .env.example .env      # then fill ANTHROPIC_API_KEY

# 2. Backend
cd backend
python -m venv .venv
.venv\Scripts\activate                       # Windows PowerShell
#  source .venv/bin/activate                 # macOS / Linux
pip install -r requirements.txt
pytest -q                                    # full suite passes (118+ tests)
uvicorn app.main:app --reload --port 8000    # in one terminal

# 3. Frontend
cd ../frontend
npm install
npm run dev                                  # in another terminal — http://127.0.0.1:5173

# 4. API smoke test against Opus 4.7 (required before Milestone 4)
cd ..
python scripts/smoke_api.py                  # exits 0 if the key works
```

Open the app at <http://127.0.0.1:5173>. Drop a menu PDF/photo on the landing panel → the pipeline runs → the search playground (`/tryit`) opens with the dish graph, aliases, and natural-language search ("algo abundante con queso"). The Review/Catalog audit view at <http://127.0.0.1:5173/catalog> shows every merge/split decision with provenance, lets a reviewer approve/edit/reject, and exposes the **Download JSON** button that hits `GET /api/catalog/:run_id.json`.

## Repository layout

```
Mise/
├── assets/         Banner and public visual assets
├── frontend/       Search + catalog UI, Cockpit audit view (Vite + React + TS)
├── backend/        FastAPI service (Pydantic v2, in-memory store)
├── evals/          Synthetic golden set + harness + reports
│   └── datasets/   bundle_01 italian · bundle_02 taqueria · bundle_03 bistro
├── docs/           Product, architecture, design, evals contract
├── scripts/        smoke_api.py + eval bundle generator
└── submissions/    Video link, written summary, metrics JSON
```

## Documentation

- [`docs/product.md`](docs/product.md) — product brief
- [`docs/demo_script.md`](docs/demo_script.md) — three-minute shot list
- [`docs/cockpit_visual_direction.md`](docs/cockpit_visual_direction.md) — editorial / cartographic design tokens
- [`docs/evals.md`](docs/evals.md) — evaluation harness specification
- [`docs/competitive_benchmark.md`](docs/competitive_benchmark.md) — how to reproduce the Mise vs Veryfi / Klippa comparison on your own hardware, with your own credentials
- [`docs/references.md`](docs/references.md) — notes and sources

## For hackathon judges

If you are reviewing this submission:

1. **Demo video** — link in [`submissions/README.md`](submissions/README.md)
2. **Written summary** — [`submissions/written_summary.md`](submissions/written_summary.md)
3. **Measured metrics** — [`submissions/metrics.json`](submissions/metrics.json), reproducible via `python evals/run_eval.py --bundle all`
4. **Competitive benchmark** — reproducible side-by-side with Veryfi (requires your own Veryfi API key): `python evals/run_competitor_bench.py --bundle bundle_01_italian --mise-mode real --with-veryfi`. Methodology: [`docs/competitive_benchmark.md`](docs/competitive_benchmark.md).
5. **Try it live** — the Quickstart above is copy-pasteable; smoke-test completes in under a minute.

Every quantitative claim in the demo video is produced by `evals/run_eval.py` or `evals/run_competitor_bench.py`. If a number isn't in one of those reports, it isn't in the video. The contract is in [`docs/evals.md`](docs/evals.md).

## License

MIT — see [`LICENSE`](LICENSE). All assets in this repository are original or properly licensed.

<p align="center">
  <sub>Built for the Claude Opus 4.7 Hackathon — April 2026.</sub>
</p>
