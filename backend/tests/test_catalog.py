"""GET /api/catalog/{processing_id}.json — plug-it-into-anything export."""
from __future__ import annotations

import time

from fastapi.testclient import TestClient


def _pdf_bytes() -> bytes:
    return b"%PDF-1.4\nmock\n%%EOF\n"


def _jpg_bytes() -> bytes:
    return b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xd9"


def _run_pipeline_to_ready(client: TestClient) -> str:
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


def test_catalog_exports_full_dish_graph(client: TestClient) -> None:
    processing_id = _run_pipeline_to_ready(client)

    resp = client.get(f"/api/catalog/{processing_id}.json")
    assert resp.status_code == 200

    assert resp.headers["content-type"].startswith("application/json")
    assert "attachment" in resp.headers.get("content-disposition", "")
    assert processing_id in resp.headers.get("content-disposition", "")

    body = resp.json()
    assert body["run_id"] == processing_id
    assert body["model"] == "claude-opus-4-7"
    assert isinstance(body["dishes"], list)
    assert len(body["dishes"]) > 0

    dish = body["dishes"][0]
    assert "id" in dish
    assert "canonical_name" in dish
    assert "aliases" in dish
    assert "search_terms" in dish
    assert "modifiers" in dish
    assert "sources" in dish
    assert "confidence" in dish

    margherita = next(
        (d for d in body["dishes"] if d["canonical_name"] == "Margherita"), None
    )
    assert margherita is not None
    assert "Marghertia" in margherita["aliases"]
    burrata = next((m for m in margherita["modifiers"] if "burrata" in m["text"]), None)
    assert burrata is not None

    eph_texts = {e["text"] for e in body["ephemerals"]}
    assert "Chef's Special" in eph_texts

    counts = body["counts"]
    assert counts["dishes"] == len(body["dishes"])
    assert counts["ephemerals"] == len(body["ephemerals"])


def test_catalog_404_for_unknown_run(client: TestClient) -> None:
    resp = client.get("/api/catalog/run-does-not-exist.json")
    assert resp.status_code == 404


def test_catalog_unattached_modifiers_and_counts(client: TestClient) -> None:
    processing_id = _run_pipeline_to_ready(client)

    body = client.get(f"/api/catalog/{processing_id}.json").json()
    counts = body["counts"]

    assert counts["sources"] == len(body["sources"])
    assert counts["dishes"] == len(body["dishes"])
    attached = sum(len(d["modifiers"]) for d in body["dishes"])
    assert counts["modifiers_attached"] == attached
    assert counts["modifiers_unattached"] == len(body["unattached_modifiers"])


def test_catalog_includes_quality_signal(client: TestClient) -> None:
    """Every catalog export must carry the heuristic guardrail verdict.

    Downstream systems need `status` to decide whether to auto-publish the
    run or queue it for a reviewer.
    """
    processing_id = _run_pipeline_to_ready(client)

    body = client.get(f"/api/catalog/{processing_id}.json").json()

    assert "quality_signal" in body
    qs = body["quality_signal"]
    assert qs is not None
    assert qs["status"] in {"ready", "review_recommended", "likely_failure"}
    assert 0.0 <= qs["confidence"] <= 1.0
    assert isinstance(qs["flags"], list)
    assert isinstance(qs["reasons"], list)
    assert qs["metrics"]["dish_count"] == len(body["dishes"])
    assert 0.0 <= qs["metrics"]["missing_price_ratio"] <= 1.0
