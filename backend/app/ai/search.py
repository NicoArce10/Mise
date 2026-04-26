"""Natural-language dish search.

Takes a diner's free-form query and the dish graph produced by the
pipeline, and returns the top-N dishes that actually satisfy the query,
with a one-line human reason per match. Opus 4.7 is called with
`thinking: {"type": "adaptive"}` — the model decides how much to think
based on how ambiguous the query is. Simple lookups ("milanesa
napolitana") resolve without extended thinking; colloquial / semantic
queries ("mila napo abundante", "lomito como steak sandwich") engage it.
"""
from __future__ import annotations

import json
import logging
import time
from typing import Any, Literal

from pydantic import BaseModel, Field

from ..domain.models import CockpitState, ModerationStatus
from .client import OpusCallError, call_opus, text_block
from .prompts import load as load_prompt

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = load_prompt("search")

MatchedOn = Literal[
    "alias",
    "search_term",
    "canonical_name",
    "ingredient",
    "menu_category",
    "modifier",
    "semantic_inference",
]


class SearchMatch(BaseModel):
    dish_id: str
    score: float = Field(ge=0.0, le=1.0)
    reason: str = Field(max_length=240)
    matched_on: list[MatchedOn] = Field(default_factory=list)


class SearchResponse(BaseModel):
    interpretation: str = Field(max_length=280)
    matches: list[SearchMatch] = Field(default_factory=list)


class SearchResult(BaseModel):
    """Wire shape returned to the frontend. Wraps the model output with
    server-side metadata the UI uses for the 'Opus thought more on this'
    chip and the timing readout.
    """

    query: str
    interpretation: str
    matches: list[SearchMatch]
    used_adaptive_thinking: bool
    latency_ms: int
    model: str


def _dish_digest(cockpit: CockpitState) -> list[dict[str, Any]]:
    """Compact JSON digest of the dish graph for the search prompt.

    Only ships the fields the model needs to decide a match — no source
    IDs, no reconciliation trace, no moderation state. Modifiers are
    attached to their parent so the model can satisfy "with X"
    requests.

    Dishes the reviewer rejected are dropped here so that *both* the
    natural-language search path and the offline fallback see the same
    catalog the JSON export does. Without this filter, a reviewer
    could reject a dish in the Cockpit and still see it surface in
    Try It on the next query — that would make the moderation flow
    look cosmetic rather than load-bearing.
    """
    mod_by_parent: dict[str, list[dict[str, Any]]] = {}
    for m in cockpit.modifiers:
        if m.parent_dish_id is None:
            continue
        mod_by_parent.setdefault(m.parent_dish_id, []).append(
            {
                "text": m.text,
                "price_delta": m.price_delta_value,
                "currency": m.price_delta_currency,
            }
        )

    dishes: list[dict[str, Any]] = []
    for d in cockpit.canonical_dishes:
        if d.moderation is ModerationStatus.REJECTED:
            continue
        dishes.append(
            {
                "id": d.id,
                "canonical_name": d.canonical_name,
                "aliases": d.aliases,
                "search_terms": d.search_terms,
                "ingredients": d.ingredients,
                "menu_category": d.menu_category,
                "price": d.price_value,
                "currency": d.price_currency,
                "modifiers": mod_by_parent.get(d.id, []),
            }
        )
    return dishes


def search_dishes(
    *,
    query: str,
    cockpit: CockpitState,
    top_k: int = 5,
) -> SearchResult:
    """Call Opus 4.7 to resolve `query` against `cockpit`.

    Adaptive thinking is ON — the model decides whether it needs deeper
    reasoning based on the query shape. The response is schema-parsed
    into `SearchResponse`; a validation failure triggers one tightened
    retry per `client.call_opus`.
    """
    query = query.strip()
    if not query:
        return SearchResult(
            query="",
            interpretation="Empty query.",
            matches=[],
            used_adaptive_thinking=False,
            latency_ms=0,
            model="claude-opus-4-7",
        )

    dishes = _dish_digest(cockpit)
    if not dishes:
        return SearchResult(
            query=query,
            interpretation="This menu has no dishes yet.",
            matches=[],
            used_adaptive_thinking=False,
            latency_ms=0,
            model="claude-opus-4-7",
        )

    payload = {
        "query": query,
        "dishes": dishes,
    }
    user_content = [
        text_block(
            "Diner query and current menu below. Return top matches per the "
            "rules in the system prompt.\n\n"
            f"```json\n{json.dumps(payload, ensure_ascii=False, indent=2)}\n```"
        )
    ]

    # Adaptive thinking ON. A colloquial / semantic query will naturally
    # spend more thinking; a direct-alias query will resolve fast. We do
    # not set `effort`/`task_budget` here — the guardrail is schema shape,
    # not budget cap.
    t0 = time.time()
    try:
        parsed = call_opus(
            system_prompt=_SYSTEM_PROMPT,
            user_content=user_content,
            response_model=SearchResponse,
            adaptive_thinking=True,
            effort="high",
            max_tokens=4096,
        )
    except OpusCallError as exc:
        logger.error("[mise.search] query=%r failed: %s", query, exc)
        return SearchResult(
            query=query,
            interpretation="Search is temporarily unavailable.",
            matches=[],
            used_adaptive_thinking=False,
            latency_ms=int((time.time() - t0) * 1000),
            model="claude-opus-4-7",
        )
    latency_ms = int((time.time() - t0) * 1000)

    assert isinstance(parsed, SearchResponse)
    matches = sorted(parsed.matches, key=lambda m: -m.score)[:top_k]
    valid_ids = {d["id"] for d in dishes}
    matches = [m for m in matches if m.dish_id in valid_ids]

    # Heuristic: calls that took < 2s almost certainly did not engage
    # extended thinking. We surface this as a UI hint only; it is not
    # ground truth because the SDK does not expose a reliable "extended
    # thinking used" flag on adaptive responses.
    used_adaptive_thinking = latency_ms >= 2000

    logger.info(
        "[mise.search] query=%r matches=%d interpretation=%r latency_ms=%d",
        query,
        len(matches),
        parsed.interpretation[:80],
        latency_ms,
    )

    return SearchResult(
        query=query,
        interpretation=parsed.interpretation,
        matches=matches,
        used_adaptive_thinking=used_adaptive_thinking,
        latency_ms=latency_ms,
        model="claude-opus-4-7",
    )


