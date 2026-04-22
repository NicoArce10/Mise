"""GET /api/sources/{source_id}/content — stream the uploaded raw file back.

Lets the frontend render "view the menu you uploaded" in-page so the judge
sees the full chain: *original PDF/photo → extracted dish graph → natural-
language answer*. Without this endpoint the UI can only show filenames and
metadata, which is a significant demo regression.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Response, status

from ..core.store import store
from ..domain.models import EntityId


router = APIRouter(prefix="/api/sources", tags=["sources"])


@router.get(
    "/{source_id}/content",
    # Raw bytes — no Pydantic model. FastAPI auto-docs will surface the
    # endpoint with its actual content-type range.
    responses={
        200: {"content": {"application/octet-stream": {}}},
        404: {"description": "Source not found or bytes never persisted."},
    },
)
def get_source_content(source_id: EntityId) -> Response:
    src = store.find_source(source_id)
    if src is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"source_id not found: {source_id}",
        )
    data = store.get_source_bytes(source_id)
    if data is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                f"source_id {source_id} has no persisted bytes — it was "
                "materialised from a fixture, not an upload."
            ),
        )
    headers = {
        # Inline so PDFs and images render in the browser instead of
        # triggering a download. Filename hint helps if the reviewer
        # chooses to save it.
        "Content-Disposition": f'inline; filename="{src.filename}"',
        # Short cache so the dev loop stays snappy; production would set
        # a content-hash aware cache key.
        "Cache-Control": "private, max-age=30",
    }
    return Response(
        content=data,
        media_type=src.content_type or "application/octet-stream",
        headers=headers,
    )
