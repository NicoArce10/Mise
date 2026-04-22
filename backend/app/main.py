"""FastAPI app factory. Boots with `uvicorn app.main:app --reload --port 8000`."""
from __future__ import annotations

import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import __version__
from .api import catalog, processing, review, search, sources, upload
from .core.config import settings

# Surface `[mise]` logs (extraction request shape, 0-candidate warnings,
# pipeline fallbacks) on stdout so a user reproducing a bug can copy the
# terminal output into an issue. Uvicorn installs its own handlers for the
# `uvicorn.*` loggers; this only configures the root handler once and only
# if nothing upstream has wired it — so test runs (which may set their own
# level) aren't overridden.
_LOG_LEVEL = os.environ.get("MISE_LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=_LOG_LEVEL,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)


def create_app() -> FastAPI:
    app = FastAPI(
        title="Mise",
        version=__version__,
        description="Dish-understanding engine. Any menu, any language, exportable dish graph.",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

    app.include_router(upload.router)
    app.include_router(processing.router)
    app.include_router(review.router)
    app.include_router(search.router)
    app.include_router(sources.router)
    app.include_router(catalog.router)

    @app.get("/api/health", tags=["meta"])
    async def health() -> dict[str, str]:
        return {"status": "ok", "version": __version__, "model": settings.anthropic_model}

    return app


app = create_app()
