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


# ---------- plug-and-play contract tests ----------


def test_catalog_carries_schema_version(client: TestClient) -> None:
    """Every export must declare its contract version so downstream
    consumers can pin against `schema_version == "mise.catalog.v1"`.

    Pinning this prevents accidental shape drift: if a future PR changes
    the export shape, this test forces a deliberate version bump.
    """
    processing_id = _run_pipeline_to_ready(client)
    body = client.get(f"/api/catalog/{processing_id}.json").json()

    assert body.get("schema_version") == "mise.catalog.v1", (
        f"schema_version drifted: got {body.get('schema_version')!r}"
    )


def test_catalog_generated_at_is_never_empty(client: TestClient) -> None:
    """`generated_at` must always be a parseable ISO-8601 string. An empty
    string crashes `Date.parse()` / `datetime.fromisoformat` in any
    downstream consumer — observed live on a production export before this
    fix.
    """
    from datetime import datetime

    processing_id = _run_pipeline_to_ready(client)
    body = client.get(f"/api/catalog/{processing_id}.json").json()

    assert isinstance(body.get("generated_at"), str)
    assert body["generated_at"].strip() != "", (
        "generated_at MUST never be an empty string — that breaks every "
        "downstream JSON parser that expects a timestamp"
    )

    iso = body["generated_at"].rstrip("Z").replace("Z", "")
    parsed = datetime.fromisoformat(iso)
    assert parsed is not None


def test_catalog_dish_keys_are_stable_for_plug_and_play(client: TestClient) -> None:
    """Every dish row carries the full plug-and-play key set.

    Downstream POS / delivery / review systems consume these keys by
    name; pinning the contract here means a missing key is a test
    failure, not a runtime error in production.
    """
    processing_id = _run_pipeline_to_ready(client)
    body = client.get(f"/api/catalog/{processing_id}.json").json()

    assert len(body["dishes"]) > 0, "fixture should produce at least one dish"

    required_keys = {
        "id",
        "canonical_name",
        "aliases",
        "search_terms",
        "ingredients",
        "menu_category",
        "price",
        "modifiers",
        "sources",
        "confidence",
        "decision_summary",
    }
    for dish in body["dishes"]:
        missing = required_keys - dish.keys()
        assert not missing, f"dish {dish.get('id')} missing keys {missing}"
        # Type sanity: lists are lists, optional fields can be None but never undefined.
        assert isinstance(dish["aliases"], list)
        assert isinstance(dish["search_terms"], list)
        assert isinstance(dish["ingredients"], list)
        assert isinstance(dish["modifiers"], list)
        assert isinstance(dish["sources"], list)
        assert dish["price"] is None or isinstance(dish["price"], dict)
        assert dish["menu_category"] is None or isinstance(dish["menu_category"], str)
        assert isinstance(dish["confidence"], (int, float))
        assert 0.0 <= float(dish["confidence"]) <= 1.0


def test_catalog_fallback_run_populates_menu_category(client: TestClient) -> None:
    """End-to-end proof: a fallback run on the italian bundle must produce
    dishes whose `menu_category` is populated, and the quality signal must
    NOT raise `missing_categories` (the bug this whole audit fixes).

    Before the fix: `missing_category_ratio == 1.0` on every run.
    After the fix:  category populated → `missing_categories` flag absent.
    """
    processing_id = _run_pipeline_to_ready(client)
    body = client.get(f"/api/catalog/{processing_id}.json").json()

    categorized = [d for d in body["dishes"] if d["menu_category"]]
    assert len(categorized) > 0, (
        "after the fallback-hint enrichment, at least one dish in the "
        "italian bundle must carry a menu_category"
    )

    flags = body["quality_signal"]["flags"]
    assert "missing_categories" not in flags, (
        "the missing_categories flag must NOT fire on a run whose "
        "fallback hints populate the field — that was the original bug"
    )
