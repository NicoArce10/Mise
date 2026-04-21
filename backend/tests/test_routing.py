"""Tests for the deterministic routing layer."""
from __future__ import annotations

from app.ai.routing import classify_line, route_candidate
from app.domain.models import DishCandidate, EvidenceRecord, RouteLabel


def _cand(name: str, *, modifier: bool = False, ephemeral: bool = False) -> DishCandidate:
    return DishCandidate(
        id="c",
        source_id="s",
        raw_name=name,
        normalized_name=name,
        ingredients=[],
        is_modifier_candidate=modifier,
        is_ephemeral_candidate=ephemeral,
        evidence=EvidenceRecord(source_id="s", raw_text=name, span_hint=None),
    )


def test_classify_line_add_burrata_is_modifier() -> None:
    assert classify_line("add burrata +3") == RouteLabel.MODIFIER


def test_classify_line_without_cheese_is_modifier() -> None:
    assert classify_line("without cheese -1") == RouteLabel.MODIFIER


def test_classify_line_chef_special_is_ephemeral() -> None:
    assert classify_line("Chef's Special") == RouteLabel.EPHEMERAL


def test_classify_line_del_giorno_is_ephemeral() -> None:
    assert classify_line("Linguine del giorno") == RouteLabel.EPHEMERAL


def test_classify_line_plain_dish_is_none() -> None:
    assert classify_line("Margherita") is None


def test_route_candidate_honors_extraction_flags_for_modifier() -> None:
    r = route_candidate(_cand("add burrata +3", modifier=True))
    assert r.route == RouteLabel.MODIFIER
    assert r.decision_summary.startswith("Routed as modifier")


def test_route_candidate_honors_extraction_flags_for_ephemeral() -> None:
    r = route_candidate(_cand("Chef's Special", ephemeral=True))
    assert r.route == RouteLabel.EPHEMERAL


def test_route_candidate_regex_modifier_without_flag() -> None:
    r = route_candidate(_cand("add burrata +3"))
    assert r.route == RouteLabel.MODIFIER


def test_route_candidate_regex_ephemeral_without_flag() -> None:
    r = route_candidate(_cand("Chef's Special"))
    assert r.route == RouteLabel.EPHEMERAL


def test_route_candidate_default_canonical() -> None:
    r = route_candidate(_cand("Margherita"))
    assert r.route == RouteLabel.CANONICAL
