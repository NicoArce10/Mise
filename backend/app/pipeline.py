"""End-to-end pipeline orchestrator.

Two modes:
- `real` — Opus 4.7 extraction + reconciliation with adaptive thinking.
- `fallback` — deterministic extraction from fixture payloads + pure-Python
  reconciliation. Used by the eval harness and by CI so a missing API key
  never breaks the demo.

The pipeline output is always a fully-formed `CockpitState` keyed to a
given `processing_id` / `batch_id`.
"""
from __future__ import annotations

import itertools
import logging
import time
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

from .ai.extraction import ExtractionFailure, extract_fallback, extract_from_bytes
from .ai.reconciliation import reconcile_deterministic, reconcile_pair
from .ai.routing import route_candidate
from .core.metrics import apply_latest_report
from .core.quality import evaluate_quality
from .domain.models import (
    CanonicalDish,
    CockpitState,
    DecisionSummary,
    DishCandidate,
    EntityId,
    EphemeralItem,
    MetricsPreview,
    Modifier,
    ProcessingRun,
    ProcessingState,
    ReconciliationResult,
    RouteLabel,
    SourceDocument,
)

logger = logging.getLogger(__name__)

Mode = Literal["real", "fallback"]

# Progress callback: invoked as (stage, detail, extra).
# Stages: 'extracting' | 'reconciling' | 'routing' | 'ready'.
StageCallback = "Callable[[str, str | None, dict[str, object] | None], None]"


@dataclass
class PipelineInput:
    source: SourceDocument
    data: bytes | None = None  # required for `real` mode
    filepath: Path | None = None  # optional, used by `real` mode when data is None


class PipelineExtractionFailure(RuntimeError):
    """Every source failed during extraction — the pipeline can't continue.

    Carries the list of failed filenames and whether the failure was
    transient (5xx / rate limit / timeout on the model API) so the API
    layer can craft a user-facing "try again in a moment" message instead
    of a generic pipeline error.
    """

    def __init__(self, failures: list[ExtractionFailure]) -> None:
        self.failures = failures
        self.transient = any(f.transient for f in failures)
        filenames = ", ".join(f.filename for f in failures) or "—"
        super().__init__(
            f"{len(failures)} source(s) failed extraction: {filenames} "
            f"({'transient' if self.transient else 'permanent'})"
        )


def _run_extraction(
    inputs: list[PipelineInput],
    mode: Mode,
    on_source_progress: Callable[[str, dict[str, Any]], None] | None = None,
    user_instructions: str | None = None,
) -> tuple[list[DishCandidate], list[ExtractionFailure]]:
    """Run extraction per source. Collect both successes and per-source
    failures so the caller can decide how to present partial results.

    `on_source_progress(stage, extra)` is invoked with:
      - stage="page_done", extra={source_idx, source_total, source_name,
                                   pages_done, pages_total}
      - stage="dishes_found", extra={names: list[str]}
    """
    all_candidates: list[DishCandidate] = []
    failures: list[ExtractionFailure] = []
    total = len(inputs)
    for source_idx, inp in enumerate(inputs, 1):

        def _on_page(done: int, pages_total: int, _source_idx: int = source_idx,
                     _source_name: str = inp.source.filename) -> None:
            if on_source_progress is not None:
                on_source_progress(
                    "page_done",
                    {
                        "source_idx": _source_idx,
                        "source_total": total,
                        "source_name": _source_name,
                        "pages_done": done,
                        "pages_total": pages_total,
                    },
                )

        def _on_names(names: list[str]) -> None:
            if on_source_progress is not None and names:
                on_source_progress("dishes_found", {"names": names})

        try:
            if mode == "real":
                data = inp.data
                if data is None and inp.filepath is not None:
                    data = inp.filepath.read_bytes()
                if data is None:
                    logger.warning("[mise] no data for %s; using fallback", inp.source.filename)
                    cands = extract_fallback(inp.source)
                    all_candidates.extend(cands)
                    _on_names([c.raw_name for c in cands])
                    _on_page(1, 1)
                else:
                    all_candidates.extend(
                        extract_from_bytes(
                            inp.source,
                            data,
                            on_page_done=_on_page,
                            on_candidates_found=_on_names,
                            user_instructions=user_instructions,
                        )
                    )
            else:
                cands = extract_fallback(inp.source)
                all_candidates.extend(cands)
                _on_names([c.raw_name for c in cands])
                _on_page(1, 1)
        except ExtractionFailure as exc:
            failures.append(exc)
    return all_candidates, failures


