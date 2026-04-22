"""POST /api/search/{processing_id} — natural-language dish search.

Takes a diner query, runs it against the canonical dish graph for the
given processing run, and returns up to 5 ranked matches with a one-line
reason per match.
"""
from __future__ import annotations

import logging
import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..ai.search import SearchResult, search_dishes, search_fallback
from ..core.store import store
from ..domain.models import EntityId

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/search", tags=["search"])


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=300)
    top_k: int = Field(default=5, ge=1, le=10)


def _mode() -> str:
    """`real` when ANTHROPIC_API_KEY is set and MISE_SEARCH_MODE is not `fallback`.
    Gives eval / offline demos a deterministic path.
    """
    if os.environ.get("MISE_SEARCH_MODE", "").lower() == "fallback":
        return "fallback"
    return "real" if os.environ.get("ANTHROPIC_API_KEY") else "fallback"


@router.post("/{processing_id}", response_model=SearchResult)
async def search(processing_id: EntityId, body: SearchRequest) -> SearchResult:
    cockpit = store.get_cockpit(processing_id)
    if cockpit is None:
        run = store.get_run_meta(processing_id)
        if run is None:
            raise HTTPException(status_code=404, detail=f"run {processing_id} not found")
        raise HTTPException(
            status_code=409,
            detail=f"run {processing_id} is not ready yet (state={run.state})",
        )

    if _mode() == "real":
        return search_dishes(query=body.query, cockpit=cockpit, top_k=body.top_k)
    return search_fallback(query=body.query, cockpit=cockpit, top_k=body.top_k)
