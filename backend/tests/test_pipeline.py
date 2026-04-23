"""End-to-end tests for the fallback pipeline — exercises extraction fixture,
deterministic reconciliation, routing, and CockpitState assembly.

These tests do not hit the network. They guarantee the four demo-critical
decisions are produced by the pipeline on the three MVP bundles.
"""
from __future__ import annotations

import mimetypes
from pathlib import Path

import pytest

from app.domain.models import SourceDocument, SourceKind
from app.pipeline import PipelineInput, run_pipeline

BUNDLES = Path(__file__).resolve().parent.parent.parent / "evals" / "datasets"


def _kind(name: str) -> SourceKind:
    low = name.lower()
    if low.endswith(".pdf"):
        return SourceKind.PDF
    if "chalk" in low or "board" in low:
        return SourceKind.BOARD
    if "instagram" in low or "post" in low:
        return SourceKind.POST
    return SourceKind.PHOTO


def _inputs(bundle: str) -> list[PipelineInput]:
    out: list[PipelineInput] = []
    for p in sorted((BUNDLES / bundle / "evidence").iterdir()):
        mime, _ = mimetypes.guess_type(str(p))
        src = SourceDocument(
            id=f"src-{p.stem}",
            filename=p.name,
            kind=_kind(p.name),
            content_type=mime or "application/octet-stream",
            sha256="deadbeef",
        )
        out.append(PipelineInput(source=src, filepath=p))
    return out


def test_bundle_01_produces_margherita_merge_with_typo_alias() -> None:
    cockpit = run_pipeline(
        processing_id="test-01",
        batch_id="b-01",
        inputs=_inputs("bundle_01_italian"),
        mode="fallback",
    )
    names = {d.canonical_name for d in cockpit.canonical_dishes}
    assert "Margherita" in names
    margherita = next(d for d in cockpit.canonical_dishes if d.canonical_name == "Margherita")
    # The typo-bearing raw_name must survive as an alias.
    assert any("Marghertia" in a for a in margherita.aliases)


def test_bundle_01_pizza_funghi_kept_separate_from_calzone_funghi() -> None:
    cockpit = run_pipeline(
        processing_id="test-01b",
        batch_id="b-01b",
        inputs=_inputs("bundle_01_italian"),
        mode="fallback",
    )
    names = {d.canonical_name for d in cockpit.canonical_dishes}
    assert "Pizza Funghi" in names
    assert "Calzone Funghi" in names
    # Both present = the gate + reconciler correctly kept them apart.


def test_bundle_01_add_burrata_routed_as_modifier() -> None:
    cockpit = run_pipeline(
        processing_id="test-01c",
        batch_id="b-01c",
        inputs=_inputs("bundle_01_italian"),
        mode="fallback",
    )
    mod_texts = {m.text for m in cockpit.modifiers}
    assert "add burrata +3" in mod_texts


def test_bundle_03_chef_special_routed_as_ephemeral() -> None:
    cockpit = run_pipeline(
        processing_id="test-03",
        batch_id="b-03",
        inputs=_inputs("bundle_03_bistro"),
        mode="fallback",
    )
    eph_texts = {e.text for e in cockpit.ephemerals}
    assert "Chef's Special" in eph_texts


@pytest.mark.parametrize("bundle", ["bundle_01_italian", "bundle_02_taqueria", "bundle_03_bistro"])
def test_all_bundles_produce_valid_cockpit(bundle: str) -> None:
    cockpit = run_pipeline(
        processing_id=f"test-{bundle}",
        batch_id=f"b-{bundle}",
        inputs=_inputs(bundle),
        mode="fallback",
    )
    # Basic invariants.
    assert cockpit.processing.state.value == "ready"
    assert cockpit.metrics_preview is not None
    # No raw thinking ever leaks — decision text is all product-surface.
    for d in cockpit.canonical_dishes:
        assert len(d.decision.text) <= 240
        assert d.decision.lead_word in {"Merged", "Not merged", "Routed", "Held"}
    for e in cockpit.ephemerals:
        assert len(e.decision.text) <= 240


