"""Source-bytes and rendered-page endpoints.

- `GET /api/sources/{source_id}/content` — stream the uploaded raw file.
- `GET /api/sources/{source_id}/page/{n}.png` — render a PDF page as PNG
  so the frontend ScannerOverlay can show "viendo hoja X of N" with the
  actual page content instead of a static placeholder.

Both endpoints are demo-critical: the judge sees the original menu next
to the extracted dish graph, and the scanner animation feels real
because it's paging through the reviewer's actual PDF, not a stock
loop.
"""
from __future__ import annotations

import io
import logging
import threading
from functools import lru_cache

from fastapi import APIRouter, HTTPException, Response, status

from ..core.store import store
from ..domain.models import EntityId, SourceKind

router = APIRouter(prefix="/api/sources", tags=["sources"])
log = logging.getLogger("mise.sources")


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


# ---------------------------------------------------------------------
# PDF page → PNG
# ---------------------------------------------------------------------

# Rendering scale. 1.0 = 72dpi; 1.5 = 108dpi, which is a good compromise
# between sharpness on a retina-ish laptop display and file size on the
# wire. The ScannerOverlay caps the preview at ~440px wide, so anything
# higher than this is redundant.
_RENDER_SCALE = 1.5

# Bound the max page index we'll render even if a client asks for a
# huge page number. This prevents an adversarial query from pinning
# memory by repeatedly constructing fresh documents for absurd indices
# — anything out of range 404s early without touching pdfium.
_MAX_PAGE_INDEX = 2000

# Serialize pdfium access behind a process-wide lock. pdfium is
# thread-safe at the library level, but loading a fresh PdfDocument
# + rendering a page allocates a non-trivial amount of memory, and we
# don't want a burst of concurrent requests (e.g. the ScannerOverlay
# fetching pages 1..17 as the user hovers) to amplify that footprint.
# The cost of the lock is negligible because individual renders finish
# in tens of ms for typical restaurant-menu PDFs.
_render_lock = threading.Lock()


@lru_cache(maxsize=256)
def _render_page_png(sha256: str, page_index: int) -> bytes | None:
    """Render the given page of a PDF (keyed on the source's sha256) to
    PNG bytes and cache the result.

    Returns `None` when the SHA can't be resolved to persisted bytes,
    the PDF fails to parse, or the page index is out of range. The
    cache key is intentionally the content hash (not the source id)
    so two sources with identical bytes hit the same slot.

    The cache is bounded (lru_cache maxsize=256) so a run with a 400-
    page PDF can't evict everything we rendered for the current demo.
    If we ever grow past that, switch to a byte-size-aware cache.
    """
    import pypdfium2 as pdfium
    from PIL import Image

    data = store.get_source_bytes_by_sha(sha256)
    if data is None:
        return None

    with _render_lock:
        try:
            pdf = pdfium.PdfDocument(data)
        except Exception as exc:  # pdfium raises a handful of subclasses
            log.warning("pdfium failed to open %s: %s", sha256[:8], exc)
            return None
        try:
            n_pages = len(pdf)
            if page_index < 0 or page_index >= n_pages:
                return None
            page = pdf[page_index]
            bitmap = page.render(scale=_RENDER_SCALE, rotation=0)
            pil_image: Image.Image = bitmap.to_pil()
            buf = io.BytesIO()
            # PNG over JPEG so text on menu scans stays crisp. The
            # typical restaurant PDF page is ~150 kB gzipped at this
            # scale — negligible on localhost and acceptable on the
            # public demo.
            pil_image.save(buf, format="PNG", optimize=True)
            return buf.getvalue()
        finally:
            # Explicit close releases the native handle so the lru
            # cache above doesn't keep a doc alive per render.
            pdf.close()


@router.get(
    "/{source_id}/page/{page_number}.png",
    responses={
        200: {"content": {"image/png": {}}},
        400: {"description": "Page number out of range or non-PDF source."},
        404: {"description": "Source not found, not a PDF, or page not renderable."},
    },
)
def get_source_page(source_id: EntityId, page_number: int) -> Response:
    """Render page `page_number` (1-indexed) of a PDF source as a PNG.

    Contract:
    - 1-indexed to match the UI — users and prompts talk in "page 1 of 17".
    - 404 if the source doesn't exist, isn't a PDF, or has no persisted
      bytes (fixture-materialised sources).
    - 400 if the page number is obviously out of range (<=0, >2000, or
      past the PDF's last page).
    """
    if page_number <= 0 or page_number > _MAX_PAGE_INDEX:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"page_number must be between 1 and {_MAX_PAGE_INDEX}, "
                f"got {page_number}"
            ),
        )

    src = store.find_source(source_id)
    if src is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"source_id not found: {source_id}",
        )
    if src.kind is not SourceKind.PDF:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                f"source {src.filename!r} is not a PDF "
                f"(kind={src.kind.value}); page rendering is PDF-only."
            ),
        )

    png = _render_page_png(src.sha256, page_number - 1)
    if png is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=(
                f"couldn't render page {page_number} of {src.filename!r}. "
                "The PDF may be corrupt, encrypted, or the page is out of "
                "range."
            ),
        )

    return Response(
        content=png,
        media_type="image/png",
        headers={
            # Long cache: the PNG for (sha, page) never changes — if a
            # user uploads a different PDF it gets a different sha and
            # therefore a different cache key. Uses `immutable` so
            # Chrome doesn't revalidate on tab switch.
            "Cache-Control": "public, max-age=3600, immutable",
        },
    )
