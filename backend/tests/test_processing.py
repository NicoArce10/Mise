"""POST /api/process/{batch_id} + GET /api/process/{processing_id}."""
from __future__ import annotations

import time

from fastapi.testclient import TestClient


def _pdf_bytes() -> bytes:
    return b"%PDF-1.4\nmock\n%%EOF\n"


def _upload_one(client: TestClient) -> str:
    resp = client.post(
        "/api/upload",
        files=[("files", ("menu_pdf_branch_a.pdf", _pdf_bytes(), "application/pdf"))],
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


def test_start_processing_returns_202_with_processing_id(client: TestClient) -> None:
    batch_id = _upload_one(client)
    resp = client.post(f"/api/process/{batch_id}")
    assert resp.status_code == 202
    assert "processing_id" in resp.json()


def test_start_processing_unknown_batch_returns_404(client: TestClient) -> None:
    resp = client.post("/api/process/batch-does-not-exist")
    assert resp.status_code == 404


def test_processing_advances_to_ready(client: TestClient) -> None:
    batch_id = _upload_one(client)
    processing_id = client.post(f"/api/process/{batch_id}").json()["processing_id"]

    # Poll up to 5 seconds. Mock pipeline completes in ~1.0s total.
    deadline = time.time() + 5.0
    saw_reconciling = False
    final_state = None
    while time.time() < deadline:
        r = client.get(f"/api/process/{processing_id}")
        assert r.status_code == 200
        body = r.json()
        if body["state"] == "reconciling":
            saw_reconciling = True
            assert body.get("state_detail", "").startswith("Adaptive thinking")
        final_state = body["state"]
        if final_state == "ready":
            break
        time.sleep(0.1)

    assert final_state == "ready", f"pipeline stuck at {final_state}"
    assert saw_reconciling, "never observed reconciling state"
