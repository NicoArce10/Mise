"""FastAPI app factory. Boots with `uvicorn app.main:app --reload --port 8000`."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import __version__
from .api import processing, review, upload
from .core.config import settings


def create_app() -> FastAPI:
    app = FastAPI(
        title="Mise",
        version=__version__,
        description="Trust layer for dish-level menu data.",
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

    @app.get("/api/health", tags=["meta"])
    async def health() -> dict[str, str]:
        return {"status": "ok", "version": __version__, "model": settings.anthropic_model}

    return app


app = create_app()
