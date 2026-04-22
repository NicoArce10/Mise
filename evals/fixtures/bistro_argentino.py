"""Python port of `frontend/src/mocks/cockpit.ts`.

This is the single fixture both the offline demo sample and the search
eval harness load. It is deliberately a hand-authored replica of the TS
mock so:

    - the frontend sample demo and the eval harness grade against the
      same dish graph
    - no live API call is required to reproduce the metrics the submission
      claims (fallback search + fixture is deterministic)

If the mock in TypeScript changes, this file must be updated. The two are
kept in lockstep via `evals/fixtures/check_fixture.py` (simple name/alias
set compare — runs in CI).
"""
from __future__ import annotations

import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_ROOT / "backend"))

from app.domain.models import (  # noqa: E402
    CanonicalDish,
    CockpitState,
    DecisionSummary,
    EphemeralItem,
    MetricsPreview,
    Modifier,
    ModerationStatus,
    ProcessingRun,
    ProcessingState,
    SourceDocument,
    SourceKind,
)


def _decision(text: str, confidence: float = 0.93) -> DecisionSummary:
    return DecisionSummary(text=text, lead_word="Merged", confidence=confidence)


_RUN = "run-sample-bistro-argentino"
_BATCH = "batch-sample-bistro-argentino"
_SRC_PDF = "src-pdf-carta-principal"
_SRC_BOARD = "src-photo-pizarron-hoy"


