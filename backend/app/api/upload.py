"""POST /api/upload — multipart upload, returns a UploadBatch."""
from __future__ import annotations

import hashlib
import io
import logging
import os
from datetime import UTC, datetime

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from ..core.store import new_id, store
from ..domain.fixtures import IDS
from ..domain.models import SourceDocument, SourceKind, UploadBatch

log = logging.getLogger(__name__)


def _pdf_page_count(data: bytes) -> int | None:
    """Return the number of pages in a PDF, or None if the bytes are not a
    readable PDF.

    Failure is not fatal — the pipeline still runs on the PDF as a
    `document` block regardless of whether we know the page count.
    The page count is only used by the UI to display a "page 1 of N"
    ribbon during the scanner phase. Catch broadly on purpose:
    encrypted PDFs, truncated uploads, and pypdf version quirks all
    throw different exceptions and none of them should crash the
    upload endpoint.
    """
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(data))
        n = len(reader.pages)
        # pypdf reports 0 for malformed files; treat that as unknown.
        return n if n > 0 else None
    except Exception as e:  # noqa: BLE001 — see docstring
        log.debug("Could not read PDF page count: %s", e)
        return None

router = APIRouter(prefix="/api/upload", tags=["upload"])


_MAX_FILES = 10
# 25 MB per file. Real restaurant menu PDFs routinely land in the 15-22 MB
# range because they embed full-page photos for each section; a 10 MB cap
# rejected legitimate uploads with a silent 413 and sent the user to
# sample mode, which looked like "no dishes extracted" from the UI. 25 MB
# comfortably covers every menu we tested and still stops accidental
# cookbook-sized uploads from hitting Anthropic.
_MAX_BYTES = 25 * 1024 * 1024  # 25 MB
_MAX_MB = _MAX_BYTES // (1024 * 1024)
_ALLOWED_CONTENT_TYPES: set[str] = {"image/jpeg", "image/png", "application/pdf"}


# Filenames from the three demo bundles — when the upload matches one of
# these AND we're in mock/fallback mode, we reuse the fixture UUID so the
# downstream pipeline returns the pre-scripted demo content. Production
# (`MISE_PIPELINE_MODE=real`) never reuses fixture ids: every upload gets a
# fresh `src_*` so a user who happens to name their menu
# `menu_pdf_branch_a.pdf` doesn't quietly collide with the demo dataset.
_FIXTURE_FILE_MAP: dict[str, str] = {
    "menu_pdf_branch_a.pdf": IDS.SRC_PDF_A,
    "menu_photo_branch_b.jpg": IDS.SRC_PHOTO_B,
    "chalkboard_branch_c.jpg": IDS.SRC_CHALK_C,
    "instagram_post_special.png": IDS.SRC_IG_POST,
    "modifiers_chalkboard.jpg": IDS.SRC_TAQ_CHALK,
}


def _fixture_id_for(filename: str) -> str | None:
    """Return the fixture src id for a demo filename, but only when the
    pipeline is configured for mock/fallback. In real mode every upload
    is a real upload — no implicit fixture aliasing.
    """
    mode = os.environ.get("MISE_PIPELINE_MODE", "").lower()
    has_key = bool(os.environ.get("ANTHROPIC_API_KEY"))
    # `real` is the only mode where we skip the fixture map. Empty mode
    # without an API key implicitly means fallback (the eval harness
    # default), so demo filenames keep their stable ids there too.
    if mode == "real" or (mode == "" and has_key):
        return None
    return _FIXTURE_FILE_MAP.get(filename)


def _infer_kind(filename: str, content_type: str) -> SourceKind:
    ct = content_type.lower()
    fn = filename.lower()
    if ct == "application/pdf":
        return SourceKind.PDF
    if "instagram" in fn or "post" in fn:
        return SourceKind.POST
    if "chalk" in fn or "board" in fn:
        return SourceKind.BOARD
    return SourceKind.PHOTO


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=UploadBatch,
)
async def upload(files: list[UploadFile] = File(...)) -> UploadBatch:
    if not files:
        raise HTTPException(status_code=400, detail="no files provided")
    if len(files) > _MAX_FILES:
        raise HTTPException(status_code=400, detail=f"at most {_MAX_FILES} files allowed")

    sources: list[SourceDocument] = []
    for f in files:
        if f.content_type not in _ALLOWED_CONTENT_TYPES:
            # Human-readable detail so the UI can render "We only accept
            # PDF, JPG or PNG" without having to translate MIME strings.
            raise HTTPException(
                status_code=415,
                detail=(
                    f"{f.filename or 'file'}: unsupported type "
                    f"({f.content_type}). We only accept PDF, JPG or PNG."
                ),
            )
        data = await f.read()
        if len(data) > _MAX_BYTES:
            size_mb = len(data) / (1024 * 1024)
            raise HTTPException(
                status_code=413,
                detail=(
                    f"{f.filename or 'file'} is {size_mb:.1f} MB — above the "
                    f"{_MAX_MB} MB per-file limit. "
                    "Try exporting the PDF at a lower resolution, or split "
                    "it into single-page uploads."
                ),
            )
        sha = hashlib.sha256(data).hexdigest()
        fname = f.filename or f"upload-{len(sources)}"
        src_id = _fixture_id_for(fname) or new_id("src")
        kind = _infer_kind(fname, f.content_type or "application/octet-stream")
        # Compute `page_count` only for PDFs; photos/posts/boards are
        # single-page by construction and leaving the field None means
        # "not applicable" in the UI.
        page_count = _pdf_page_count(data) if kind is SourceKind.PDF else None
        sources.append(
            SourceDocument(
                id=src_id,
                filename=fname,
                kind=kind,
                content_type=f.content_type or "application/octet-stream",
                sha256=sha,
                width_px=None,
                height_px=None,
                page_count=page_count,
            )
        )
        # Persist the raw bytes so the real pipeline can read them in the
        # worker thread. Without this, the pipeline falls back to the
        # filename-keyed fixture and the uploaded file is effectively
        # ignored — the bug the user hit when uploading their own menu.
        store.save_source_bytes(src_id, data)

    batch = UploadBatch(
        id=new_id("batch"),
        sources=sources,
        uploaded_at=datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
    )
    store.save_batch(batch)
    return batch
