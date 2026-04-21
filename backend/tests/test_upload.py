"""POST /api/upload contract tests."""
from __future__ import annotations

import io

from fastapi.testclient import TestClient


def _pdf_bytes(marker: bytes = b"mock-pdf") -> bytes:
    # Minimal "%PDF-" header so a human inspector can tell it apart.
    return b"%PDF-1.4\n" + marker + b"\n%%EOF\n"


def _jpg_bytes() -> bytes:
    # SOI + a tiny JFIF stub + EOI. Enough to upload; no image parser runs server-side.
    return b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xd9"


def test_upload_accepts_pdf_and_jpg(client: TestClient) -> None:
    resp = client.post(
        "/api/upload",
        files=[
            ("files", ("menu_pdf_branch_a.pdf", _pdf_bytes(), "application/pdf")),
            ("files", ("menu_photo_branch_b.jpg", _jpg_bytes(), "image/jpeg")),
        ],
    )
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert "id" in data
    assert len(data["sources"]) == 2
    kinds = {s["kind"] for s in data["sources"]}
    assert kinds == {"pdf", "photo"}

    # Fixture filenames are remapped to fixture source IDs so the pipeline ends
    # up producing the demo-critical canonical decisions downstream.
    ids = [s["id"] for s in data["sources"]]
    assert "src-pdf-branch-a" in ids
    assert "src-photo-branch-b" in ids


def test_upload_rejects_empty(client: TestClient) -> None:
    # FastAPI's File(...) validation yields 422 when no files field is present.
    resp = client.post("/api/upload", files=[])
    assert resp.status_code in (400, 422)


def test_upload_rejects_unsupported_content_type(client: TestClient) -> None:
    resp = client.post(
        "/api/upload",
        files=[("files", ("note.txt", b"hello", "text/plain"))],
    )
    assert resp.status_code == 415


def test_upload_rejects_over_limit(client: TestClient) -> None:
    many = [
        ("files", (f"f{i}.jpg", _jpg_bytes(), "image/jpeg")) for i in range(11)
    ]
    resp = client.post("/api/upload", files=many)
    assert resp.status_code == 400