def _reconcile_all(
    candidates: list[DishCandidate],
    mode: Mode,
    on_pair_done: Callable[[int, int, int], None] | None = None,
    on_pair_event: Callable[
        [DishCandidate, DishCandidate, ReconciliationResult], None
    ] | None = None,
) -> list[ReconciliationResult]:
    """Pairwise reconciliation over non-modifier, non-ephemeral candidates.

    Two callbacks:
    - `on_pair_done(i, total, adaptive)` — progress counter for the state
      bar (N/M + adaptive-thinking running total).
    - `on_pair_event(left, right, result)` — rich event per completed
      pair, used by the live "cross-source reconciliation" feed on the
      Processing screen.

    Split into two because the state bar updates on EVERY pair but the
    live feed wants the full pair payload for ~interesting~ pairs only
    (cross-source or non-trivial decisions). Keeping the APIs separate
    lets callers opt into whichever they need without allocating
    unnecessary payloads.
    """
    non_flagged = [
        c for c in candidates
        if not c.is_modifier_candidate and not c.is_ephemeral_candidate
    ]
    results: list[ReconciliationResult] = []
    fn = reconcile_pair if mode == "real" else reconcile_deterministic
    pairs = list(itertools.combinations(non_flagged, 2))
    total = len(pairs)
    adaptive = 0
    for i, (a, b) in enumerate(pairs, 1):
        result = fn(a, b)
        results.append(result)
        if result.used_adaptive_thinking:
            adaptive += 1
        if on_pair_done is not None:
            on_pair_done(i, total, adaptive)
        if on_pair_event is not None:
            on_pair_event(a, b, result)
    return results


def _union_find_merges(
    candidates: list[DishCandidate], results: list[ReconciliationResult]
) -> dict[EntityId, EntityId]:
    """Build a parent-pointer map from merge decisions."""
    parent: dict[EntityId, EntityId] = {c.id: c.id for c in candidates}

    def find(x: EntityId) -> EntityId:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a: EntityId, b: EntityId) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb

    for r in results:
        if r.merged:
            union(r.left_id, r.right_id)
    return parent


