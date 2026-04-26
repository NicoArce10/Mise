"""Search must mirror the export: a REJECTED dish is gone everywhere.

The Cockpit's "Reject" action has to feel load-bearing. If the reviewer
rejects *Lobster Enchilado Rings*, the JSON export drops it — and every
read surface (LLM digest + offline fallback) must drop it too. Without
this, the moderation flow looks cosmetic.
"""
from __future__ import annotations

import sys
from pathlib import Path

# Make `from app...` work like the rest of the backend test suite.
_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_ROOT / "evals"))  # to reach the bistro fixture

from app.ai.search import _dish_digest, search_fallback  # noqa: E402
from app.domain.models import ModerationStatus  # noqa: E402
from fixtures.bistro_argentino import build_fixture  # noqa: E402


def _reject_first_n(cockpit, n: int) -> list[str]:
    """Mark the first ``n`` canonical dishes as rejected. Returns their ids."""
    rejected_ids: list[str] = []
    for dish in cockpit.canonical_dishes[:n]:
        dish.moderation = ModerationStatus.REJECTED
        rejected_ids.append(dish.id)
    return rejected_ids


def test_dish_digest_excludes_rejected_dishes() -> None:
    cockpit = build_fixture()
    rejected_ids = _reject_first_n(cockpit, 2)

    digest = _dish_digest(cockpit)

    digest_ids = {d["id"] for d in digest}
    for rid in rejected_ids:
        assert rid not in digest_ids, (
            f"rejected dish {rid!r} leaked into the LLM search digest"
        )


def test_fallback_does_not_return_rejected_dish() -> None:
    cockpit = build_fixture()
    target = cockpit.canonical_dishes[0]

    # Pick a query token that the dish would otherwise match on.
    canonical_token = target.canonical_name.split()[0].lower()

    target.moderation = ModerationStatus.REJECTED

    result = search_fallback(query=canonical_token, cockpit=cockpit, top_k=5)

    returned_ids = {m.dish_id for m in result.matches}
    assert target.id not in returned_ids, (
        "fallback returned a dish that the reviewer had rejected"
    )


def test_fallback_interpretation_count_excludes_rejected() -> None:
    cockpit = build_fixture()
    initial_count = len(cockpit.canonical_dishes)
    rejected = _reject_first_n(cockpit, 1)
    assert rejected, "fixture must have at least one dish to reject"

    # Pick a generic two-letter token that hits *some* dish, so we land
    # on the "Fallback: ... over N dishes." interpretation branch.
    result = search_fallback(query="pizza", cockpit=cockpit, top_k=5)
    if not result.matches:
        return  # negative path is covered elsewhere

    expected_count = initial_count - len(rejected)
    assert f"over {expected_count} dishes" in result.interpretation, (
        f"interpretation should reflect post-rejection count "
        f"({expected_count}), got: {result.interpretation!r}"
    )
