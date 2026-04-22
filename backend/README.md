# Mise — Backend

FastAPI + Pydantic v2. Serves the Review Cockpit via five endpoints backed by an in-memory store. Opus 4.7 integration lands in Milestone 4.

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
pytest -q
```

Covers: Pydantic round-trip for every model, upload contract, state-machine advancement, and all four demo-critical decisions surfacing through `GET /api/review/{processing_id}`.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/upload` | Multipart upload of up to 10 files (jpg/png/pdf, ≤10 MB each) → `UploadBatch` |
| POST | `/api/process/{batch_id}` | Kick off the pipeline → `{ processing_id }` |
| GET | `/api/process/{processing_id}` | Poll the `ProcessingRun` state |
| GET | `/api/review/{processing_id}` | Full `CockpitState` once ready (partial if still processing) |
| POST | `/api/review/{processing_id}/decisions` | Approve / edit / reject a canonical or ephemeral |
| GET | `/api/health` | `{ status, version, model }` |

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
tests/
  test_models.py
  test_upload.py
  test_processing.py
  test_review.py
```

## Contract

The frontend types in `frontend/src/domain/types.ts` mirror `app/domain/models.py` one-for-one. The JSON catalog shape served by `GET /api/catalog/{run_id}.json` is the external contract — anything else is internal and may change.

## Non-goals (frozen)

- No external DB — the stable JSON catalog is the external contract, persistence is out of MVP scope
- No auth — not on the rubric
- No websockets — short polling is enough for the demo bundles