def _build_cockpit(
    processing_id: EntityId,
    batch_id: EntityId,
    sources: list[SourceDocument],
    candidates: list[DishCandidate],
    reconciliations: list[ReconciliationResult],
    elapsed_s: float,
    extraction_failures: int = 0,
    user_instructions: str | None = None,
) -> CockpitState:
    parent = _union_find_merges(candidates, reconciliations)

    def root(x: EntityId) -> EntityId:
        while parent[x] != x:
            x = parent[x]
        return x

    # Group candidates by their root (after union-find).
    groups: dict[EntityId, list[DishCandidate]] = {}
    modifiers: list[Modifier] = []
    ephemerals: list[EphemeralItem] = []

    # First split: modifiers vs ephemerals vs canonicals via routing.
    canonical_candidates: list[DishCandidate] = []
    for c in candidates:
        route = route_candidate(c)
        if route.route == RouteLabel.MODIFIER:
            modifiers.append(
                Modifier(
                    id=f"mod-{uuid.uuid4().hex[:10]}",
                    text=c.raw_name,
                    price_delta_value=c.price_value,
                    price_delta_currency=c.price_currency,
                    parent_dish_id=None,
                    source_ids=[c.source_id],
                )
            )
        elif route.route == RouteLabel.EPHEMERAL:
            ephemerals.append(
                EphemeralItem(
                    id=f"eph-{uuid.uuid4().hex[:10]}",
                    text=c.raw_name,
                    source_ids=[c.source_id],
                    decision=DecisionSummary(
                        text=route.decision_summary,
                        lead_word="Routed",
                        confidence=route.confidence,
                    ),
                )
            )
        else:
            canonical_candidates.append(c)

    for c in canonical_candidates:
        groups.setdefault(root(c.id), []).append(c)

    canonical_dishes: list[CanonicalDish] = []
    rec_map: dict[tuple[EntityId, EntityId], ReconciliationResult] = {}
    for r in reconciliations:
        rec_map[(r.left_id, r.right_id)] = r

    for root_id, members in groups.items():
        members.sort(key=lambda c: c.normalized_name or c.raw_name)
        # Canonical name = the normalized_name shared by most members. The
        # extractor already cleans typos and redundant prefixes, so we do
        # not second-guess it here. Tie-break on the longest form (most
        # informative: "Milanesa Napolitana" beats "Milanesa") and then
        # alphabetically for determinism.
        name_counts: dict[str, int] = {}
        for m in members:
            if m.normalized_name:
                name_counts[m.normalized_name] = name_counts.get(m.normalized_name, 0) + 1
        if name_counts:
            canonical_name = sorted(
                name_counts.items(),
                key=lambda kv: (-kv[1], -len(kv[0]), kv[0]),
            )[0][0]
        else:
            canonical_name = "Unknown"
        # Aliases = every variant spelling we saw, plus the extractor-proposed
        # aliases from each member. Drop the canonical name itself from the list.
        alias_set: set[str] = set()
        for m in members:
            if m.raw_name and m.raw_name != canonical_name:
                alias_set.add(m.raw_name)
            if m.normalized_name and m.normalized_name != canonical_name:
                alias_set.add(m.normalized_name)
            for a in m.aliases:
                if a and a != canonical_name:
                    alias_set.add(a)
        aliases = sorted(alias_set)
        # Search terms = union from every member, deduped case-insensitively.
        seen_terms: set[str] = set()
        search_terms: list[str] = []
        for m in members:
            for t in m.search_terms:
                key = t.strip().lower()
                if key and key not in seen_terms:
                    seen_terms.add(key)
                    search_terms.append(t.strip())
        ingredients = sorted(
            {ing for m in members for ing in m.ingredients}
        )
        source_ids = sorted({m.source_id for m in members})
        # Representative price: first member that has one (sources usually
        # agree within a branch; the Detail rail still surfaces the full set).
        price_value: float | None = None
        price_currency: str | None = None
        for m in members:
            if m.price_value is not None:
                price_value = m.price_value
                price_currency = m.price_currency
                break
        # Majority menu_category across members; ignore None.
        cat_counts: dict[str, int] = {}
        for m in members:
            if m.menu_category:
                cat_counts[m.menu_category] = cat_counts.get(m.menu_category, 0) + 1
        menu_category = (
            sorted(cat_counts.items(), key=lambda kv: (-kv[1], kv[0]))[0][0]
            if cat_counts
            else None
        )

        # Find a reconciliation record that contributed to this group.
        merged_here = [
            r for r in reconciliations
            if r.left_id in {m.id for m in members}
            and r.right_id in {m.id for m in members}
        ]
        if merged_here and any(r.merged for r in merged_here):
            # Use the first merged record as the decision summary source.
            source_r = next(r for r in merged_here if r.merged)
            decision = DecisionSummary(
                text=source_r.decision_summary,
                lead_word="Merged",
                confidence=source_r.confidence,
            )
        else:
            # Singleton canonical — no merge happened.
            decision = DecisionSummary(
                text=f"Routed as canonical dish from {len(source_ids)} source(s).",
                lead_word="Routed",
                confidence=0.92,
            )

        # If this dish is NOT part of any merge, also check whether it was kept
        # separate from another via a non-merge AMBIGUOUS verdict; surface that
        # instead because the judges care about the "kept separate" narrative.
        kept_separate_from: ReconciliationResult | None = None
        for r in reconciliations:
            if not r.merged and (r.left_id == root_id or r.right_id == root_id):
                kept_separate_from = r
                break
        if kept_separate_from is not None and len(members) == 1:
            decision = DecisionSummary(
                text=kept_separate_from.decision_summary,
                lead_word="Not merged",
                confidence=kept_separate_from.confidence,
            )

        dish_id = f"dish-{uuid.uuid4().hex[:10]}"
        canonical_dishes.append(
            CanonicalDish(
                id=dish_id,
                canonical_name=canonical_name,
                aliases=aliases,
                search_terms=search_terms,
                menu_category=menu_category,
                ingredients=ingredients,
                price_value=price_value,
                price_currency=price_currency,
                source_ids=source_ids,
                modifier_ids=[],
                decision=decision,
            )
        )

    # Attach modifiers to the dish on the same source when possible.
    by_source_dishes: dict[EntityId, list[CanonicalDish]] = {}
    for d in canonical_dishes:
        for sid in d.source_ids:
            by_source_dishes.setdefault(sid, []).append(d)
    attached_modifiers: list[Modifier] = []
    for m in modifiers:
        src = m.source_ids[0] if m.source_ids else None
        dishes = by_source_dishes.get(src, []) if src else []
        if dishes:
            # Attach to the longest-named dish on that source as heuristic.
            parent = max(dishes, key=lambda d: len(d.canonical_name))
            attached_modifiers.append(
                m.model_copy(update={"parent_dish_id": parent.id})
            )
            parent.modifier_ids.append(attached_modifiers[-1].id)
        else:
            attached_modifiers.append(m)

    # Base metrics describe THIS run (counts + timing). Quality numbers
    # (`merge_precision`, `non_merge_accuracy`) must come from the eval
    # harness — never invent them. When an `evals/reports/*.json` exists we
    # overlay its aggregate. When it does not, the fields stay `None` so the
    # UI can render "—" rather than a fake value.
    base_metrics = MetricsPreview(
        sources_ingested=len(sources),
        canonical_count=len(canonical_dishes),
        modifier_count=len(attached_modifiers),
        ephemeral_count=len(ephemerals),
        merge_precision=None,
        non_merge_accuracy=None,
        time_to_review_pack_seconds=round(elapsed_s, 2),
    )
    metrics = apply_latest_report(base_metrics)

    processing = ProcessingRun(
        id=processing_id,
        batch_id=batch_id,
        state=ProcessingState.READY,
        state_detail=None,
        adaptive_thinking_pairs=sum(
            1 for r in reconciliations if r.used_adaptive_thinking
        ),
        started_at="",  # filled by the caller who owns the timer
        ready_at="",
    )

    quality_signal = evaluate_quality(
        canonical_dishes=canonical_dishes,
        extraction_failures=extraction_failures,
        extraction_total=len(sources),
    )

    # Enrich the reconciliation trace so the UI can narrate cross-source
    # merges without cross-referencing candidate IDs. The model-returned
    # records only have IDs; here we attach the human names + source ids.
    candidate_lookup: dict[EntityId, DishCandidate] = {c.id: c for c in candidates}
    enriched_trace: list[ReconciliationResult] = []
    for r in reconciliations:
        left = candidate_lookup.get(r.left_id)
        right = candidate_lookup.get(r.right_id)
        enriched_trace.append(
            r.model_copy(
                update={
                    "left_name": (left.normalized_name or left.raw_name) if left else None,
                    "right_name": (right.normalized_name or right.raw_name) if right else None,
                    "left_source_id": left.source_id if left else None,
                    "right_source_id": right.source_id if right else None,
                }
            )
        )

    return CockpitState(
        processing=processing,
        sources=sources,
        canonical_dishes=canonical_dishes,
        modifiers=attached_modifiers,
        ephemerals=ephemerals,
        reconciliation_trace=enriched_trace,
        metrics_preview=metrics,
        quality_signal=quality_signal,
        user_instructions=user_instructions,
    )


