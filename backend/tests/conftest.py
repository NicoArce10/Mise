"""Shared pytest fixtures.

Each test gets a fresh FastAPI app + store so state doesn't leak across tests.
"""
from __future__ import annotations

import os
from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(autouse=True)
def _isolate_pipeline_env(monkeypatch: pytest.MonkeyPatch) -> None:
    """Run tests against the mock pipeline by default.

    Real .env values (loaded by config.py for developer convenience) would
    otherwise drive the test suite through the real Opus 4.7 path, which
    rejects synthetic fixture bytes with 400 and makes the review tests
    time out. Tests that specifically need the real or fallback branch
    set these vars explicitly; everything else gets a clean mock.
    """
    monkeypatch.setenv("MISE_PIPELINE_MODE", "mock")
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)


@pytest.fixture()
def client() -> Iterator[TestClient]:
    """Fresh app + fresh store per test."""
    # Reload modules that hold module-level state so each test is isolated.
    import importlib
    import app.core.store as store_mod

    importlib.reload(store_mod)

    # re-import every module that captured `store` at import time
    import app.api.catalog as catalog_mod
    import app.api.processing as processing_mod
    import app.api.review as review_mod
    import app.api.upload as upload_mod
    import app.main as main_mod

    importlib.reload(upload_mod)
    importlib.reload(processing_mod)
    importlib.reload(review_mod)
    importlib.reload(catalog_mod)
    importlib.reload(main_mod)

    with TestClient(main_mod.app) as c:
        yield c