# Stopwords we strip before token-overlap scoring. Without this, a query
# like "ramen de miso" would "match" every dish that contains "de" in any
# field (which is most of them on a Spanish menu) — the fallback would
# silently hallucinate. These are the highest-frequency function words in
# Spanish + English that carry no lexical signal.
_STOPWORDS: frozenset[str] = frozenset(
    {
        # Spanish
        "de", "la", "el", "los", "las", "un", "una", "unos", "unas",
        "para", "con", "sin", "por", "al", "del", "en", "y", "o", "u",
        "como", "que", "algo", "mas", "muy", "tipo", "ese", "esa",
        # English
        "the", "a", "an", "of", "and", "or", "to", "for", "with",
        "some", "something", "like", "very", "my", "our",
    }
)


def search_fallback(*, query: str, cockpit: CockpitState, top_k: int = 5) -> SearchResult:
    """Offline substring / token-overlap fallback used by tests and when
    no API key is present. Produces deterministic results so CI can
    assert on them.

    Guarantees:
        * No-match queries return ``matches=[]`` — the fallback never
          invents a dish. The eval harness verifies this against a set
          of negative queries that the seeded fixture cannot satisfy.
        * Stopwords are stripped before scoring, so a query full of
          connective words (``de``, ``con``, ``for``…) does not land on
          every dish.
    """
    query_lower = query.strip().lower()
    if not query_lower:
        return SearchResult(
            query="",
            interpretation="Empty query.",
            matches=[],
            used_adaptive_thinking=False,
            latency_ms=0,
            model="fallback",
        )

    raw_tokens = [t for t in query_lower.replace(",", " ").split() if len(t) > 1]
    tokens = {t for t in raw_tokens if t not in _STOPWORDS}

    # If the query is 100% stopwords ("con y para"), there is no lexical
    # signal to score on. Refuse rather than scramble.
    if not tokens:
        return SearchResult(
            query=query,
            interpretation="No specific terms in the query to match against the menu.",
            matches=[],
            used_adaptive_thinking=False,
            latency_ms=0,
            model="fallback",
        )

    scored: list[SearchMatch] = []
    for d in cockpit.canonical_dishes:
        # Mirror the export: a rejected dish is gone from the catalog,
        # gone from the LLM digest, and gone from the fallback too.
        if d.moderation is ModerationStatus.REJECTED:
            continue
        name_low = d.canonical_name.lower()
        aliases_low = [a.lower() for a in d.aliases]
        search_terms_low = [s.lower() for s in d.search_terms]
        ingredients_low = [i.lower() for i in d.ingredients]
        category_low = (d.menu_category or "").lower()
        hay = " ".join(
            [name_low, *aliases_low, *search_terms_low, *ingredients_low, category_low]
        )

        hits = sum(1 for t in tokens if t in hay)
        if hits == 0:
            continue

        # Threshold: require either (a) a substantial phrase match (alias
        # or search_term appears as-is), or (b) more than one content
        # token hits. Single-token hits of short words cause false
        # positives and are what the eval penalises via the
        # zero-invention check.
        phrase_match = any(a in query_lower for a in aliases_low) or any(
            s in query_lower for s in search_terms_low
        )
        strong_token_hits = sum(1 for t in tokens if len(t) >= 4 and t in hay)
        if not phrase_match and strong_token_hits == 0 and hits < 2:
            continue

        score = min(1.0, 0.4 + 0.15 * hits + (0.2 if phrase_match else 0.0))
        matched_bits: list[str] = []
        matched_on: list[MatchedOn] = []
        for i, term in enumerate(aliases_low):
            if term in query_lower:
                matched_bits.append(f"alias '{d.aliases[i]}'")
                matched_on.append("alias")
                break
        for i, term in enumerate(search_terms_low):
            if term in query_lower:
                matched_bits.append(f"search_term '{d.search_terms[i]}'")
                matched_on.append("search_term")
                break
        if not matched_on:
            matched_on.append("semantic_inference")
        reason = (
            f"Matched on {', '.join(matched_bits[:2])}"
            if matched_bits
            else f"Matched {hits} content token(s) across name / aliases / ingredients."
        )
        scored.append(
            SearchMatch(
                dish_id=d.id,
                score=score,
                reason=reason,
                matched_on=matched_on,
            )
        )

    scored.sort(key=lambda m: -m.score)
    matches = scored[:top_k]
    visible = sum(
        1 for d in cockpit.canonical_dishes if d.moderation is not ModerationStatus.REJECTED
    )
    interpretation = (
        f"Fallback: token-overlap search over {visible} dishes."
        if matches
        else f"Nothing on this menu matches '{query}'. Mise will not invent a dish."
    )
    return SearchResult(
        query=query,
        interpretation=interpretation,
        matches=matches,
        used_adaptive_thinking=False,
        latency_ms=0,
        model="fallback",
    )
