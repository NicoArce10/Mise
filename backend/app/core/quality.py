"""Heuristic guardrail: predicts whether a run is likely to need human review.

Inspired by DoorDash's internal pipeline, which ships a LightGBM classifier
between the transcription model and publication — photos predicted to fail
are routed to reviewers instead of being published blindly (see
https://blog.bytebytego.com/p/how-doordash-uses-ai-models-to-understand).

We don't have labeled training data in a hackathon MVP, so this module
uses a handful of cheap structural heuristics instead of a model. Each
heuristic checks one failure mode we've seen on real menus during dev:

- Extractor returned nearly nothing (photo was a bad crop or a cover).
- Most dishes are missing a price (the OCR-equivalent tripped on a column).
- Most dishes are missing a category (the section headers weren't read).
- Ingredients are uniformly empty (the model answered with skeleton rows).
- A price is > 3σ away from the menu mean (likely a typo or an OCR slip).
- Two canonical dishes look near-identical (union-find didn't merge them).
- At least one source failed outright (partial extraction happened).

The output is `QualitySignal`, which rides on `CockpitState` and on the
`/api/catalog/{run_id}.json` export. The landing page's "Quality signal"
row traces back here.

When we have enough labeled examples to train a small classifier, the
`evaluate_quality` function becomes the `predict_proba` of that model
and the rest of the plumbing stays unchanged.
"""
from __future__ import annotations

import math
import re
from enum import Enum
from typing import TYPE_CHECKING

from pydantic import BaseModel, ConfigDict, Field

if TYPE_CHECKING:
    # Type-only import: `CanonicalDish` is defined in `..domain.models`, which
    # itself imports `QualitySignal` from this module. A runtime import would
    # form a cycle, so we keep it under `TYPE_CHECKING` and stringify the
    # annotations below.
    from ..domain.models import CanonicalDish


class QualityFlag(str, Enum):
    """One concrete reason a run might not be ready to publish blindly."""

    LOW_DISH_COUNT = "low_dish_count"
    MISSING_PRICES = "missing_prices"
    MISSING_CATEGORIES = "missing_categories"
    SPARSE_INGREDIENTS = "sparse_ingredients"
    PRICE_OUTLIER = "price_outlier"
    DUPLICATE_CANONICALS = "duplicate_canonicals"
    PARTIAL_EXTRACTION = "partial_extraction"


class QualityStatus(str, Enum):
    """Coarse routing decision.

    - READY: publish automatically.
    - REVIEW_RECOMMENDED: a reviewer should glance at this before it ships.
    - LIKELY_FAILURE: the extraction looks broken; don't ship without edits.
    """

    READY = "ready"
    REVIEW_RECOMMENDED = "review_recommended"
    LIKELY_FAILURE = "likely_failure"


class QualitySignal(BaseModel):
    """Structured quality signal attached to every pipeline run."""

    model_config = ConfigDict(frozen=True)

    status: QualityStatus
    confidence: float = Field(ge=0.0, le=1.0)
    flags: list[QualityFlag] = Field(default_factory=list)
    reasons: list[str] = Field(default_factory=list)
    # Cheap numeric signals the UI can render as a quality panel without
    # having to re-walk the dish graph.
    dish_count: int
    missing_price_ratio: float = Field(ge=0.0, le=1.0)
    missing_category_ratio: float = Field(ge=0.0, le=1.0)
    sparse_ingredient_ratio: float = Field(ge=0.0, le=1.0)


# ---------- heuristics ----------

# Severity weights subtracted from the starting confidence of 1.0.
# Calibrated so a single "medium" flag puts the run in REVIEW_RECOMMENDED
# (confidence ~= 0.75) and two "high" flags push it to LIKELY_FAILURE.
_SEVERITY = {
    QualityFlag.LOW_DISH_COUNT: 0.40,
    QualityFlag.MISSING_PRICES: 0.20,
    QualityFlag.MISSING_CATEGORIES: 0.15,
    QualityFlag.SPARSE_INGREDIENTS: 0.10,
    QualityFlag.PRICE_OUTLIER: 0.15,
    QualityFlag.DUPLICATE_CANONICALS: 0.15,
    QualityFlag.PARTIAL_EXTRACTION: 0.25,
}

# Tunables — kept as module constants so the eval harness / tests can
# reference them by name rather than re-typing magic numbers.
MIN_DISH_COUNT = 4
MISSING_PRICE_THRESHOLD = 0.40  # > 40% missing triggers the flag
MISSING_CATEGORY_THRESHOLD = 0.50
SPARSE_INGREDIENT_THRESHOLD = 0.70
DUPLICATE_JACCARD_THRESHOLD = 0.80


def _tokens(name: str) -> set[str]:
    return {t for t in re.split(r"[^a-z0-9]+", name.lower()) if t}


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def _find_duplicate_pairs(dishes: "list[CanonicalDish]") -> list[tuple[str, str]]:
    pairs: list[tuple[str, str]] = []
    token_lists = [(d.canonical_name, _tokens(d.canonical_name)) for d in dishes]
    for i in range(len(token_lists)):
        name_a, toks_a = token_lists[i]
        for j in range(i + 1, len(token_lists)):
            name_b, toks_b = token_lists[j]
            if _jaccard(toks_a, toks_b) >= DUPLICATE_JACCARD_THRESHOLD:
                pairs.append((name_a, name_b))
    return pairs


