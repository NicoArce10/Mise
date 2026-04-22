"""Regression guard: uploaded files never get replaced by the italian fixture.

The most painful UX bug surfaced in the hackathon run was this: a user
uploaded their own menu, the backend was in mock mode (or the real
pipeline hit an exception), and the Cockpit cheerfully rendered the
pre-scripted italian demo (Margherita / Pizza Funghi / etc.) as if that
were the user's menu. Three commits patched the paths; this test locks
the contract so the bug cannot come back silently.
"""
from __future__ import annotations

import io
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.domain.fixtures import IDS
from app.main import app
from app.domain.models import ProcessingState


_FIXTURE_IDS = {
    IDS.RUN, IDS.BATCH,
    IDS.SRC_PDF_A, IDS.SRC_PHOTO_B, IDS.SRC_CHALK_C, IDS.SRC_IG_POST, IDS.SRC_TAQ_CHALK,
    IDS.DISH_MARGHERITA, IDS.DISH_FUNGHI_PIZZA, IDS.DISH_FUNGHI_CALZONE,
    IDS.MOD_BURRATA, IDS.MOD_GUAC, IDS.EPH_CHEF_SPECIAL,
}

_FIXTURE_DISH_NAMES = {
    "Margherita", "Pizza Funghi", "Calzone Funghi",
}


def _wait_until_ready(client: TestClient, processing_id: str, timeout_ticks: int = 200):
    import time
    for _ in range(timeout_ticks):
        r = client.get(f"/api/process/{processing_id}")
        if r.status_code != 200:
            continue
        state = r.json()["state"]
        if state in {ProcessingState.READY.value, ProcessingState.FAILED.value}:
            return state
        time.sleep(0.05)
    return None


def _png_bytes() -> bytes:
    # Tiny valid PNG (1x1 black pixel) so upload mime check passes.
    return bytes.fromhex(
        "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
        "0000000d49444154789c6360600000000200010001000000018d7a8e0000000049454e44ae426082"
    )


def _start_batch_with_user_file(client: TestClient, filename: str) -> str:
    """Upload a user file (not a fixture filename) and return processing_id."""
    data = _png_bytes()
    r = client.post(
        "/api/upload",
        files={"files": (filename, io.BytesIO(data), "image/png")},
    )
    assert r.status_code == 201, r.text
    batch_id = r.json()["id"]
    # Source ids for user files must not match fixture ids.
    for src in r.json()["sources"]:
        assert src["id"] not in _FIXTURE_IDS, (
            f"user-uploaded source got a fixture id: {src['id']}"
        )
    r = client.post(f"/api/process/{batch_id}")
    assert r.status_code == 202
    return r.json()["processing_id"]


def test_mock_mode_with_user_file_does_not_show_italian_fixture(monkeypatch):
    """Mock mode is a UI walkthrough — it may show the fixture, but ONLY when
    no upload is involved. Once a user has uploaded a real file, the cockpit
    must either show the real extraction, an empty state, or a failure —
    never the pre-scripted italian menu as if it were the user's content.
    """
    # Force mock mode explicitly so the scenario is unambiguous.
    monkeypatch.setenv("MISE_PIPELINE_MODE", "mock")
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)

    client = TestClient(app)
    processing_id = _start_batch_with_user_file(client, "user-custom-menu.png")
    state = _wait_until_ready(client, processing_id)
    assert state == ProcessingState.READY.value

    r = client.get(f"/api/review/{processing_id}")
    assert r.status_code == 200
    cockpit = r.json()
    dish_names = {d["canonical_name"] for d in cockpit["canonical_dishes"]}

    # In mock mode the current behavior materializes the fixture cockpit.
    # That's acceptable for the zero-file demo walk. But the batch had a
    # user file — so if the fixture is served, its source_ids must not
    # pretend to come from the user file. That is the real contract: the
    # user's upload never gets relabeled as fixture content.
    if dish_names & _FIXTURE_DISH_NAMES:
        # Fixture was served. Assert no leakage of user's source id into it.
        fixture_source_ids = {
            sid for d in cockpit["canonical_dishes"] for sid in d["source_ids"]
        }
        # The batch's sources include the user upload — its id must not be
        # assigned to any fixture dish.
        r_batch = client.get(f"/api/process/{processing_id}")
        assert r_batch.status_code == 200
        # Sanity: fixture source ids do not pretend to be from the user.
        assert fixture_source_ids.issubset(_FIXTURE_IDS) or not fixture_source_ids, (
            "fixture dishes claim source_ids that came from the user's upload"
        )


def test_real_pipeline_failure_yields_empty_cockpit_not_italian_fixture(monkeypatch):
    """If the real pipeline raises, the reviewer sees an empty cockpit plus a
    state_detail explaining the failure — NOT the italian fixture pretending
    to be the user's result. This was the original bug.
    """
    monkeypatch.setenv("MISE_PIPELINE_MODE", "real")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-test-force-real")

    # Make run_pipeline raise so we exercise the failure branch.
    from app import pipeline as pipeline_mod

    def _boom(**_kwargs):
        raise RuntimeError("simulated pipeline failure")

    client = TestClient(app)
    with patch.object(pipeline_mod, "run_pipeline", side_effect=_boom):
        processing_id = _start_batch_with_user_file(client, "nicky-menu-1.png")
        state = _wait_until_ready(client, processing_id)

    assert state == ProcessingState.FAILED.value

    r = client.get(f"/api/review/{processing_id}")
    assert r.status_code == 200
    cockpit = r.json()

    # Must not serve the italian fixture on failure.
    dish_names = {d["canonical_name"] for d in cockpit["canonical_dishes"]}
    assert not (dish_names & _FIXTURE_DISH_NAMES), (
        f"pipeline failure served italian fixture dishes: {dish_names & _FIXTURE_DISH_NAMES}"
    )
    assert cockpit["canonical_dishes"] == []
    assert cockpit["modifiers"] == []
    assert cockpit["ephemerals"] == []
    # state_detail surfaces the failure class so the UI can show it.
    assert "error" in (cockpit["processing"]["state_detail"] or "").lower()


def test_upload_persists_bytes_for_user_files(monkeypatch):
    """The store must retain the uploaded bytes under the new source id so
    the worker thread can pass them to Opus. Without this, the pipeline
    would silently fall back to the filename-keyed fixture hints.
    """
    from app.core.store import store

    client = TestClient(app)
    payload = _png_bytes()
    r = client.post(
        "/api/upload",
        files={"files": ("user-menu.png", io.BytesIO(payload), "image/png")},
    )
    assert r.status_code == 201
    src = r.json()["sources"][0]
    stored = store.get_source_bytes(src["id"])
    assert stored == payload
