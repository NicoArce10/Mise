"""POST /api/upload — multipart upload, returns a UploadBatch."""
from __future__ import annotations

import hashlib
from datetime import UTC, datetime

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from ..core.store import new_id, store
from ..domain.fixtures import IDS
from ..domain.models import SourceDocument, SourceKind, UploadBatch

router = APIRouter(prefix="/api/upload", tags=["upload"])


_MAX_FILES = 10
_MAX_BYTES = 10 * 1024 * 1024  # 10 MB
_ALLOWED_CONTENT_TYPES: set[str] = {"image/jpeg", "image/png", "application/pdf"}


# Filenames from the three demo bundles — when the upload matches one of these,
# we reuse the fixture UUID so the downstream pipeline returns the pre-scripted
# demo content. Production would not need this branch.
_FIXTURE_FILE_MAP: dict[str, str] = {
    "menu_pdf_branch_a.pdf": IDS.SRC_PDF_A,
    "menu_photo_branch_b.jpg": IDS.SRC_PHOTO_B,
    "chalkboard_branch_c.jpg": IDS.SRC_CHALK_C,
    "instagram_post_special.png": IDS.SRC_IG_POST,
    "modifiers_chalkboard.jpg": IDS.SRC_TAQ_CHALK,
}


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
            raise HTTPException(
                status_code=415,
                detail=f"unsupported content_type: {f.content_type}",
            )
        data = await f.read()
        if len(data) > _MAX_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"file {f.filename} exceeds {_MAX_BYTES} bytes",
            )
        sha = hashlib.sha256(data).hexdigest()
        fname = f.filename or f"upload-{len(sources)}"
        src_id = _FIXTURE_FILE_MAP.get(fname, new_id("src"))
        sources.append(
            SourceDocument(
                id=src_id,
                filename=fname,
                kind=_infer_kind(fname, f.content_type or "application/octet-stream"),
                content_type=f.content_type or "application/octet-stream",
                sha256=sha,
                width_px=None,
                height_px=None,
            )
        )

    batch = UploadBatch(
        id=new_id("batch"),
        sources=sources,
        uploaded_at=datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
    )
    store.save_batch(batch)
    return batch
