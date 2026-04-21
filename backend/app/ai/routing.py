"""Routing — deterministic regex first, LLM fallback optional.

On the three MVP bundles the regex covers every line. The LLM branch is
stubbed so it can be wired in later without changing the pipeline shape.
"""
from __future__ import annotations

import re

from ..domain.models import (
    DishCandidate,
    RouteLabel,
    RoutingDecision,
)

MODIFIER_REGEX = re.compile(
    r"^\s*(add|extra|with|without|sin|con)\s+.+\s+[+\-]?\$?\d+(\.\d{1,2})?\s*$",
    re.IGNORECASE,
)

EPHEMERAL_HINTS = (
    "chef's special",
    "chefs special",
    "del giorno",
    "del dia",
    "del día",
    "daily special",
    "today only",
    "tonight only",
    "plato del día",
    "plato del dia",
)


def classify_line(text: str) -> RouteLabel | None:
    """Pure-text classifier — returns None if regex cannot decide."""
    stripped = text.strip()
    low = stripped.lower()
    if any(hint in low for hint in EPHEMERAL_HINTS):
        return RouteLabel.EPHEMERAL
    if MODIFIER_REGEX.match(stripped):
        return RouteLabel.MODIFIER
    return None


def route_candidate(c: DishCandidate) -> RoutingDecision:
    """Route a candidate using the deterministic rules.

    Signals from the extraction stage (`is_modifier_candidate`,
    `is_ephemeral_candidate`) are honored first. The regex is a belt-and-
    suspenders pass over the raw name.
    """
    # Extraction may have already flagged the candidate.
    if c.is_modifier_candidate:
        return RoutingDecision(
            candidate_id=c.id,
            route=RouteLabel.MODIFIER,
            parent_dish_id=None,
            decision_summary=(
                "Routed as modifier because it has a relative price and no standalone dish body."
            )[:240],
            confidence=0.93,
        )
    if c.is_ephemeral_candidate:
        return RoutingDecision(
            candidate_id=c.id,
            route=RouteLabel.EPHEMERAL,
            parent_dish_id=None,
            decision_summary=(
                "Routed as ephemeral because no stable name across sources and no fixed price."
            )[:240],
            confidence=0.88,
        )

    regex_label = classify_line(c.raw_name)
    if regex_label == RouteLabel.MODIFIER:
        return RoutingDecision(
            candidate_id=c.id,
            route=RouteLabel.MODIFIER,
            parent_dish_id=None,
            decision_summary=(
                "Routed as modifier because the line matches the add/extra price-delta pattern."
            )[:240],
            confidence=0.90,
        )
    if regex_label == RouteLabel.EPHEMERAL:
        return RoutingDecision(
            candidate_id=c.id,
            route=RouteLabel.EPHEMERAL,
            parent_dish_id=None,
            decision_summary=(
                "Routed as ephemeral because the heading signals a daily/chef's special."
            )[:240],
            confidence=0.87,
        )

    # Default: canonical dish.
    return RoutingDecision(
        candidate_id=c.id,
        route=RouteLabel.CANONICAL,
        parent_dish_id=None,
        decision_summary="Routed as canonical dish.",
        confidence=0.95,
    )
