# Prompt 3 — Backend shell with mock responses

## Read first (in this order)
- The approved architecture plan from milestone 1 (`docs/plans/YYYY-MM-DD-architecture.md`)
- The Cockpit code from milestone 2 — its fetch calls define the contract
- `docs/preflight.md` — verify Gate 2 is green before proceeding

## Skills to invoke
1. `writing-plans` — expand this prompt into bite-sized tasks in `docs/plans/YYYY-MM-DD-backend.md`
2. `executing-plans` — run the plan, committing per task
3. `fastapi-python` — FastAPI patterns
4. `fastapi-templates` — project structure
5. `python-code-style` — PEP 8 + type hints everywhere + ruff-clean
6. `test-driven-development` — TDD for the critical paths (upload, process, review)
7. `systematic-debugging` — only if needed
8. `verification-before-completion` — before marking done

## Goal
Scaffold a FastAPI service that matches the API contract from milestone 1 and returns mock responses shaped exactly like the real ones. The Cockpit must be able to consume this backend without further changes.

No AI calls in this milestone. The endpoints return realistic mocks derived from the milestone 1 mock data plan.

## Stack
- Python 3.11+
- FastAPI
- Pydantic v2
- uvicorn
- pytest
- Optional: `python-multipart` for upload
- Absolutely no LangChain / LlamaIndex / any orchestration framework

## Requirements
- Project layout under `backend/`:
  ```
  backend/
    app/
      main.py
      api/
        upload.py
        processing.py
        review.py
      domain/
        models.py       # Pydantic models from the architecture plan
        fixtures.py     # mock data identical in shape to real responses
      core/
        config.py
        logging.py
    tests/
      test_upload.py
      test_processing.py
      test_review.py
    requirements.txt
    pyproject.toml      # ruff + pytest config
  ```
- Endpoints (minimum for the demo):
  - `POST /api/upload` — accept multipart files, return an `UploadBatch` with an `id`
  - `POST /api/process/{batch_id}` — start processing, return an accepted response with a `processing_id`
  - `GET /api/process/{processing_id}` — return processing state (queued / extracting / reconciling / routing / ready)
  - `GET /api/review/{processing_id}` — return the Cockpit state (canonical dishes, modifiers, ephemerals, decision summaries, provenance, confidence)
  - `POST /api/review/{processing_id}/decisions` — accept Approve / Edit / Reject for a specific dish id
- CORS configured for `http://127.0.0.1:5173` from `CORS_ORIGINS` env
- Domain models imported from `app.domain.models`, matching the milestone 1 contract exactly
- Mock data is deterministic and includes the four demo-critical decisions

## Tests (pytest)
- `test_upload.py` — multipart upload accepts at least one PDF and one image, returns a `201` with an id
- `test_processing.py` — `POST /api/process/{batch_id}` returns `202` with a `processing_id`; `GET /api/process/{processing_id}` advances through states deterministically for the mock path
- `test_review.py` — `GET /api/review/{processing_id}` returns all four demo-critical decisions in the correct shape and routing

## Output
- A runnable backend under `backend/` with the commands in `backend/README.md`
- Exact run commands, endpoint list, sample request/response payloads documented in the milestone 3 plan
- `pytest -q` exits 0 with at least the three tests above passing

## Verification (Gate 3)
- `uvicorn app.main:app --reload --port 8000` starts without errors
- Cockpit configured with `VITE_API_BASE=http://127.0.0.1:8000` renders real data fetched from the backend (the Cockpit stops using its local mocks on the happy path)
- All four demo-critical decisions appear in the Cockpit from backend responses
- `pytest -q` passes