def test_singleton_dish_confidence_is_not_inherited_from_obvious_non_merge() -> None:
    """Regression test for the "every dish shows 0.97" bug.

    Before this fix, any singleton canonical dish that happened to have
    ONE `OBVIOUS_NON_MERGE` pair anywhere in the batch would inherit
    that pair's hardcoded 0.97 confidence (see `_deterministic_non_merge`
    in ai/reconciliation.py). On a typical menu every singleton is
    trivially "non-merge" with every other singleton via the gate, so
    the UI ended up showing a uniform 0.97 across the whole catalog —
    a number carrying no information. The pipeline must now IGNORE
    gate-level non-merge verdicts and keep the routed default (0.92)
    for singletons that only have OBVIOUS_NON_MERGE neighbours.

    We drive this with a hand-crafted pair of token-disjoint candidates
    so the gate ONLY produces one OBVIOUS_NON_MERGE verdict (no merges,
    no ambiguous). The bundle-based tests above don't hit this path
    cleanly because real menus contain merges and ambiguous pairs.
    """
    from app.core.store import new_id
    from app.domain.models import DishCandidate, EvidenceRecord, SourceDocument
    from app.pipeline import _build_cockpit, _reconcile_all

    # Two totally unrelated dishes — token-disjoint names, different
    # types, no shared ingredients. The reconciler's gate will classify
    # this as OBVIOUS_NON_MERGE (the 0.97 path).
    src = SourceDocument(
        id=new_id("src"),
        filename="fake-menu.pdf",
        kind="pdf",
        content_type="application/pdf",
        byte_size=0,
        sha256="x" * 16,
    )
    a = DishCandidate(
        id=new_id("cand"),
        source_id=src.id,
        raw_name="Milanesa Napolitana",
        normalized_name="Milanesa Napolitana",
        inferred_dish_type="meat",
        ingredients=["beef", "tomato", "mozzarella"],
        price_value=12.0,
        price_currency="USD",
        aliases=[],
        search_terms=[],
        evidence=EvidenceRecord(source_id=src.id, raw_text="Milanesa Napolitana"),
    )
    b = DishCandidate(
        id=new_id("cand"),
        source_id=src.id,
        raw_name="Tiramisu",
        normalized_name="Tiramisu",
        inferred_dish_type="dessert",
        ingredients=["mascarpone", "coffee", "cocoa"],
        price_value=7.0,
        price_currency="USD",
        aliases=[],
        search_terms=[],
        evidence=EvidenceRecord(source_id=src.id, raw_text="Tiramisu"),
    )

    reconciliations = _reconcile_all([a, b], mode="fallback")
    assert reconciliations, "disjoint pair should produce at least one verdict"
    assert all(not r.merged for r in reconciliations)
    # Confirm the 0.97 "leak source" IS present in the reconciliation
    # record — otherwise the regression test proves nothing.
    assert any(r.confidence == 0.97 for r in reconciliations), (
        "fixture precondition: the gate should have produced an "
        "OBVIOUS_NON_MERGE with the canonical 0.97 confidence"
    )

    cockpit = _build_cockpit(
        processing_id="test-confidence",
        batch_id="b-confidence",
        sources=[src],
        candidates=[a, b],
        reconciliations=reconciliations,
        elapsed_s=0.0,
        extraction_failures=0,
    )

    for d in cockpit.canonical_dishes:
        assert d.decision.confidence != 0.97, (
            f"{d.canonical_name} inherited 0.97 from an OBVIOUS_NON_MERGE "
            "gate verdict — this regresses the 'confidence signal is "
            "informative' invariant"
        )
        # Singletons with ONLY gate-level non-merges keep the routed
        # default (0.92). If this assertion ever needs to change,
        # update the constant in `_build_cockpit` too.
        assert d.decision.confidence == 0.92, (
            f"{d.canonical_name} should have the default routed "
            f"confidence (0.92), got {d.decision.confidence}"
        )
