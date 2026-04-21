"""Shared pytest fixtures.

Each test gets a fresh FastAPI app + store so state doesn't leak across tests.
"""
from __future__ import annotations

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client() -> Iterator[TestClient]:
    """Fresh app + fresh store per test."""
    # Reload modules that hold module-level state so each test is isolated.
    import importlib
    import app.core.store as store_mod

    importlib.reload(store_mod)

    # re-import every module that captured `store` at import time
    import app.api.upload as upload_mod
    import app.api.processing as processing_mod
    import app.api.review as review_mod
    import app.main as main_mod

    importlib.reload(upload_mod)
    importlib.reload(processing_mod)
    importlib.reload(review_mod)
    importlib.reload(main_mod)

    with TestClient(main_mod.app) as c:
        yield c
