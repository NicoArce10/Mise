"""GET /api/catalog/{processing_id}.json — exportable dish graph.

The catalog is the primary product surface: every canonical dish, every
modifier attached to a parent, every ephemeral, shaped as a flat JSON any
downstream system (review app, delivery feed, POS import) can consume
without knowing Mise's internal state.

This is the "plug it into anything" endpoint. Stable shape, stable keys.

Moderation semantics (the Approve / Edit / Reject buttons in the Cockpit):
- REJECTED dishes and ephemerals are excluded from the export entirely.
  Rejecting is how a reviewer prevents a dish from reaching downstream
  systems — the button has to change the file, otherwise it's decoration.
- APPROVED and EDITED items carry a `review_status` field so downstream
  consumers can prefer reviewer-confirmed rows.
- PENDING items ship without a `review_status`, identical to a machine-only
  run: the human reviewer simply hasn't touched them yet.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse

from ..core.store import store
from ..domain.models import (
    CanonicalDish,
    CockpitState,
    EntityId,
    EphemeralItem,
    ModerationStatus,
    Modifier,
    ProcessingState,
    SourceDocument,
)

router = APIRouter(prefix="/api/catalog", tags=["catalog"])


def _price(value: float | None, currency: str | None) -> dict[str, Any] | None:
    if value is None:
        return None
    return {"value": value, "currency": currency}


def _source_ref(source_id: EntityId, sources_by_id: dict[EntityId, SourceDocument]) -> dict[str, Any]:
    src = sources_by_id.get(source_id)
    if src is None:
        return {"source_id": source_id}
    return {
        "source_id": source_id,
        "filename": src.filename,
        "kind": src.kind.value,
    }


def _modifier_payload(mod: Modifier, sources_by_id: dict[EntityId, SourceDocument]) -> dict[str, Any]:
    return {
        "id": mod.id,
        "text": mod.text,
        "price_delta": _price(mod.price_delta_value, mod.price_delta_currency),
        "parent_dish_id": mod.parent_dish_id,
        "sources": [_source_ref(sid, sources_by_id) for sid in mod.source_ids],
    }


def _review_status(mod: ModerationStatus) -> str | None:
    """Surface reviewer state to downstream consumers.

    PENDING = omitted on purpose: semantically "nobody looked at it", the
    exported row is identical to what a machine-only run would have shipped.
    REJECTED items never reach this function — they're filtered upstream.
    """
    if mod is ModerationStatus.APPROVED:
        return "approved"
    if mod is ModerationStatus.EDITED:
        return "edited"
    return None


def _dish_payload(
    dish: CanonicalDish,
    modifiers_by_parent: dict[EntityId, list[Modifier]],
    sources_by_id: dict[EntityId, SourceDocument],
) -> dict[str, Any]:
    attached = modifiers_by_parent.get(dish.id, [])
    payload: dict[str, Any] = {
        "id": dish.id,
        "canonical_name": dish.canonical_name,
        "aliases": dish.aliases,
        "search_terms": dish.search_terms,
        "ingredients": dish.ingredients,
        "menu_category": dish.menu_category,
        "price": _price(dish.price_value, dish.price_currency),
        "modifiers": [_modifier_payload(m, sources_by_id) for m in attached],
        "sources": [_source_ref(sid, sources_by_id) for sid in dish.source_ids],
        "confidence": dish.decision.confidence,
        "decision_summary": dish.decision.text,
    }
    status = _review_status(dish.moderation)
    if status is not None:
        payload["review_status"] = status
    return payload


def _ephemeral_payload(eph: EphemeralItem, sources_by_id: dict[EntityId, SourceDocument]) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "id": eph.id,
        "text": eph.text,
        "sources": [_source_ref(sid, sources_by_id) for sid in eph.source_ids],
        "confidence": eph.decision.confidence,
        "decision_summary": eph.decision.text,
    }
    status = _review_status(eph.moderation)
    if status is not None:
        payload["review_status"] = status
    return payload


def _build_catalog(processing_id: EntityId, cockpit: CockpitState) -> dict[str, Any]:
    sources_by_id = {src.id: src for src in cockpit.sources}

    # Reject filter: a rejected canonical dish must not leak into the export.
    # The button exists to let reviewers prevent bad extractions from reaching
    # downstream systems — decoration would defeat the purpose.
    included_dishes = [
        d for d in cockpit.canonical_dishes if d.moderation is not ModerationStatus.REJECTED
    ]
    excluded_dish_count = len(cockpit.canonical_dishes) - len(included_dishes)
    included_dish_ids = {d.id for d in included_dishes}

    modifiers_by_parent: dict[EntityId, list[Modifier]] = {}
    unattached: list[Modifier] = []
    for mod in cockpit.modifiers:
        if mod.parent_dish_id is None:
            unattached.append(mod)
        elif mod.parent_dish_id in included_dish_ids:
            # Modifiers anchored to a rejected dish drop out with their parent.
            modifiers_by_parent.setdefault(mod.parent_dish_id, []).append(mod)

    included_ephemerals = [
        e for e in cockpit.ephemerals if e.moderation is not ModerationStatus.REJECTED
    ]

    # Quality signal — heuristic guardrail verdict on this run. Surfaced in
    # the catalog so a downstream system can read it *before* indexing the
    # rows: if `status == "likely_failure"` the ingesting system should
    # route the run through a reviewer (or drop it) instead of publishing
    # blindly. Shape mirrors `backend.app.core.quality.QualitySignal`.
    qs = cockpit.quality_signal
    quality_payload: dict[str, Any] | None
    if qs is None:
        quality_payload = None
    else:
        quality_payload = {
            "status": qs.status.value,
            "confidence": qs.confidence,
            "flags": [f.value for f in qs.flags],
            "reasons": list(qs.reasons),
            "metrics": {
                "dish_count": qs.dish_count,
                "missing_price_ratio": qs.missing_price_ratio,
                "missing_category_ratio": qs.missing_category_ratio,
                "sparse_ingredient_ratio": qs.sparse_ingredient_ratio,
            },
        }

    return {
        "run_id": processing_id,
        "generated_at": cockpit.processing.ready_at or cockpit.processing.started_at,
        "model": "claude-opus-4-7",
        "quality_signal": quality_payload,
        "sources": [
            {
                "id": src.id,
                "filename": src.filename,
                "kind": src.kind.value,
                "content_type": src.content_type,
                "sha256": src.sha256,
            }
            for src in cockpit.sources
        ],
        "dishes": [
            _dish_payload(dish, modifiers_by_parent, sources_by_id)
            for dish in included_dishes
        ],
        "unattached_modifiers": [
            _modifier_payload(mod, sources_by_id) for mod in unattached
        ],
        "ephemerals": [
            _ephemeral_payload(eph, sources_by_id) for eph in included_ephemerals
        ],
        "counts": {
            "sources": len(cockpit.sources),
            "dishes": len(included_dishes),
            "modifiers_attached": sum(len(v) for v in modifiers_by_parent.values()),
            "modifiers_unattached": len(unattached),
            "ephemerals": len(included_ephemerals),
            "excluded_rejected": excluded_dish_count,
        },
    }


@router.get("/{processing_id}.json")
async def get_catalog(processing_id: EntityId) -> JSONResponse:
    cockpit = store.get_cockpit(processing_id)
    if cockpit is None:
        run = store.get_run_meta(processing_id)
        if run is None:
            raise HTTPException(status_code=404, detail=f"run {processing_id} not found")
        raise HTTPException(
            status_code=409,
            detail=f"run {processing_id} not yet ready (state={run.state.value})",
        )

    if cockpit.processing.state != ProcessingState.READY:
        raise HTTPException(
            status_code=409,
            detail=f"run {processing_id} not yet ready (state={cockpit.processing.state.value})",
        )

    payload = _build_catalog(processing_id, cockpit)
    headers = {
        "Content-Disposition": f'attachment; filename="mise-catalog-{processing_id}.json"',
    }
    return JSONResponse(content=payload, headers=headers)
