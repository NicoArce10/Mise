"""Mise backend — FastAPI + Pydantic v2.

External contract: `GET /api/catalog/{run_id}.json` returns the dish graph
as plug-it-anywhere JSON. Domain models are in `app.domain.models`; the
frontend mirror lives in `frontend/src/domain/types.ts`.
"""

__version__ = "0.1.0"
