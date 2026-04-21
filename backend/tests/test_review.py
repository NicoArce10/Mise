"""GET /api/review/{processing_id} + POST /api/review/{processing_id}/decisions."""
from __future__ import annotations

import time

from fastapi.testclient import TestClient


def _pdf_bytes() -> bytes:
    return b"%PDF-1.4\nmock\n%%EOF\n"


def _jpg_bytes() -> bytes:
    return b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xd9"


def _run_pipeline_to_ready(client: TestClient) -> str:
    # Upload matches fixture filenames → fixture UUIDs propagate.
    up = client.post(
        "/api/upload",
        files=[
            ("files", ("menu_pdf_branch_a.pdf", _pdf_bytes(), "application/pdf")),
            ("files", ("menu_photo_branch_b.jpg", _jpg_bytes(), "image/jpeg")),
        ],
    )
    batch_id = up.json()["id"]
    processing_id = client.post(f"/api/process/{batch_id}").json()["processing_id"]

    deadline = time.time() + 5.0
    while time.time() < deadline:
        state = client.get(f"/api/process/{processing_id}").json()["state"]
        if state == "ready":
            return processing_id
        time.sleep(0.1)
    raise AssertionError("pipeline never reached ready")


def test_review_returns_four_demo_critical_decisions(client: TestClient) -> None:
    processing_id = _run_pipeline_to_ready(client)
    resp = client.get(f"/api/review/{processing_id}")
    assert resp.status_code == 200
    body = resp.json()

    # Margherita: typo normalized merge
    canonicals = {d["canonical_name"]: d for d in body["canonical_dishes"]}
    assert "Margherita" in canonicals
    assert "Marghertia" in canonicals["Margherita"]["aliases"]
    assert canonicals["Margherita"]["decision"]["lead_word"] == "Merged"

    # Pizza Funghi vs Calzone Funghi: both present, not merged
    assert "Pizza Funghi" in canonicals
    assert "Calzone Funghi" in canonicals
    calzone = canonicals["Calzone Funghi"]
    assert calzone["decision"]["lead_word"] == "Not merged"
    assert "dish type differs" in calzone["decision"]["text"]

    # add burrata +3: modifier attached to Margherita
    burrata = next((m for m in body["modifiers"] if m["text"] == "add burrata +3"), None)
    assert burrata is not None
    assert burrata["parent_dish_id"] == canonicals["Margherita"]["id"]

    # Chef's Special: routed as ephemeral
    eph_texts = {e["text"] for e in body["ephemerals"]}
    assert "Chef's Special" in eph_texts


def test_review_unknown_run_returns_404(client: TestClient) -> None:
    resp = client.get("/api/review/run-does-not-exist")
    assert resp.status_code == 404


def test_decision_approve_updates_moderation(client: TestClient) -> None:
    processing_id = _run_pipeline_to_ready(client)
    cockpit = client.get(f"/api/review/{processing_id}").json()
    margherita_id = next(
        d["id"] for d in cockpit["canonical_dishes"] if d["canonical_name"] == "Margherita"
    )

    resp = client.post(
        f"/api/review/{processing_id}/decisions",
        json={
            "target_kind": "canonical",
            "target_id": margherita_id,
            "action": "approve",
        },
    )
    assert resp.status_code == 200
    updated = resp.json()
    margherita = next(
        d for d in updated["canonical_dishes"] if d["id"] == margherita_id
    )
    assert margherita["moderation"] == "approved"


def test_decision_unknown_target_returns_404(client: TestClient) -> None:
    processing_id = _run_pipeline_to_ready(client)
    resp = client.post(
        f"/api/review/{processing_id}/decisions",
        json={"target_kind": "canonical", "target_id": "does-not-exist", "action": "approve"},
    )
    assert resp.status_code == 404
