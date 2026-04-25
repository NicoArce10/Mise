"""Deterministic mock CockpitState for M3.

Every string, UUID, and confidence here is copy-for-copy identical to
`frontend/src/mocks/cockpit.ts`. When M4 replaces this file with live
Opus 4.7 output the four demo-critical decisions must keep the same
wording and the same ids so the Cockpit bundle does not need a rebuild.
"""
from __future__ import annotations

from ..core.quality import QualityStatus, QualitySignal
from .models import (
    CanonicalDish,
    CockpitState,
    DecisionSummary,
    EphemeralItem,
    MetricsPreview,
    Modifier,
    ModerationStatus,
    ProcessingRun,
    ProcessingState,
    ReconciliationClass,
    ReconciliationResult,
    SourceDocument,
    SourceKind,
)


class IDS:
    RUN = "run-b0e2a1c3-1111-4aaa-8aaa-0000000000b1"
    BATCH = "batch-a1c3-2222-4aaa-8aaa-0000000000b2"

    SRC_PDF_A = "src-pdf-branch-a"
    SRC_PHOTO_B = "src-photo-branch-b"
    SRC_CHALK_C = "src-chalkboard-branch-c"
    SRC_IG_POST = "src-ig-post-special"
    SRC_TAQ_CHALK = "src-taqueria-chalkboard"

    DISH_MARGHERITA = "dish-margherita"
    DISH_FUNGHI_PIZZA = "dish-pizza-funghi"
    DISH_FUNGHI_CALZONE = "dish-calzone-funghi"

    MOD_BURRATA = "mod-burrata-plus-3"
    MOD_GUAC = "mod-add-guacamole"

    EPH_CHEF_SPECIAL = "eph-chef-special"


def fixture_sources() -> list[SourceDocument]:
    return [
        SourceDocument(
            id=IDS.SRC_PDF_A,
            filename="menu_pdf_branch_a.pdf",
            kind=SourceKind.PDF,
            content_type="application/pdf",
            sha256="0a0a…a1",
        ),
        SourceDocument(
            id=IDS.SRC_PHOTO_B,
            filename="menu_photo_branch_b.jpg",
            kind=SourceKind.PHOTO,
            content_type="image/jpeg",
            sha256="0b0b…b2",
            width_px=2000,
            height_px=1400,
        ),
        SourceDocument(
            id=IDS.SRC_CHALK_C,
            filename="chalkboard_branch_c.jpg",
            kind=SourceKind.BOARD,
            content_type="image/jpeg",
            sha256="0c0c…c3",
            width_px=1800,
            height_px=1200,
        ),
        SourceDocument(
            id=IDS.SRC_IG_POST,
            filename="instagram_post_special.png",
            kind=SourceKind.POST,
            content_type="image/png",
            sha256="0d0d…d4",
            width_px=1080,
            height_px=1080,
        ),
    ]