def build_fixture() -> CockpitState:
    dishes = [
        CanonicalDish(
            id="dish-milanesa-napolitana-xl",
            canonical_name="Milanesa Napolitana XL",
            aliases=["mila napo", "mila a la napo", "milanesa napo", "napo XL"],
            search_terms=[
                "mila napo abundante",
                "milanesa con jamón y queso",
                "porción abundante para el mediodía",
                "mila grande para compartir",
            ],
            menu_category="main",
            ingredients=["breaded beef", "ham", "mozzarella", "tomato sauce", "oregano"],
            price_value=18500,
            price_currency="ARS",
            source_ids=[_SRC_PDF, _SRC_BOARD],
            modifier_ids=["mod-agregar-huevo-frito"],
            decision=_decision(
                "Extracted from the 'Carnes' section and confirmed on the chalkboard.",
                0.96,
            ),
            moderation=ModerationStatus.PENDING,
        ),
        CanonicalDish(
            id="dish-milanesa-clasica",
            canonical_name="Milanesa Clásica con Papas",
            aliases=["mila con papas", "milanesa de carne", "mila fritas"],
            search_terms=[
                "mila con papas fritas",
                "milanesa clásica",
                "algo empanado con papas",
                "almuerzo rápido abundante",
            ],
            menu_category="main",
            ingredients=["breaded beef", "french fries"],
            price_value=16000,
            price_currency="ARS",
            source_ids=[_SRC_PDF],
            modifier_ids=[],
            decision=_decision("Extracted with explicit 'con papas' side.", 0.94),
            moderation=ModerationStatus.PENDING,
        ),
        CanonicalDish(
            id="dish-provoleta",
            canonical_name="Provoleta a la Parrilla",
            aliases=["provoleta", "provolone grillado", "provo"],
            search_terms=[
                "algo veggie que no sea ensalada",
                "queso a la parrilla",
                "entrada vegetariana",
                "para empezar sin carne",
                "algo para picar veggie",
            ],
            menu_category="appetizer",
            ingredients=["provolone cheese", "oregano", "chili flakes", "olive oil"],
            price_value=8500,
            price_currency="ARS",
            source_ids=[_SRC_PDF],
            modifier_ids=[],
            decision=_decision("Entradas section, no meat — marked vegetarian.", 0.95),
            moderation=ModerationStatus.PENDING,
        ),
        CanonicalDish(
            id="dish-tabla-fiambres-quesos",
            canonical_name="Tabla de Fiambres y Quesos",
            aliases=["tabla", "picada", "tabla para compartir", "picada de la casa"],
            search_terms=[
                "algo para compartir tipo tabla",
                "picada para varios",
                "algo para picar entre amigos",
                "entrada para la mesa",
            ],
            menu_category="shared",
            ingredients=[
                "serrano ham",
                "salami",
                "provolone",
                "blue cheese",
                "green olives",
                "grissini",
            ],
            price_value=22000,
            price_currency="ARS",
            source_ids=[_SRC_PDF],
            modifier_ids=[],
            decision=_decision("Para compartir section, size 2-3 personas.", 0.93),
            moderation=ModerationStatus.PENDING,
        ),
        CanonicalDish(
            id="dish-lomito-completo",
            canonical_name="Lomito Completo",
            aliases=["lomito", "sandwich de lomo", "lomito de la casa"],
            search_terms=[
                "lomito como steak sandwich",
                "sandwich de carne argentino",
                "steak sandwich con huevo",
                "lomito con todo",
            ],
            menu_category="sandwich",
            ingredients=[
                "grilled beef tenderloin",
                "ham",
                "cheese",
                "lettuce",
                "tomato",
                "fried egg",
                "french bread",
            ],
            price_value=14500,
            price_currency="ARS",
            source_ids=[_SRC_PDF, _SRC_BOARD],
            modifier_ids=[],
            decision=_decision("Sandwiches section, chalkboard pick today.", 0.95),
            moderation=ModerationStatus.PENDING,
        ),
        CanonicalDish(
            id="dish-bife-de-chorizo",
            canonical_name="Bife de Chorizo con Papas",
            aliases=["bife", "bife de chorizo", "bife con papas"],
            search_terms=[
                "bife argentino con papas",
                "steak grueso al punto",
                "corte clásico a la parrilla",
                "carne jugosa",
            ],
            menu_category="main",
            ingredients=["sirloin steak", "french fries", "chimichurri"],
            price_value=21000,
            price_currency="ARS",
            source_ids=[_SRC_PDF],
            modifier_ids=[],
            decision=_decision("Parrilla section, side papas fritas.", 0.92),
            moderation=ModerationStatus.PENDING,
        ),
        CanonicalDish(
            id="dish-burger-doble-cheddar",
            canonical_name="Burger del Barrio Doble Cheddar",
            aliases=["burger doble", "doble cheddar", "cheeseburger doble"],
            search_terms=[
                "burger doble cheddar con papas",
                "algo tipo cuarto de libra",
                "hamburguesa doble queso",
                "cheeseburger grande",
            ],
            menu_category="burger",
            ingredients=[
                "double beef patty",
                "cheddar",
                "bacon",
                "brioche bun",
                "french fries",
            ],
            price_value=12500,
            price_currency="ARS",
            source_ids=[_SRC_PDF],
            modifier_ids=["mod-agregar-papas-extra"],
            decision=_decision("Burgers section with doble medallón noted.", 0.94),
            moderation=ModerationStatus.PENDING,
        ),
        CanonicalDish(
            id="dish-empanadas-carne",
            canonical_name="Empanadas de Carne (x6)",
            aliases=["empanadas", "empanadas al horno", "empanadas caseras"],
            search_terms=[
                "empanadas caseras",
                "entrada rápida para compartir",
                "algo para picar rápido",
            ],
            menu_category="starter",
            ingredients=["beef", "onion", "boiled egg", "green olives", "dough"],
            price_value=9000,
            price_currency="ARS",
            source_ids=[_SRC_PDF],
            modifier_ids=[],
            decision=_decision("Empanadas section, portion x6.", 0.91),
            moderation=ModerationStatus.PENDING,
        ),
        CanonicalDish(
            id="dish-empanadas-verdura",
            canonical_name="Empanadas de Verdura (x6)",
            aliases=["empanadas verdes", "empanadas de espinaca y ricota"],
            search_terms=[
                "empanadas veggie",
                "algo vegetariano rápido",
                "entrada veggie para la mesa",
            ],
            menu_category="starter",
            ingredients=["spinach", "ricotta", "dough"],
            price_value=9000,
            price_currency="ARS",
            source_ids=[_SRC_PDF],
            modifier_ids=[],
            decision=_decision("Empanadas section, no meat — vegetarian.", 0.9),
            moderation=ModerationStatus.PENDING,
        ),
        CanonicalDish(
            id="dish-noquis-con-tuco",
            canonical_name="Ñoquis con Tuco",
            aliases=["ñoquis", "gnocchi con salsa de tomate", "ñoquis 29"],
            search_terms=[
                "pasta caserita con tuco",
                "pasta con salsa de carne",
                "ñoquis del 29",
            ],
            menu_category="pasta",
            ingredients=["potato gnocchi", "tomato sauce", "ground beef"],
            price_value=13500,
            price_currency="ARS",
            source_ids=[_SRC_PDF],
            modifier_ids=[],
            decision=_decision("Pastas section, sauce tuco.", 0.9),
            moderation=ModerationStatus.PENDING,
        ),
        CanonicalDish(
            id="dish-ensalada-completa",
            canonical_name="Ensalada Completa",
            aliases=["ensalada", "ensalada de la casa"],
            search_terms=[
                "ensalada abundante",
                "algo fresco y liviano",
                "plato liviano del mediodía",
            ],
            menu_category="salad",
            ingredients=["lettuce", "tomato", "onion", "boiled egg", "tuna", "corn"],
            price_value=9500,
            price_currency="ARS",
            source_ids=[_SRC_PDF],
            modifier_ids=[],
            decision=_decision("Ensaladas section.", 0.89),
            moderation=ModerationStatus.PENDING,
        ),
        CanonicalDish(
            id="dish-flan-dulce-leche",
            canonical_name="Flan con Dulce de Leche",
            aliases=["flan", "flan casero", "postre criollo"],
            search_terms=[
                "postre clásico argentino",
                "algo dulce para cerrar",
                "postre con dulce de leche",
            ],
            menu_category="dessert",
            ingredients=["flan", "dulce de leche", "whipped cream"],
            price_value=5500,
            price_currency="ARS",
            source_ids=[_SRC_PDF],
            modifier_ids=[],
            decision=_decision("Postres section.", 0.92),
            moderation=ModerationStatus.PENDING,
        ),
    ]

    modifiers = [
        Modifier(
            id="mod-agregar-huevo-frito",
            text="agregar huevo frito +1500",
            price_delta_value=1500,
            price_delta_currency="ARS",
            parent_dish_id="dish-milanesa-napolitana-xl",
            source_ids=[_SRC_BOARD],
        ),
        Modifier(
            id="mod-agregar-papas-extra",
            text="agregar papas extra +2500",
            price_delta_value=2500,
            price_delta_currency="ARS",
            parent_dish_id="dish-burger-doble-cheddar",
            source_ids=[_SRC_PDF],
        ),
    ]

    ephemerals = [
        EphemeralItem(
            id="eph-menu-ejecutivo-almuerzo",
            text=(
                "Menú ejecutivo del mediodía — entrada + principal + bebida · "
                "$14.500 (solo lunes a viernes)"
            ),
            source_ids=[_SRC_BOARD],
            decision=DecisionSummary(
                text="Routed as ephemeral — time-limited offer.",
                lead_word="Routed",
                confidence=0.88,
            ),
            moderation=ModerationStatus.PENDING,
        ),
    ]

    sources = [
        SourceDocument(
            id=_SRC_PDF,
            filename="carta_principal.pdf",
            kind=SourceKind.PDF,
            content_type="application/pdf",
            sha256="0a0a" + "f" * 60,
        ),
        SourceDocument(
            id=_SRC_BOARD,
            filename="pizarron_hoy.jpg",
            kind=SourceKind.BOARD,
            content_type="image/jpeg",
            sha256="0b0b" + "f" * 60,
            width_px=1920,
            height_px=1280,
        ),
    ]

    return CockpitState(
        processing=ProcessingRun(
            id=_RUN,
            batch_id=_BATCH,
            state=ProcessingState.READY,
            state_detail=None,
            adaptive_thinking_pairs=0,
            started_at="2026-04-22T14:02:00Z",
            ready_at="2026-04-22T14:02:38Z",
        ),
        sources=sources,
        canonical_dishes=dishes,
        modifiers=modifiers,
        ephemerals=ephemerals,
        reconciliation_trace=[],
        metrics_preview=MetricsPreview(
            sources_ingested=len(sources),
            canonical_count=len(dishes),
            modifier_count=len(modifiers),
            ephemeral_count=len(ephemerals),
            merge_precision=None,
            non_merge_accuracy=None,
            time_to_review_pack_seconds=38.2,
        ),
    )
