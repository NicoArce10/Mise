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
