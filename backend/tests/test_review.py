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


def test_decision_edit_applies_patch_fields(client: TestClient) -> None:
    """Edit must actually *change* the dish, not just set moderation='edited'.

    The reviewer patches name + price + category and we expect:
      - moderation → 'edited'
      - canonical_name, price_value, price_currency, menu_category updated
      - exported catalog JSON reflects the new values (round-trip proof)
    """
    processing_id = _run_pipeline_to_ready(client)
    cockpit = client.get(f"/api/review/{processing_id}").json()
    dish = next(d for d in cockpit["canonical_dishes"] if d["canonical_name"] == "Margherita")
    dish_id = dish["id"]

    patch = {
        "canonical_name": "Margherita DOC",
        "price_value": 14.5,
        "price_currency": "EUR",
        "menu_category": "pizza",
    }
    resp = client.post(
        f"/api/review/{processing_id}/decisions",
        json={
            "target_kind": "canonical",
            "target_id": dish_id,
            "action": "edit",
            "edit": patch,
        },
    )
    assert resp.status_code == 200
    updated = resp.json()
    edited = next(d for d in updated["canonical_dishes"] if d["id"] == dish_id)
    assert edited["moderation"] == "edited"
    assert edited["canonical_name"] == "Margherita DOC"
    assert edited["price_value"] == 14.5
    assert edited["price_currency"] == "EUR"
    assert edited["menu_category"] == "pizza"

    # The exported catalog must honor the patch — this is the demo-critical
    # guarantee: moderation edits are not a cosmetic UI-only thing.
    catalog = client.get(f"/api/catalog/{processing_id}.json").json()
    exported = next(d for d in catalog["dishes"] if d["id"] == dish_id)
    assert exported["canonical_name"] == "Margherita DOC"
    assert exported["price"] == {"value": 14.5, "currency": "EUR"}
    assert exported["menu_category"] == "pizza"
    # review_status travels alongside the patched fields
    assert exported["review_status"] == "edited"


def test_decision_edit_ignores_fields_outside_whitelist(client: TestClient) -> None:
    """Security: the reviewer must NOT be able to overwrite ids, source refs,
    decision records, or moderation status via the `edit` payload."""
    processing_id = _run_pipeline_to_ready(client)
    cockpit = client.get(f"/api/review/{processing_id}").json()
    dish = next(d for d in cockpit["canonical_dishes"] if d["canonical_name"] == "Margherita")
    dish_id = dish["id"]

    resp = client.post(
        f"/api/review/{processing_id}/decisions",
        json={
            "target_kind": "canonical",
            "target_id": dish_id,
            "action": "edit",
            "edit": {
                "id": "hijacked",
                "source_ids": [],
                "decision": {"text": "x", "lead_word": "Merged", "confidence": 0.1},
                "moderation": "approved",
                "canonical_name": "Legit rename",
            },
        },
    )
    assert resp.status_code == 200
    edited = next(
        d for d in resp.json()["canonical_dishes"] if d["canonical_name"] == "Legit rename"
    )
    # Original id is preserved — no hijack.
    assert edited["id"] == dish_id
    # Moderation comes from the `action`, not the forged `edit.moderation`.
    assert edited["moderation"] == "edited"
    # Source refs untouched.
    assert edited["source_ids"] == dish["source_ids"]


def test_decision_reject_then_catalog_excludes_dish(client: TestClient) -> None:
    """Reject must remove the dish from the exported catalog JSON — that's
    the end-to-end proof that moderation has a real impact, not just a UI
    chip change."""
    processing_id = _run_pipeline_to_ready(client)
    cockpit = client.get(f"/api/review/{processing_id}").json()
    dish_id = next(
        d["id"] for d in cockpit["canonical_dishes"] if d["canonical_name"] == "Pizza Funghi"
    )

    client.post(
        f"/api/review/{processing_id}/decisions",
        json={"target_kind": "canonical", "target_id": dish_id, "action": "reject"},
    ).raise_for_status()

    catalog = client.get(f"/api/catalog/{processing_id}.json").json()
    ids_in_catalog = {d["id"] for d in catalog["dishes"]}
    assert dish_id not in ids_in_catalog, "rejected dish must be dropped from exported catalog"
