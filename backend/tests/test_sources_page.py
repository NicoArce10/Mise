"""Tests for `GET /api/sources/{source_id}/page/{n}.png`.

These exercise the PDF-page renderer that backs the ScannerOverlay's
"viendo hoja X of N" effect. We intentionally test at the HTTP boundary
(not the internal helper) so the cache key, content-type headers, and
error taxonomy are all validated together — those are the contract the
frontend relies on.
"""
from __future__ import annotations

import hashlib
import io

import pytest
from fastapi.testclient import TestClient


def _make_two_page_pdf_bytes() -> bytes:
    """Build a minimal 2-page PDF in-memory so the test doesn't require
    a fixture file checked into the repo.

    pypdf's `add_blank_page` is enough here — pdfium is happy to render
    a blank page and that's all we need to verify the endpoint wiring.
    """
    from pypdf import PdfWriter

    writer = PdfWriter()
    writer.add_blank_page(width=612, height=792)
    writer.add_blank_page(width=612, height=792)
    buf = io.BytesIO()
    writer.write(buf)
    return buf.getvalue()


def _make_jpeg_bytes() -> bytes:
    """Tiny valid JPEG so we can register a non-PDF source for 404 tests."""
    from PIL import Image

    img = Image.new("RGB", (10, 10), color=(128, 128, 128))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


def _register_pdf_source(client: TestClient, data: bytes) -> str:
    """Insert a PDF source into the in-process store and return its id.

    We bypass the upload endpoint on purpose: the upload endpoint calls
    the extraction pipeline, which isn't what we're testing here.
    Directly poking the store gives a fast, deterministic setup.
    """
    from datetime import UTC, datetime

    from app.core.store import new_id, store
    from app.domain.models import SourceDocument, SourceKind, UploadBatch

    src_id = new_id("src")
    batch_id = new_id("batch")
    src = SourceDocument(
        id=src_id,
        filename="two_page_menu.pdf",
        kind=SourceKind.PDF,
        content_type="application/pdf",
        sha256=hashlib.sha256(data).hexdigest(),
        page_count=2,
    )
    batch = UploadBatch(
        id=batch_id,
        uploaded_at=datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        sources=[src],
    )
    store.save_batch(batch)
    store.save_source_bytes(src_id, data)

    # The page renderer memoises by sha256; clear its cache so tests
    # don't leak rendered PNGs across each other (the `client` fixture
    # reloads `app.core.store` but the sources module lives on).
    import app.api.sources as sources_mod

    sources_mod._render_page_png.cache_clear()
    return src_id


def _register_image_source(client: TestClient, data: bytes) -> str:
    from datetime import UTC, datetime

    from app.core.store import new_id, store
    from app.domain.models import SourceDocument, SourceKind, UploadBatch

    src_id = new_id("src")
    src = SourceDocument(
        id=src_id,
        filename="chalkboard.jpg",
        kind=SourceKind.PHOTO,
        content_type="image/jpeg",
        sha256=hashlib.sha256(data).hexdigest(),
    )
    batch = UploadBatch(
        id=new_id("batch"),
        uploaded_at=datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        sources=[src],
    )
    store.save_batch(batch)
    store.save_source_bytes(src_id, data)
    return src_id


def test_page_endpoint_returns_png_for_valid_page(client: TestClient) -> None:
    data = _make_two_page_pdf_bytes()
    src_id = _register_pdf_source(client, data)

    resp = client.get(f"/api/sources/{src_id}/page/1.png")

    assert resp.status_code == 200
    assert resp.headers["content-type"] == "image/png"
    # PNG magic number — confirms pdfium actually rendered the page
    # instead of the handler returning an empty body by accident.
    assert resp.content[:8] == b"\x89PNG\r\n\x1a\n"


def test_page_endpoint_returns_same_bytes_for_second_page(client: TestClient) -> None:
    """Both pages must render distinctly (different payloads) — ensures
    we're not accidentally ignoring page_number in the cache key."""
    data = _make_two_page_pdf_bytes()
    src_id = _register_pdf_source(client, data)

    p1 = client.get(f"/api/sources/{src_id}/page/1.png")
    p2 = client.get(f"/api/sources/{src_id}/page/2.png")
    assert p1.status_code == 200 and p2.status_code == 200
    # Two blank pages with identical dimensions render to identical
    # bitmaps, so we can't compare bytes; instead we assert the cache
    # got two entries keyed on (sha, idx).
    import app.api.sources as sources_mod

    assert sources_mod._render_page_png.cache_info().currsize >= 2


def test_page_endpoint_404s_when_source_not_found(client: TestClient) -> None:
    resp = client.get("/api/sources/src-doesnotexist/page/1.png")
    assert resp.status_code == 404
    assert "not found" in resp.json()["detail"].lower()


def test_page_endpoint_404s_for_non_pdf_source(client: TestClient) -> None:
    data = _make_jpeg_bytes()
    src_id = _register_image_source(client, data)
    resp = client.get(f"/api/sources/{src_id}/page/1.png")
    assert resp.status_code == 404
    assert "pdf" in resp.json()["detail"].lower()


def test_page_endpoint_400s_for_zero_or_negative_page(client: TestClient) -> None:
    data = _make_two_page_pdf_bytes()
    src_id = _register_pdf_source(client, data)
    resp = client.get(f"/api/sources/{src_id}/page/0.png")
    assert resp.status_code == 400


def test_page_endpoint_404s_for_out_of_range_page(client: TestClient) -> None:
    data = _make_two_page_pdf_bytes()
    src_id = _register_pdf_source(client, data)
    # 2-page PDF → page 3 is out of range.
    resp = client.get(f"/api/sources/{src_id}/page/3.png")
    assert resp.status_code == 404


def test_page_endpoint_sends_long_cache_header(client: TestClient) -> None:
    """Frontend fetches the same (source, page) multiple times as the
    overlay loops; we must not round-trip through pdfium each time."""
    data = _make_two_page_pdf_bytes()
    src_id = _register_pdf_source(client, data)

    resp = client.get(f"/api/sources/{src_id}/page/1.png")
    assert resp.status_code == 200
    cc = resp.headers.get("cache-control", "")
    assert "max-age" in cc
    assert "immutable" in cc


@pytest.mark.parametrize("bad_page", [-1, 9999])
def test_page_endpoint_rejects_obviously_bad_numbers(
    client: TestClient, bad_page: int
) -> None:
    data = _make_two_page_pdf_bytes()
    src_id = _register_pdf_source(client, data)
    resp = client.get(f"/api/sources/{src_id}/page/{bad_page}.png")
    assert resp.status_code in {400, 404, 422}
