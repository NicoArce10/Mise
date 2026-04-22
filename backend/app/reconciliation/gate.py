"""Deterministic pre-filter for reconciliation pairs.

Implements `docs/plans/2026-04-22-architecture.md` §2.1 verbatim. Pure Python,
no LLM. Only pairs classified AMBIGUOUS are allowed to trigger adaptive
thinking in `app.ai.reconciliation`.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

from ..domain.models import DishCandidate, ReconciliationClass

# ---------- vocabulary ----------

DISH_TYPE_LEX: frozenset[str] = frozenset(
    {
        "pizza", "calzone", "pasta", "lasagna", "linguine", "spaghetti",
        "ravioli", "gnudi",
        "taco", "tacos", "quesadilla", "burrito", "torta", "tostada",
        "salad", "soup", "sandwich", "burger", "toast", "tartare",
        "steak", "rib", "fish",
        "halibut", "salmon", "cod", "chicken", "pork", "lamb",
    }
)

_STOPWORDS: frozenset[str] = frozenset({"the", "a", "de", "al", "la", "el"})

_PUNCT_RX = re.compile(r"[^\w\s]", re.UNICODE)
_WS_RX = re.compile(r"\s+")


# ---------- string normalizers ----------

def normalize(s: str) -> str:
    """N(s) from §2.1: strip accents, drop punctuation (keep spaces), collapse ws, lower."""
    stripped = unicodedata.normalize("NFKD", s)
    stripped = "".join(c for c in stripped if not unicodedata.combining(c))
    stripped = _PUNCT_RX.sub(" ", stripped)
    stripped = _WS_RX.sub(" ", stripped).strip().lower()
    return stripped


def _levenshtein(a: str, b: str) -> int:
    """Classic DP Levenshtein. Small inputs (dish names <=50 chars) — fine."""
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        curr = [i]
        for j, cb in enumerate(b, 1):
            ins = curr[j - 1] + 1
            dele = prev[j] + 1
            sub = prev[j - 1] + (ca != cb)
            curr.append(min(ins, dele, sub))
        prev = curr
    return prev[-1]


def lev_ratio(x: str, y: str) -> float:
    longest = max(len(x), len(y))
    if longest == 0:
        return 0.0
    return _levenshtein(x, y) / longest


def tokens(items: list[str]) -> set[str]:
    """Normalized, stopword-free token set. Accepts a list of words/phrases."""
    out: set[str] = set()
    for raw in items:
        for tok in normalize(raw).split():
            if tok and tok not in _STOPWORDS:
                out.add(tok)
    return out


def jaccard(a: set[str], b: set[str]) -> float:
    if not a and not b:
        return 1.0
    union = a | b
    if not union:
        return 1.0
    return len(a & b) / len(union)


def dish_type(candidate: DishCandidate) -> str:
    """First token in normalized name that appears in DISH_TYPE_LEX, else 'unknown'."""
    for tok in normalize(candidate.raw_name).split():
        if tok in DISH_TYPE_LEX:
            return tok
    return "unknown"


# ---------- classification ----------

@dataclass(frozen=True)
class GateSignals:
    """Return-value for introspection/testing. Public API is `classify_pair`."""

    name_norm_a: str
    name_norm_b: str
    name_exact: bool
    name_close: bool
    lev: float
    type_a: str
    type_b: str
    type_same: bool
    type_differ: bool
    ingr_jaccard: float
    ingr_high: bool
    ingr_low: bool
    verdict: ReconciliationClass


def signals(a: DishCandidate, b: DishCandidate) -> GateSignals:
    # The reconciler operates on the CLEAN form the extractor produced
    # (typos fixed, redundant prefixes dropped, reorders collapsed). Using
    # raw_name here would re-introduce differences the extractor already
    # resolved ("Pizza Marghertia" vs "Margherita" would never converge).
    name_a = a.normalized_name or a.raw_name
    name_b = b.normalized_name or b.raw_name
    na, nb = normalize(name_a), normalize(name_b)
    # Name similarity on token multisets preserves ordering-insensitivity.
    ta = " ".join(sorted(na.split()))
    tb = " ".join(sorted(nb.split()))
    name_exact = ta == tb
    lev = lev_ratio(na, nb)
    name_close = lev <= 0.25

    da, db = dish_type(a), dish_type(b)
    both_known = da != "unknown" and db != "unknown"
    type_same = both_known and da == db
    type_differ = both_known and da != db

    ij = jaccard(tokens(a.ingredients), tokens(b.ingredients))
    ingr_high = ij >= 0.60
    ingr_low = ij < 0.30

    # Classification order per §2.1.
    if name_exact and (type_same or da == "unknown" or db == "unknown") and not ingr_low:
        verdict = ReconciliationClass.OBVIOUS_MERGE
    elif (not name_close) and (not (type_same and ingr_high)):
        verdict = ReconciliationClass.OBVIOUS_NON_MERGE
    else:
        verdict = ReconciliationClass.AMBIGUOUS

    return GateSignals(
        name_norm_a=na,
        name_norm_b=nb,
        name_exact=name_exact,
        name_close=name_close,
        lev=lev,
        type_a=da,
        type_b=db,
        type_same=type_same,
        type_differ=type_differ,
        ingr_jaccard=ij,
        ingr_high=ingr_high,
        ingr_low=ingr_low,
        verdict=verdict,
    )


def classify_pair(a: DishCandidate, b: DishCandidate) -> ReconciliationClass:
    return signals(a, b).verdict