def _price_outliers(dishes: "list[CanonicalDish]") -> list[tuple[str, float]]:
    """Flag prices that are wildly out of step with the rest of the menu.

    Uses the Iglewicz-Hoaglin modified z-score (MAD-based) rather than a
    plain mean/stddev z-score: a single absurd price like "9,999" would
    inflate stddev enough to hide itself under the 3σ threshold. The
    median absolute deviation is robust to that self-masking because the
    center and spread are not pulled by the outlier.
    """
    priced = [
        (d.canonical_name, d.price_value)
        for d in dishes
        if d.price_value is not None
    ]
    if len(priced) < 4:
        # Too few prices to compute a meaningful center/spread.
        return []
    values = sorted(p for _, p in priced)
    n = len(values)
    median = values[n // 2] if n % 2 == 1 else (values[n // 2 - 1] + values[n // 2]) / 2
    abs_dev = sorted(abs(v - median) for v in values)
    mad = abs_dev[n // 2] if n % 2 == 1 else (abs_dev[n // 2 - 1] + abs_dev[n // 2]) / 2
    if mad == 0:
        # Fall back to mean/stddev when every price is identical — rare on
        # real menus, but harmless.
        mean = sum(values) / n
        variance = sum((v - mean) ** 2 for v in values) / n
        stddev = math.sqrt(variance)
        if stddev == 0:
            return []
        return [
            (name, price)
            for name, price in priced
            if abs((price - mean) / stddev) > 3.0
        ]
    # 0.6745 normalizes MAD to an approximate standard deviation for
    # normally distributed data. |modified_z| > 3.5 is the commonly-cited
    # threshold (Iglewicz & Hoaglin, 1993).
    outliers: list[tuple[str, float]] = []
    for name, price in priced:
        modified_z = 0.6745 * (price - median) / mad
        if abs(modified_z) > 3.5:
            outliers.append((name, price))
    return outliers


def evaluate_quality(
    *,
    canonical_dishes: "list[CanonicalDish]",
    extraction_failures: int,
    extraction_total: int,
) -> QualitySignal:
    """Score a pipeline run against the heuristic checks above."""

    n = len(canonical_dishes)

    # Ratios — defined as 0 on empty menus so the caller can render them
    # in the UI without special-casing.
    if n == 0:
        missing_price_ratio = 0.0
        missing_category_ratio = 0.0
        sparse_ingredient_ratio = 0.0
    else:
        missing_price_ratio = sum(1 for d in canonical_dishes if d.price_value is None) / n
        missing_category_ratio = sum(1 for d in canonical_dishes if not d.menu_category) / n
        sparse_ingredient_ratio = sum(1 for d in canonical_dishes if not d.ingredients) / n

    flags: list[QualityFlag] = []
    reasons: list[str] = []

    if n < MIN_DISH_COUNT:
        flags.append(QualityFlag.LOW_DISH_COUNT)
        reasons.append(
            f"Only {n} canonical dish{'es' if n != 1 else ''} extracted — "
            "real menus almost always have more. This usually means the "
            "upload was a cover page, a partial crop, or an unsupported layout."
        )

    if missing_price_ratio > MISSING_PRICE_THRESHOLD and n > 0:
        flags.append(QualityFlag.MISSING_PRICES)
        reasons.append(
            f"{int(missing_price_ratio * 100)}% of dishes have no price. "
            "On a printed menu, prices are usually columnar — if most are "
            "missing, the extractor likely lost an entire column."
        )

    if missing_category_ratio > MISSING_CATEGORY_THRESHOLD and n > 0:
        flags.append(QualityFlag.MISSING_CATEGORIES)
        reasons.append(
            f"{int(missing_category_ratio * 100)}% of dishes have no section. "
            "Section headers (‘Appetizers’, ‘Pastas’) weren't picked up on "
            "this pass."
        )

    if sparse_ingredient_ratio > SPARSE_INGREDIENT_THRESHOLD and n > 0:
        flags.append(QualityFlag.SPARSE_INGREDIENTS)
        reasons.append(
            f"{int(sparse_ingredient_ratio * 100)}% of dishes have empty "
            "ingredients. Menus rarely omit every description — the model "
            "may have returned skeleton rows."
        )

    outliers = _price_outliers(canonical_dishes)
    if outliers:
        name, price = outliers[0]
        flags.append(QualityFlag.PRICE_OUTLIER)
        reasons.append(
            f"Price for ‘{name}’ ({price:g}) is more than three standard "
            "deviations from the menu mean — likely a typo or a decimal slip."
        )

    dup_pairs = _find_duplicate_pairs(canonical_dishes)
    if dup_pairs:
        name_a, name_b = dup_pairs[0]
        flags.append(QualityFlag.DUPLICATE_CANONICALS)
        reasons.append(
            f"‘{name_a}’ and ‘{name_b}’ look like the same dish but were "
            "kept separate. A reviewer should confirm whether to merge them."
        )

    if extraction_failures > 0 and extraction_total > 0:
        flags.append(QualityFlag.PARTIAL_EXTRACTION)
        reasons.append(
            f"{extraction_failures} of {extraction_total} sources failed "
            "during extraction. The catalog below covers the ones that "
            "succeeded."
        )

    confidence = 1.0
    for f in flags:
        confidence -= _SEVERITY[f]
    confidence = max(0.0, min(1.0, confidence))

    if confidence >= 0.80 and not flags:
        status = QualityStatus.READY
    elif confidence < 0.50 or len(flags) >= 3:
        status = QualityStatus.LIKELY_FAILURE
    else:
        status = QualityStatus.REVIEW_RECOMMENDED

    return QualitySignal(
        status=status,
        confidence=round(confidence, 3),
        flags=flags,
        reasons=reasons,
        dish_count=n,
        missing_price_ratio=round(missing_price_ratio, 3),
        missing_category_ratio=round(missing_category_ratio, 3),
        sparse_ingredient_ratio=round(sparse_ingredient_ratio, 3),
    )