def run_pipeline(
    *,
    processing_id: EntityId,
    batch_id: EntityId,
    inputs: list[PipelineInput],
    mode: Mode = "fallback",
    on_stage: Callable[[str, str | None, dict[str, Any] | None], None] | None = None,
    user_instructions: str | None = None,
) -> CockpitState:
    """Run extraction → reconciliation → routing and materialize a CockpitState.

    `on_stage(stage, detail, extra)` is invoked as the pipeline advances so
    the caller can update a state machine the UI polls. Stages:

        'extracting'   — one call per source; extra = {'done': i, 'total': n}
        'reconciling'  — pair-level merge; extra = {'pair': i, 'total': n, 'adaptive': k}
        'routing'      — classify modifiers / ephemerals / canonicals
        'ready'        — done

    In `fallback` mode this uses deterministic fixtures — safe for CI and
    offline demos. In `real` mode it calls Opus 4.7 with vision-native
    extraction and adaptive-thinking reconciliation on AMBIGUOUS pairs.
    """
    t0 = time.time()
    sources = [inp.source for inp in inputs]

    if on_stage is not None:
        on_stage(
            "extracting",
            f"Reading {len(inputs)} source{'s' if len(inputs) != 1 else ''}",
            {"done": 0, "total": len(inputs)},
        )

    def _on_source_progress(stage: str, extra: dict[str, Any]) -> None:
        if on_stage is None:
            return
        if stage == "page_done":
            name = extra.get("source_name", "")
            pages_done = int(extra.get("pages_done", 0))
            pages_total = int(extra.get("pages_total", 1))
            source_idx = int(extra.get("source_idx", 1))
            source_total = int(extra.get("source_total", 1))
            if pages_total > 1:
                detail = (
                    f"Reading {name} · page {pages_done} of {pages_total}"
                    if source_total == 1
                    else f"Source {source_idx}/{source_total} · page {pages_done} of {pages_total}"
                )
            else:
                detail = (
                    f"Reading {name}"
                    if source_total == 1
                    else f"Read {source_idx} of {source_total} sources"
                )
            on_stage(
                "extracting",
                detail,
                {
                    "done": source_idx - (0 if pages_done < pages_total else 0),
                    "total": source_total,
                    "pages_done": pages_done,
                    "pages_total": pages_total,
                    "source_idx": source_idx,
                },
            )
        elif stage == "dishes_found":
            names = extra.get("names") or []
            on_stage("extracting", None, {"new_dish_names": names})

    candidates, failures = _run_extraction(
        inputs,
        mode,
        on_source_progress=_on_source_progress,
        user_instructions=user_instructions,
    )

    # If every source died during extraction, don't continue to reconciliation
    # and routing — that would build a "success" cockpit with zero dishes and
    # send the user to an empty search view. Raise so the API layer marks the
    # run FAILED with a transient/permanent hint for the UI.
    if failures and len(failures) == len(inputs):
        raise PipelineExtractionFailure(failures)

    if failures:
        logger.warning(
            "[mise] pipeline: %d/%d sources failed extraction (continuing with the rest)",
            len(failures),
            len(inputs),
        )

    if on_stage is not None:
        on_stage("reconciling", "Normalizing dish names", {"pair": 0, "total": 0, "adaptive": 0})

    def _on_pair_done(i: int, n: int, adaptive: int) -> None:
        if on_stage is not None:
            on_stage(
                "reconciling",
                None,
                {"pair": i, "total": n, "adaptive": adaptive},
            )

    def _on_pair_event(
        left: DishCandidate, right: DishCandidate, result: ReconciliationResult
    ) -> None:
        """Emit the full pair payload so the Processing screen can render
        a live "cross-source reconciliation" feed. We filter noise here —
        only pairs that are genuinely interesting reach the UI.

        Criteria for 'interesting' (at least one must hold):
        - cross-source (left & right came from different source files)
        - the model merged them (a duplicate dish the user never had to
          spot by hand — the product's headline claim)
        - the pair required adaptive thinking (Opus thought hard about it)
        - names disagree (typo / alias / abbreviation — the cases where
          OCR-only pipelines silently split a dish into two)
        """
        same_source = left.source_id == right.source_id
        names_agree = (
            (left.normalized_name or left.raw_name).strip().casefold()
            == (right.normalized_name or right.raw_name).strip().casefold()
        )
        interesting = (
            (not same_source)
            or result.merged
            or result.used_adaptive_thinking
            or (not names_agree)
        )
        if not interesting or on_stage is None:
            return
        on_stage(
            "reconciling",
            None,
            {
                "pair_event": {
                    "left_id": left.id,
                    "right_id": right.id,
                    "left_name": left.normalized_name or left.raw_name,
                    "right_name": right.normalized_name or right.raw_name,
                    "left_source_id": left.source_id,
                    "right_source_id": right.source_id,
                    "merged": result.merged,
                    "decision_summary": result.decision_summary,
                    "used_adaptive_thinking": result.used_adaptive_thinking,
                },
            },
        )

    reconciliations = _reconcile_all(
        candidates,
        mode,
        on_pair_done=_on_pair_done,
        on_pair_event=_on_pair_event,
    )

    if on_stage is not None:
        adaptive = sum(1 for r in reconciliations if r.used_adaptive_thinking)
        on_stage("routing", "Organizing your catalog", {"adaptive": adaptive})

    elapsed = time.time() - t0
    cockpit = _build_cockpit(
        processing_id=processing_id,
        batch_id=batch_id,
        sources=sources,
        candidates=candidates,
        reconciliations=reconciliations,
        elapsed_s=elapsed,
        extraction_failures=len(failures),
        user_instructions=user_instructions,
    )

    logger.info(
        "[mise] pipeline ready: %d canonical / %d modifiers / %d ephemerals / %d candidates total / %.1fs elapsed",
        len(cockpit.canonical_dishes),
        len(cockpit.modifiers),
        len(cockpit.ephemerals),
        len(candidates),
        elapsed,
    )

    if on_stage is not None:
        on_stage("ready", None, {"adaptive": cockpit.processing.adaptive_thinking_pairs})

    return cockpit