def fixture_cockpit(
    processing_id: str = IDS.RUN,
    batch_id: str = IDS.BATCH,
) -> CockpitState:
    """Build the full demo-critical CockpitState. UUIDs reused from the frontend."""

    return CockpitState(
        processing=ProcessingRun(
            id=processing_id,
            batch_id=batch_id,
            state=ProcessingState.READY,
            state_detail="Adaptive thinking engaged on 2 pairs",
            adaptive_thinking_pairs=2,
            started_at="2026-04-26T16:03:11Z",
            ready_at="2026-04-26T16:03:47Z",
        ),
        sources=fixture_sources(),
        canonical_dishes=[
            CanonicalDish(
                id=IDS.DISH_MARGHERITA,
                canonical_name="Margherita",
                aliases=["Marghertia", "Pizza Margherita"],
                menu_category="Pizze",
                ingredients=["tomato", "mozzarella", "basil"],
                source_ids=[IDS.SRC_PDF_A, IDS.SRC_PHOTO_B, IDS.SRC_CHALK_C],
                modifier_ids=[IDS.MOD_BURRATA],
                decision=DecisionSummary(
                    text=(
                        "Merged because the name matched after typo normalization "
                        "and ingredients matched across two branches."
                    ),
                    lead_word="Merged",
                    confidence=0.94,
                ),
                moderation=ModerationStatus.PENDING,
            ),
            CanonicalDish(
                id=IDS.DISH_FUNGHI_PIZZA,
                canonical_name="Pizza Funghi",
                aliases=[],
                menu_category="Pizze",
                ingredients=["tomato", "mozzarella", "mushrooms"],
                source_ids=[IDS.SRC_PDF_A, IDS.SRC_PHOTO_B],
                modifier_ids=[],
                decision=DecisionSummary(
                    text="Merged because name and ingredients matched exactly across two branches.",
                    lead_word="Merged",
                    confidence=0.92,
                ),
                moderation=ModerationStatus.PENDING,
            ),
            CanonicalDish(
                id=IDS.DISH_FUNGHI_CALZONE,
                canonical_name="Calzone Funghi",
                aliases=[],
                menu_category="Calzoni",
                ingredients=["mozzarella", "mushrooms", "ricotta"],
                source_ids=[IDS.SRC_PDF_A],
                modifier_ids=[],
                decision=DecisionSummary(
                    text=(
                        "Not merged with Pizza Funghi because dish type differs "
                        "despite ingredient overlap."
                    ),
                    lead_word="Not merged",
                    confidence=0.91,
                ),
                moderation=ModerationStatus.PENDING,
            ),
        ],
        modifiers=[
            Modifier(
                id=IDS.MOD_BURRATA,
                text="add burrata +3",
                price_delta_value=3.0,
                price_delta_currency="EUR",
                parent_dish_id=IDS.DISH_MARGHERITA,
                source_ids=[IDS.SRC_CHALK_C],
            ),
            Modifier(
                id=IDS.MOD_GUAC,
                text="add guacamole +2",
                price_delta_value=2.0,
                price_delta_currency="USD",
                parent_dish_id=None,
                source_ids=[IDS.SRC_TAQ_CHALK],
            ),
        ],
        ephemerals=[
            EphemeralItem(
                id=IDS.EPH_CHEF_SPECIAL,
                text="Chef's Special",
                source_ids=[IDS.SRC_IG_POST],
                decision=DecisionSummary(
                    text=(
                        "Routed as ephemeral because no stable name across sources "
                        "and no fixed price."
                    ),
                    lead_word="Routed",
                    confidence=0.88,
                ),
                moderation=ModerationStatus.PENDING,
            ),
        ],
        reconciliation_trace=[
            ReconciliationResult(
                left_id=IDS.DISH_FUNGHI_PIZZA,
                right_id=IDS.DISH_FUNGHI_CALZONE,
                gate_class=ReconciliationClass.AMBIGUOUS,
                merged=False,
                canonical_name=None,
                confidence=0.91,
                decision_summary=(
                    "Not merged with Pizza Funghi because dish type differs "
                    "despite ingredient overlap."
                ),
                used_adaptive_thinking=True,
                left_name="Pizza ai Funghi",
                right_name="Calzone ai Funghi",
                left_source_id=IDS.SRC_PDF_A,
                right_source_id=IDS.SRC_PHOTO_B,
            ),
            ReconciliationResult(
                left_id=IDS.DISH_MARGHERITA,
                right_id=IDS.DISH_MARGHERITA,
                gate_class=ReconciliationClass.AMBIGUOUS,
                merged=True,
                canonical_name="Margherita",
                confidence=0.94,
                decision_summary=(
                    "Merged because the name matched after typo normalization "
                    "and ingredients matched across two branches."
                ),
                used_adaptive_thinking=True,
                left_name="Margherita",
                right_name="Margueritta",
                left_source_id=IDS.SRC_PDF_A,
                right_source_id=IDS.SRC_CHALK_C,
            ),
        ],
        metrics_preview=MetricsPreview(
            sources_ingested=4,
            canonical_count=3,
            modifier_count=2,
            ephemeral_count=1,
            merge_precision=1.0,
            non_merge_accuracy=1.0,
            time_to_review_pack_seconds=36.4,
        ),
        # A clean run on the Bella Italia fixture: no flags raised.
        # The fixture exists to drive the demo deterministically, so we
        # hard-code the guardrail verdict here rather than re-evaluating
        # from the shape above — if a future diff lowers the fixture
        # quality, the test_quality suite will still fail and flag it.
        quality_signal=QualitySignal(
            status=QualityStatus.READY,
            confidence=1.0,
            flags=[],
            reasons=[],
            dish_count=3,
            missing_price_ratio=0.0,
            missing_category_ratio=0.0,
            sparse_ingredient_ratio=0.0,
        ),
    )
