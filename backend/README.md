# Mise — Backend

FastAPI + Pydantic v2. Calls **Claude Opus 4.7** vision directly (no OCR, no orchestration framework) to turn any menu (PDF, JPG, PNG) into a `mise.catalog.v1` JSON catalog. The Review Cockpit, Sources page, search playground, and catalog export all hang off the same in-memory store.

## Quickstart

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate     # Windows PowerShell
# source .venv/bin/activate  # macOS / Linux

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Swagger UI: <http://127.0.0.1:8000/docs>

## Tests

```bash
pytest -q          # full suite, 118+ tests, ~40 s
```

Covers: Pydantic round-trip for every model, upload contract (size / mime / count / fixture-id collision), pipeline state-machine, Opus extraction with `menu_category`, reconciliation, search, sources page byte serving, the `mise.catalog.v1` JSON contract, and all four demo-critical decisions surfacing through `GET /api/review/{processing_id}`.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/upload` | Multipart upload of up to 10 files (jpg/png/pdf, ≤25 MB each) → `UploadBatch`. In `MISE_PIPELINE_MODE=real` every upload gets a fresh `src_id`; fixture IDs are only reused in `mock`/`fallback`. |
| POST | `/api/process/{batch_id}` | Kick off the pipeline → `{ processing_id }` |
| GET | `/api/process/{processing_id}` | Poll the `ProcessingRun` state |
| GET | `/api/review/{processing_id}` | Full `CockpitState` once ready (partial if still processing) |
| POST | `/api/review/{processing_id}/decisions` | Approve / edit / reject a canonical or ephemeral |
| POST | `/api/search/{processing_id}` | Natural-language search over the dish graph (alias, semantic, modifier reasons) |
| GET | `/api/sources/{source_id}/content` | Original file bytes, for the `<SourcePreviewModal>` |
| GET | `/api/sources/{source_id}/page/{n}.png` | Per-page PNG render (PDFs) for the Sources view |
| GET | `/api/catalog/{processing_id}.json` | The `mise.catalog.v1` JSON catalog — the **external contract**, plug-and-play for any consumer |
| GET | `/api/health` | `{ status, version, model }` |

### Pipeline modes (`MISE_PIPELINE_MODE`)

| Mode | When | Behaviour |
|---|---|---|
| `real` (default if `ANTHROPIC_API_KEY` is set) | Production / live demo | Calls Opus 4.7 vision. Every upload gets a unique `src_id`. |
| `mock` | Dev without keys | Returns the deterministic Argentine fixture. Fixture filenames map to stable `src_id`s. |
| `fallback` | CI / offline tests | Real path with mock fallback if the API call fails. |

## Layout

```
app/
  main.py             # FastAPI factory, CORS, router wiring
  core/
    config.py         # env-backed Settings (pydantic-settings)
    store.py          # thread-safe in-memory store
  domain/
    models.py         # Pydantic contract (mirrors frontend/src/domain/types.ts)
    fixtures.py       # deterministic demo state (same UUIDs as frontend mock)
  api/
    upload.py
    processing.py
    review.py
    sources.py
    search.py
    catalog.py
  ai/
    client.py         # thin wrapper over the Anthropic Messages API
    prompts/          # extraction.md, reconcile.md
  pipeline.py         # orchestrates extraction → reconciliation → cockpit
tests/                # 118+ tests covering models, upload, pipeline, extraction,
                      # reconciliation, search, sources, catalog, quality
```

## Contract

The frontend types in `frontend/src/domain/types.ts` mirror `app/domain/models.py` one-for-one. The JSON catalog shape served by `GET /api/catalog/{run_id}.json` is the external contract — anything else is internal and may change.

## Non-goals (frozen)

- No external DB — the stable JSON catalog is the external contract, persistence is out of MVP scope
- No auth — not on the rubric
- No websockets — short polling is enough for the demo bundles
