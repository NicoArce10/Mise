"""Extraction wrapper — Opus 4.7 vision calls per SourceDocument.

Vision-native: PDFs and images are sent as base64 `image` / `document`
content blocks. No external OCR in the critical path.

Multi-page PDFs are split page-by-page (via `pypdf`) so each page becomes
its own Opus 4.7 call in a thread pool. That gives us three properties
simultaneously:

1. Latency: a 4-page PDF fans out to 4 parallel HTTP calls instead of
   one serial 90s call.
2. Progress: the UI can show "Page 3 of 5" in real time and a live chip
   wall of dish names as they are extracted.
3. Resilience: a transient 500 on one page no longer kills the whole
   run — we surface partial results and log which pages died.
"""
from __future__ import annotations

import logging
import mimetypes
import os
import threading
import time as _time
import uuid
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor, as_completed
from io import BytesIO
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field

from ..core.store import new_id
from ..domain.models import DishCandidate, EntityId, EvidenceRecord, SourceDocument
from .client import (
    OpusCallError,
    OpusTransientError,
    call_opus,
    image_block,
    text_block,
)
from .prompts import load as load_prompt

logger = logging.getLogger(__name__)

# Adaptive parallelism. Firing N concurrent calls with the SAME json_schema
# puts pressure on Anthropic's server-side grammar compiler — past ~2
# concurrent requests on a complex schema we observe `Grammar compilation
# timed out` 400s in cascade. For long PDFs (11+ pages) even 2 is too
# aggressive because the compiler stays hot across the whole burst; one
# failure then ripples to the fallback schema too. The function below
# picks a conservative concurrency based on page count.
_PDF_LAUNCH_STAGGER_S = 0.4


def _pdf_parallelism_for(n_pages: int) -> int:
    """How many PDF pages to process concurrently, based on total page count.

    Rationale:
      - Very short PDFs (<=2 pages) don't benefit from parallelism.
      - Short PDFs (3-5 pages) use 2 workers — the happy path we tuned on.
      - Medium PDFs (6-10 pages) drop to 2 but with longer staggering — 2
        is still the ceiling that works reliably on Anthropic's grammar
        pool; higher numbers fail cascade-style.
      - Large PDFs (>10 pages) go sequential. The grammar compiler stays
        cool because only one compile is in flight; total time is higher
        but the success rate on a 10-minute demo recording is what matters.
    """
    if n_pages <= 2:
        return 1
    if n_pages <= 5:
        return 2
    if n_pages <= 10:
        return 2
    return 1


# `effort` controls how deep Opus 4.7 thinks before emitting JSON. For
# extraction — structured-output task with clear semantics — `medium` is
# the sweet spot: catches every dish the human eye would catch, without
# the cost and grammar-compiler pressure of `high`. The env var lets us
# flip to `high` on a known-clean bundle when we want top quality for
# the demo recording, and to `low` during dev / for large PDFs.
_EXTRACTION_EFFORT = os.environ.get("MISE_EXTRACTION_EFFORT", "medium").lower()

# For very large PDFs the per-page effort automatically drops to `low` —
# the JSON schema compiler pressure is lower and we still get the list
# of dishes, just with slightly less deliberation on ambiguous cases.
_LARGE_PDF_PAGE_THRESHOLD = 6

# Callback signatures used by the pipeline to stream progress to the UI.
#   on_page_done(done, total) — called after each page finishes (ok or err)
#   on_candidates(names) — called as soon as a page returns candidate names,
#   so the Processing screen can render a live chip wall.
OnPageDone = Callable[[int, int], None]
OnCandidatesFound = Callable[[list[str]], None]


class ExtractionFailure(RuntimeError):
    """One source couldn't be read because the API call itself failed.

    Distinct from the legitimate "successfully returned zero candidates"
    case (for example a blank page). Used so the pipeline can tell the
    user "the model was unreachable for your file" instead of silently
    producing an empty catalog.
    """

    def __init__(self, filename: str, reason: str, *, transient: bool) -> None:
        super().__init__(f"{filename}: {reason}")
        self.filename = filename
        self.reason = reason
        self.transient = transient

_SYSTEM_PROMPT = load_prompt("extraction")


class _ExtractedCandidate(BaseModel):
    """SDK-facing shape — the full grammar the model aims for.

    Deliberately small. Every extra field inflates the grammar the server-
    side json_schema compiler has to build, and big grammars under load
    produce the 400 "Grammar compilation timed out" that nuked earlier
    demos. `raw_text` and `span_hint` were removed for that reason —
    `raw_text` falls back to `raw_name` in `_candidates_from_response`.

    `menu_category` is intentionally KEPT on this schema even though it's
    one extra field: it's load-bearing for the canonical export, the
    search facet (`search.py`), the confidence scorer (`pipeline.py`),
    and the quality signal (`core/quality.py`). Without it those
    consumers all silently degrade — see the "missing_categories"
    false-positive on every run prior to this fix. If the grammar
    timeout returns, the fallback `_MinimalExtractedCandidate` (which
    omits this field) still produces a usable catalog.
    """

    raw_name: str
    normalized_name: str
    inferred_dish_type: str | None = None
    ingredients: list[str] = Field(default_factory=list)
    price_value: float | None = None
    price_currency: str | None = None
    is_modifier_candidate: bool = False
    is_ephemeral_candidate: bool = False
    # Feeds natural-language search. Aliases are other spellings / shorthand
    # for the SAME dish that a human might type; search_terms are cultural
    # handles (e.g. "mila napo", "napo grande") that never appear on the
    # menu itself but that locals use when asking for this dish.
    aliases: list[str] = Field(default_factory=list)
    search_terms: list[str] = Field(default_factory=list)
    # The visible section header the dish lives under on the evidence
    # (e.g. "Pizzas", "Antipasti", "Breakfast", "Sides"). `None` when no
    # header is visible — chalkboards, tweets, cropped photos. The model
    # is instructed (see `prompts/extraction.md`) to copy the header
    # verbatim in Title Case and never invent one.
    menu_category: str | None = None


class _MinimalExtractedCandidate(BaseModel):
    """Tiny fallback schema — used only when the primary grammar times out.

    Contains exactly the fields needed to build a usable dish graph:
    a name, a price, and alias/search surface. The model can still emit
    modifiers and ephemerals but without the boolean flags, so downstream
    reconciliation treats them like regular dishes — acceptable fallback
    since this path only fires when the "real" schema is blocked by a
    grammar-compiler timeout on Anthropic's side.
    """

    raw_name: str
    normalized_name: str
    price_value: float | None = None
    price_currency: str | None = None
    aliases: list[str] = Field(default_factory=list)
    search_terms: list[str] = Field(default_factory=list)


class ExtractionResponse(BaseModel):
    candidates: list[_ExtractedCandidate] = Field(default_factory=list)
    # Tripwire / audit trail for the per-run HARD FILTER. When the user
    # attaches a `user_instructions` directive (e.g. "skip beverages",
    # "no vegetarian dishes"), Opus is asked to list here the canonical
    # names it dropped BECAUSE of that filter. We then run a
    # belt-and-braces post-filter in `_call_one_chunk` — if Opus
    # contradicts itself and returns a candidate whose name also shows
    # up in this list, we drop it from the final output. Empty on runs
    # without user_instructions, which keeps the grammar cost zero in
    # the happy path.
    excluded_by_user_filter: list[str] = Field(default_factory=list)


class _MinimalExtractionResponse(BaseModel):
    candidates: list[_MinimalExtractedCandidate] = Field(default_factory=list)


_RESPONSE_SCHEMA: dict[str, Any] = ExtractionResponse.model_json_schema()
_MINIMAL_RESPONSE_SCHEMA: dict[str, Any] = _MinimalExtractionResponse.model_json_schema()


def _guess_media_type(path: Path) -> str:
    mime, _ = mimetypes.guess_type(str(path))
    if mime:
        return mime
    ext = path.suffix.lower()
    return {
        ".pdf": "application/pdf",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
    }.get(ext, "application/octet-stream")


def _split_pdf_pages(data: bytes) -> list[bytes]:
    """Split a PDF into one single-page PDF per page.

    We keep each chunk in PDF form (rather than rasterizing to images) so
    Opus 4.7 still sees the original vector text + layout. For heavily
    graphic menus this preserves fidelity that rasterization would flatten.

    Returns [data] unchanged if the PDF has only one page, can't be parsed,
    or if `pypdf` isn't importable on this interpreter. The last case is
    critical: the pipeline must NEVER crash because an optional dependency
    is missing — we just lose parallelism and fall back to a single call.
    """
    try:
        from pypdf import PdfReader, PdfWriter  # local import — lib is optional
    except ModuleNotFoundError:
        logger.warning(
            "[mise] pypdf not installed on this interpreter — "
            "running without page-level parallelism. "
            "Install via `pip install pypdf>=6.0` to enable it."
        )
        return [data]

    try:
        reader = PdfReader(BytesIO(data))
    except Exception as exc:
        logger.warning("[mise] pypdf could not read PDF: %s — falling back to single call", exc)
        return [data]

    n = len(reader.pages)
    if n <= 1:
        return [data]

    out: list[bytes] = []
    for i, page in enumerate(reader.pages):
        try:
            writer = PdfWriter()
            writer.add_page(page)
            buf = BytesIO()
            writer.write(buf)
            out.append(buf.getvalue())
        except Exception as exc:
            logger.warning("[mise] pypdf could not split page %d: %s", i + 1, exc)
            return [data]  # conservative: don't half-split, fall back entirely
    logger.info("[mise] split PDF into %d single-page chunks", n)
    return out


# Defensive cap on `menu_category`. Real section headers are short
# ("Pizzas", "Antipasti", "Side Dishes"). Anything beyond ~60 chars is
# almost certainly a dish name the model misclassified as a section, or
# the model echoing a marketing tagline. We truncate rather than drop so
# the UI can still surface what was emitted while not blowing up the
# search facet with multi-line strings.
_MENU_CATEGORY_MAX_LEN = 60


def _normalize_category(raw: str | None) -> str | None:
    """Coerce a raw `menu_category` string into a clean, comparable form.

    The pipeline's majority-vote logic in `_build_canonical_dish`
    (pipeline.py) buckets reconciled members by exact-string equality, so
    "PIZZAS", "Pizzas", and " pizzas " would otherwise count as three
    different sections. We normalize at the extraction edge — once, here —
    to keep the rest of the pipeline simple and to guarantee that the
    canonical export carries one consistent shape ("Pizzas") regardless
    of how each individual menu chose to typeset its own headers.

    Rules:
      - `None` / empty / whitespace-only → `None` (no false bucket).
      - Collapse internal whitespace.
      - Title-case (Python's `.title()` is unicode-aware enough for
        accents — "Antipasti" stays "Antipasti", "Plato Del Día" stays
        with its accent).
      - Cap at `_MENU_CATEGORY_MAX_LEN` characters.
    """
    if raw is None:
        return None
    cleaned = " ".join(raw.split()).strip()
    if not cleaned:
        return None
    if len(cleaned) > _MENU_CATEGORY_MAX_LEN:
        cleaned = cleaned[:_MENU_CATEGORY_MAX_LEN].rstrip()
    return cleaned.title()


def _candidates_from_response(
    parsed: ExtractionResponse | _MinimalExtractionResponse,
    source: SourceDocument,
    span_prefix: str,
) -> list[DishCandidate]:
    """Materialize `DishCandidate` objects from a parsed response.

    Accepts either the full `ExtractionResponse` or the fallback
    `_MinimalExtractionResponse`. Missing fields on the minimal shape
    fall back to safe defaults — the caller can't tell which grammar
    the server actually used.
    """
    out: list[DishCandidate] = []
    for candidate in parsed.candidates:
        cand_id: EntityId = new_id("cand")
        evidence = EvidenceRecord(
            source_id=source.id,
            raw_text=candidate.raw_name,
            span_hint=span_prefix or None,
        )
        out.append(
            DishCandidate(
                id=cand_id,
                source_id=source.id,
                raw_name=candidate.raw_name,
                normalized_name=candidate.normalized_name or candidate.raw_name.strip().title(),
                inferred_dish_type=getattr(candidate, "inferred_dish_type", None),
                ingredients=getattr(candidate, "ingredients", []),
                price_value=candidate.price_value,
                price_currency=candidate.price_currency,
                is_modifier_candidate=getattr(candidate, "is_modifier_candidate", False),
                is_ephemeral_candidate=getattr(candidate, "is_ephemeral_candidate", False),
                aliases=candidate.aliases,
                search_terms=candidate.search_terms,
                menu_category=_normalize_category(
                    getattr(candidate, "menu_category", None)
                ),
                evidence=evidence,
            )
        )
    return out


def _call_one_chunk(
    *,
    source: SourceDocument,
    chunk_bytes: bytes,
    media_type: str,
    chunk_label: str,
    span_prefix: str,
    effort: str,
    max_tokens: int,
    user_instructions: str | None = None,
    excluded_sink: list[str] | None = None,
) -> list[DishCandidate]:
    """Run a single Opus 4.7 vision call on one chunk (full file or one PDF page).

    Raises `OpusTransientError`, `OpusCallError`, or any other exception —
    the caller decides whether partial failures are tolerable.

    `user_instructions`, when provided, is rendered as an extra text block
    AFTER the image and BEFORE the generic extraction directive. The system
    prompt still wins on schema and the extraction rules — this block only
    adds a narrow, per-run filter ("Skip beverages", "Only extract pizzas",
    "Ignore the daily specials section"). Whitespace-only input is treated
    as absent so the textarea can ship blank without polluting the prompt.
    """
    # Order matters. When user_instructions is present we put it FIRST in
    # the directives (i.e. immediately after the image and before the
    # generic extraction directive) and phrase it as a hard filter — not a
    # polite suggestion. Opus 4.7 otherwise treats trailing "extra
    # instructions" as optional nice-to-haves and will happily extract a
    # dish the user asked it to skip. The wording below was tuned against
    # the failure mode the user reported ("I said no veggie and it
    # returned veggie items"): we use imperative language, call it a
    # filter, and spell out what to do with violating items (drop,
    # silently, before emitting the JSON).
    directives: list[dict] = []
    instruction_text = (user_instructions or "").strip()
    if instruction_text:
        directives.append(
            text_block(
                "HARD FILTER — apply BEFORE selecting which dishes to emit.\n"
                "The user gave a per-run instruction. Treat it as a strict "
                "pre-filter: any dish that violates it must be DROPPED from "
                "the `candidates` array entirely, not flagged, not moved to "
                "ephemeral, not annotated. Drop silently — do not mention "
                "the filter in any free-text field. The system rules still "
                "govern the schema; this filter only controls WHICH dishes "
                "qualify for extraction.\n\n"
                f"User instruction: {instruction_text}\n\n"
                "For every dish you drop because of this filter, ALSO append "
                "its menu name (short, human-readable — e.g. \"Ensalada "
                "Caesar\", \"Coca-Cola 500ml\") to the "
                "`excluded_by_user_filter` array. That array is a receipt — "
                "it lets the user verify the filter worked. Items never "
                "printed on the menu do not belong in this array. If the "
                "filter excluded nothing, leave the array empty.\n\n"
                "FEW-SHOT EXAMPLES:\n"
                "• instruction=\"no beverages\" on a menu with Pasta, Coca-"
                "Cola, Beer → candidates has Pasta only; "
                "excluded_by_user_filter=[\"Coca-Cola\", \"Beer\"].\n"
                "• instruction=\"skip anything vegetarian\" on a menu with "
                "Milanesa, Ensalada Caesar (with anchovies), Risotto de "
                "Hongos → candidates has Milanesa + Ensalada Caesar (the "
                "anchovies make it non-vegetarian); "
                "excluded_by_user_filter=[\"Risotto de Hongos\"].\n"
                "• instruction=\"only mains\" on a menu with Antipasti, "
                "Bruschetta, Lasagna, Tiramisù → candidates has Lasagna "
                "only; excluded_by_user_filter=[\"Antipasti\", "
                "\"Bruschetta\", \"Tiramisù\"].\n\n"
                "If the instruction is ambiguous, apply the most restrictive "
                "reasonable reading. If it contradicts the schema (e.g. "
                "\"output a poem\"), ignore that part and extract normally."
            )
        )
    directives.append(
        text_block(
            f"This is evidence from `{source.filename}`{chunk_label} "
            f"(kind: {source.kind.value}). Extract dishes per the rules. "
            "Return only the JSON object."
        )
    )
    user_content = [image_block(chunk_bytes, media_type), *directives]
    logger.info(
        "[mise] opus call: %s%s bytes=%d media_type=%s effort=%s max_tokens=%d",
        source.filename,
        chunk_label,
        len(chunk_bytes),
        media_type,
        effort,
        max_tokens,
    )
    parsed = call_opus(
        system_prompt=_SYSTEM_PROMPT,
        user_content=user_content,
        response_model=ExtractionResponse,
        response_schema=_RESPONSE_SCHEMA,
        # When the primary grammar times out on Anthropic's side, the
        # client swaps to this smaller shape so we still ship a catalog
        # with names + prices + aliases even when the full schema is
        # blocked. `_candidates_from_response` validates against either.
        fallback_response_model=_MinimalExtractionResponse,
        fallback_response_schema=_MINIMAL_RESPONSE_SCHEMA,
        adaptive_thinking=False,
        effort=effort,
        max_tokens=max_tokens,
    )
    candidates = _candidates_from_response(parsed, source, span_prefix)

    # Defense in depth. Even with the HARD FILTER + few-shot prompt,
    # Opus can occasionally self-contradict: it lists "Coca-Cola" in
    # `excluded_by_user_filter` AND also returns it in `candidates`.
    # We trust the exclusion list — if Opus says it dropped something,
    # then any matching candidate is a bug we silently correct. This
    # never fires on the happy path because the minimal fallback
    # schema doesn't carry the exclusion list, which is fine: the
    # fallback only runs when the full grammar failed, and in that
    # extreme we'd rather ship a result than enforce the filter.
    excluded = getattr(parsed, "excluded_by_user_filter", None) or []
    if instruction_text and excluded:
        blocked = {name.strip().lower() for name in excluded if name.strip()}
        kept: list[DishCandidate] = []
        dropped_post: list[str] = []
        for c in candidates:
            surfaces = {
                (c.raw_name or "").strip().lower(),
                (c.normalized_name or "").strip().lower(),
                *((a or "").strip().lower() for a in (c.aliases or [])),
            }
            if surfaces & blocked:
                dropped_post.append(c.normalized_name or c.raw_name)
                continue
            kept.append(c)
        if dropped_post:
            logger.warning(
                "[mise] post-filter removed %d candidates Opus "
                "self-excluded: %s",
                len(dropped_post),
                dropped_post,
            )
        candidates = kept

    if instruction_text and excluded:
        logger.info(
            "[mise] HARD FILTER audit · %s%s · kept=%d · excluded_by_filter=%d · excluded_list=%s",
            source.filename,
            chunk_label,
            len(candidates),
            len(excluded),
            excluded,
        )

    # Receipt: surface every dish Opus dropped because of the user's
    # filter so the Cockpit can render an "Excluded by user filter"
    # section. The sink is opt-in (None on the legacy paths) so existing
    # call sites and tests don't have to change.
    if excluded_sink is not None and excluded:
        seen = {n.strip().lower() for n in excluded_sink}
        for name in excluded:
            if not isinstance(name, str):
                continue
            stripped = name.strip()
            if not stripped:
                continue
            key = stripped.lower()
            if key in seen:
                continue
            seen.add(key)
            excluded_sink.append(stripped)

    return candidates


def extract_from_bytes(
    source: SourceDocument,
    data: bytes,
    *,
    effort: str | None = None,
    max_tokens: int = 16384,
    on_page_done: OnPageDone | None = None,
    on_candidates_found: OnCandidatesFound | None = None,
    user_instructions: str | None = None,
    excluded_sink: list[str] | None = None,
) -> list[DishCandidate]:
    """Call Opus 4.7 on this source's raw bytes.

    For multi-page PDFs, splits the file and fans out N parallel calls
    (one per page) via a thread pool. For single-page PDFs and images,
    falls back to a single vision call.

    `on_page_done(done, total)` fires after every chunk completes (success
    or failure). `on_candidates_found(names)` fires when a chunk returns
    one or more candidate names — the UI can display them live so a 90 s
    Opus call no longer feels like a frozen spinner.

    Returns a list of fully-formed `DishCandidate`. If every chunk fails
    AND zero candidates came through, raises `ExtractionFailure` with
    `transient=True` if any chunk failure was transient (5xx / timeout),
    so the pipeline can decide whether to mark the whole run FAILED.
    """
    media_type = source.content_type or _guess_media_type(Path(source.filename))
    resolved_effort = effort or _EXTRACTION_EFFORT

    # Split multi-page PDFs. Single-page PDFs and images stay as one chunk.
    if media_type == "application/pdf":
        chunks = _split_pdf_pages(data)
    else:
        chunks = [data]

    n = len(chunks)

    if n == 1:
        # Single-chunk path: keep behaviour identical to the pre-splitting
        # implementation for images and one-page PDFs.
        try:
            out = _call_one_chunk(
                source=source,
                chunk_bytes=chunks[0],
                media_type=media_type,
                chunk_label="",
                span_prefix="",
                effort=resolved_effort,
                max_tokens=max_tokens,
                user_instructions=user_instructions,
                excluded_sink=excluded_sink,
            )
        except OpusTransientError as exc:
            logger.error("[mise] opus unreachable for %s: %s", source.filename, exc)
            raise ExtractionFailure(source.filename, str(exc), transient=True) from exc
        except OpusCallError as exc:
            logger.error("[mise] extraction failed on %s: %s", source.filename, exc)
            raise ExtractionFailure(source.filename, str(exc), transient=False) from exc
        except Exception as exc:
            logger.error(
                "[mise] extraction crashed on %s (%s): %s",
                source.filename,
                type(exc).__name__,
                exc,
            )
            raise ExtractionFailure(
                source.filename, f"{type(exc).__name__}: {exc}", transient=False
            ) from exc

        if not out:
            logger.warning(
                "[mise] opus returned 0 candidates for %s (bytes=%d, media_type=%s)",
                source.filename,
                len(data),
                media_type,
            )
        else:
            logger.info(
                "[mise] extraction: %s returned %d candidates",
                source.filename,
                len(out),
            )
            if on_candidates_found is not None:
                on_candidates_found([c.raw_name or c.normalized_name for c in out])

        if on_page_done is not None:
            on_page_done(1, 1)
        return out

    # Multi-page PDF path: fan out to a thread pool. The SDK is thread-safe
    # and each call blocks on HTTP I/O, so threads give a near-linear
    # latency improvement up to the Anthropic rate limit.
    out: list[DishCandidate] = []
    transient_failures: list[str] = []
    permanent_failures: list[str] = []
    counter = [0]
    cancel_lock = threading.Lock()

    def _bump() -> None:
        with cancel_lock:
            counter[0] += 1
            done = counter[0]
        if on_page_done is not None:
            on_page_done(done, n)

    workers = min(_pdf_parallelism_for(n), n)
    # For large PDFs drop the per-page effort to keep the grammar compiler
    # calm across the whole burst. The `effort=` arg the caller passed
    # wins if they explicitly override it (e.g. for a canary).
    page_effort = resolved_effort
    if n >= _LARGE_PDF_PAGE_THRESHOLD and effort is None:
        page_effort = "low"
        logger.info(
            "[mise] large PDF (%d pages) — using effort=low per page to keep "
            "the grammar compiler healthy across the burst",
            n,
        )
    logger.info(
        "[mise] PDF plan: %s, pages=%d, workers=%d, effort=%s",
        source.filename,
        n,
        workers,
        page_effort,
    )
    with ThreadPoolExecutor(max_workers=workers, thread_name_prefix="mise-pdf") as ex:
        futures: dict[Any, int] = {}
        for idx, chunk in enumerate(chunks, 1):
            futures[
                ex.submit(
                    _call_one_chunk,
                    source=source,
                    chunk_bytes=chunk,
                    media_type="application/pdf",
                    chunk_label=f" (page {idx} of {n})",
                    span_prefix=f"p{idx}",
                    effort=page_effort,
                    max_tokens=max_tokens,
                    user_instructions=user_instructions,
                    excluded_sink=excluded_sink,
                )
            ] = idx
            # Stagger submission so the first few pages don't all hit the
            # grammar compiler in the same millisecond. The pool size
            # still caps concurrency; this just spaces the initial burst.
            if idx < workers:
                _time.sleep(_PDF_LAUNCH_STAGGER_S)
        for fut in as_completed(futures):
            idx = futures[fut]
            try:
                cands = fut.result()
            except OpusTransientError as exc:
                logger.warning(
                    "[mise] page %d of %s unreachable: %s", idx, source.filename, exc
                )
                transient_failures.append(f"p{idx}")
            except OpusCallError as exc:
                logger.warning(
                    "[mise] page %d of %s extraction error: %s", idx, source.filename, exc
                )
                permanent_failures.append(f"p{idx}")
            except Exception as exc:
                logger.warning(
                    "[mise] page %d of %s crashed (%s): %s",
                    idx,
                    source.filename,
                    type(exc).__name__,
                    exc,
                )
                permanent_failures.append(f"p{idx}")
            else:
                with cancel_lock:
                    out.extend(cands)
                if cands and on_candidates_found is not None:
                    on_candidates_found([c.raw_name or c.normalized_name for c in cands])
            finally:
                _bump()

    total_failures = len(transient_failures) + len(permanent_failures)
    ok = n - total_failures
    if ok == 0:
        # Every page died. Surface as ExtractionFailure so the pipeline can
        # decide if the whole run is FAILED or just this source.
        detail = (
            f"{n} pages failed "
            f"({len(transient_failures)} transient / {len(permanent_failures)} permanent)"
        )
        if transient_failures:
            raise ExtractionFailure(source.filename, detail, transient=True)
        raise ExtractionFailure(source.filename, detail, transient=False)

    if total_failures:
        logger.warning(
            "[mise] partial extraction on %s: %d/%d pages OK, failed=%s",
            source.filename,
            ok,
            n,
            transient_failures + permanent_failures,
        )
    logger.info(
        "[mise] extraction: %s returned %d candidates across %d pages",
        source.filename,
        len(out),
        n,
    )
    return out


def extract_from_path(
    source: SourceDocument,
    path: Path,
    **kwargs: Any,
) -> list[DishCandidate]:
    """Convenience: read bytes from disk and call `extract_from_bytes`."""
    data = path.read_bytes()
    return extract_from_bytes(source, data, **kwargs)


# ---------- post-extraction user-instruction filter ----------


class _FilterDecision(BaseModel):
    """One keep/drop ruling for a single candidate.

    `cid` (not `id`) is the short integer index we hand the model — the
    real EntityId strings are long (`cand_01HW...`) and burn tokens for
    zero informational gain. We re-map back to real IDs on our side.
    """

    cid: int
    keep: bool
    reason: str = Field(max_length=120)


class _FilterResponse(BaseModel):
    decisions: list[_FilterDecision] = Field(default_factory=list)


_FILTER_RESPONSE_SCHEMA: dict[str, Any] = _FilterResponse.model_json_schema()


# System prompt for the post-filter pass. Kept deliberately terse — the
# task is a narrow keep/drop classification with short reasons, and
# shorter prompts compile faster on Anthropic's grammar side.
_FILTER_SYSTEM_PROMPT = (
    "You are a filter pass over a restaurant's already-extracted dish "
    "catalog. The user gave a natural-language directive describing "
    "which dishes they want to keep for THIS run (e.g. \"no beverages\", "
    "\"skip vegetarian items\", \"only mains\", \"sin postres\", "
    "\"nothing with shellfish\"). Your job: for every candidate, decide "
    "keep=true if it satisfies the directive, keep=false otherwise.\n\n"
    "How to read a dish:\n"
    "• Use the name, inferred_dish_type, AND ingredients together. "
    "A dish called \"Ensalada César\" with only `lettuce, parmesan, "
    "croutons` IS vegetarian; the same name with `anchovies` in "
    "ingredients is NOT.\n"
    "• When the ingredients list is empty, fall back to the dish type "
    "and name. Err on the side of KEEPING ambiguous items — the "
    "downstream UI lets humans review dropped dishes, but a dish "
    "dropped by mistake is invisible.\n"
    "• Treat the directive as permissive, not strict: \"no veggie\" "
    "means \"drop dishes whose ingredients are all vegetarian\", NOT "
    "\"drop anything that has a vegetable on the plate\".\n\n"
    "Reasons should be short and factual — e.g. \"purely vegetarian "
    "(tomato, mozzarella, basil)\" or \"kept: contains chorizo\".\n"
    "Return decisions for EVERY cid in the input, in any order."
)


def apply_user_instruction_filter(
    candidates: list[DishCandidate],
    user_instruction: str,
    *,
    effort: str = "low",
    max_tokens: int = 4096,
) -> tuple[list[DishCandidate], list[dict[str, Any]]]:
    """Second-pass LLM filter against free-form user instructions.

    We run this AFTER extraction because the in-prompt HARD FILTER
    (see `_call_one_chunk`) is best-effort: Opus 4.7 occasionally
    returns a dish it was told to skip, either because the instruction
    was ambiguous in context or because the model momentarily forgot
    its own pre-filter under token pressure. That fix patched the most
    common self-contradiction (a dish emitted AND listed in
    `excluded_by_user_filter`) but couldn't help when Opus silently
    dropped the tracking itself.

    This pass is a separate, dedicated classification call:
      - input = the final candidates list + the user's instruction
      - output = a keep/drop decision for every candidate, with a
        one-line reason per decision for the audit log
      - effort = "low" by default (classification is the simple case)

    Returns `(kept, audit)` where `audit` is a list of dicts with
    `name`, `kept` (bool), and `reason` — ready to feed a UI panel or
    be written to the catalog export. The function NEVER raises on
    LLM errors: on failure it returns the input unchanged with an
    empty audit, so a flaky API call never silently erases a user's
    whole menu.
    """
    instruction = (user_instruction or "").strip()
    if not instruction or not candidates:
        return list(candidates), []

    # Map short indices (what the model sees) to the real candidates.
    index_to_candidate: dict[int, DishCandidate] = {
        i: c for i, c in enumerate(candidates)
    }

    # Render each candidate as a compact row. Keeping ingredients on a
    # single comma-separated line makes the prompt predictable and
    # cheaper; if ingredients are empty we still emit the field so the
    # model doesn't have to special-case it.
    def _row(i: int, c: DishCandidate) -> str:
        ingr = ", ".join(c.ingredients) if c.ingredients else "—"
        price = (
            f"{c.price_value} {c.price_currency or ''}".strip()
            if c.price_value is not None
            else "—"
        )
        return (
            f"cid={i}\n"
            f"  name: {c.normalized_name or c.raw_name}\n"
            f"  type: {c.inferred_dish_type or 'unknown'}\n"
            f"  ingredients: {ingr}\n"
            f"  price: {price}"
        )

    user_prompt = (
        f"USER INSTRUCTION: {instruction}\n\n"
        f"CANDIDATES ({len(candidates)}):\n\n"
        + "\n\n".join(_row(i, c) for i, c in index_to_candidate.items())
        + "\n\nFor every cid above, emit a decision with keep=true or "
        "keep=false and a short reason. Do not add, skip, or rename "
        "any cid."
    )

    try:
        parsed: _FilterResponse = call_opus(
            system_prompt=_FILTER_SYSTEM_PROMPT,
            user_content=[text_block(user_prompt)],
            response_model=_FilterResponse,
            response_schema=_FILTER_RESPONSE_SCHEMA,
            adaptive_thinking=False,  # simple classification, no need
            effort=effort,
            max_tokens=max_tokens,
        )
    except (OpusTransientError, OpusCallError) as exc:
        # Fail OPEN — a filter pass that crashed should not erase the
        # catalog. The in-prompt HARD FILTER already ran during
        # extraction and caught the common cases; losing this second
        # pass is degraded, not broken.
        logger.warning(
            "[mise] user-instruction post-filter LLM call failed "
            "(%s) — returning unfiltered candidates",
            exc,
        )
        return list(candidates), []

    # Build a cid → decision map. If the model skipped any cid (rare,
    # but possible under token pressure), default to keep so the user
    # doesn't lose dishes silently.
    keep_by_cid: dict[int, bool] = {i: True for i in index_to_candidate}
    reason_by_cid: dict[int, str] = {i: "" for i in index_to_candidate}
    for d in parsed.decisions:
        if d.cid in keep_by_cid:
            keep_by_cid[d.cid] = bool(d.keep)
            reason_by_cid[d.cid] = d.reason

    kept: list[DishCandidate] = []
    audit: list[dict[str, Any]] = []
    for i, c in index_to_candidate.items():
        name = c.normalized_name or c.raw_name
        keep = keep_by_cid[i]
        audit.append({"name": name, "kept": keep, "reason": reason_by_cid[i]})
        if keep:
            kept.append(c)

    dropped_names = [a["name"] for a in audit if not a["kept"]]
    logger.info(
        "[mise] user-instruction post-filter: kept=%d, dropped=%d, "
        "instruction=%r, dropped_names=%s",
        len(kept),
        len(dropped_names),
        instruction,
        dropped_names,
    )
    return kept, audit


# ---------- deterministic fallback (used when API calls are disabled) ----------

_FALLBACK_HINTS = {
    "menu_pdf_branch_a.pdf": [
        {"raw_name": "Pizza Marghertia", "normalized_name": "Margherita",
         "inferred_dish_type": "pizza", "menu_category": "Pizze",
         "ingredients": ["tomato", "mozzarella", "basil"], "price_value": 9.0, "price_currency": "EUR"},
        {"raw_name": "Pizza Funghi", "normalized_name": "Pizza Funghi",
         "inferred_dish_type": "pizza", "menu_category": "Pizze",
         "ingredients": ["tomato", "mozzarella", "mushrooms"], "price_value": 11.0, "price_currency": "EUR"},
        {"raw_name": "Pizza Diavola", "normalized_name": "Pizza Diavola",
         "inferred_dish_type": "pizza", "menu_category": "Pizze",
         "ingredients": ["tomato", "mozzarella", "salami", "chili"], "price_value": 12.0, "price_currency": "EUR"},
    ],
    "menu_photo_branch_b.jpg": [
        {"raw_name": "Margherita", "normalized_name": "Margherita",
         "inferred_dish_type": "pizza", "menu_category": "Pizze",
         "ingredients": ["tomato", "mozzarella", "basil"], "price_value": 9.0, "price_currency": "EUR"},
        {"raw_name": "Calzone Funghi", "normalized_name": "Calzone Funghi",
         "inferred_dish_type": "calzone", "menu_category": "Calzoni",
         "ingredients": ["mozzarella", "mushrooms", "ricotta"], "price_value": 13.0, "price_currency": "EUR"},
        {"raw_name": "Calzone Vegano", "normalized_name": "Calzone Vegano",
         "inferred_dish_type": "calzone", "menu_category": "Calzoni",
         "ingredients": ["tomato", "vegan mozzarella", "vegetables"], "price_value": 12.5, "price_currency": "EUR"},
    ],
    "chalkboard_branch_c.jpg": [
        {"raw_name": "Pizza Margherita", "normalized_name": "Margherita",
         "inferred_dish_type": "pizza",
         "ingredients": ["tomato", "mozzarella", "basil"], "price_value": 9.5, "price_currency": "EUR"},
        {"raw_name": "Pizza Diavola", "normalized_name": "Pizza Diavola",
         "inferred_dish_type": "pizza",
         "ingredients": ["tomato", "mozzarella", "salami", "chili"], "price_value": 12.5, "price_currency": "EUR"},
        {"raw_name": "add burrata +3", "normalized_name": "add burrata +3",
         "inferred_dish_type": "unknown", "ingredients": [],
         "price_value": 3.0, "price_currency": "EUR", "is_modifier_candidate": True},
        {"raw_name": "extra chili +1", "normalized_name": "extra chili +1",
         "inferred_dish_type": "unknown", "ingredients": [],
         "price_value": 1.0, "price_currency": "EUR", "is_modifier_candidate": True},
    ],
    "instagram_post_special.png": [
        {"raw_name": "Linguine del giorno", "normalized_name": "Linguine del giorno",
         "inferred_dish_type": "pasta", "ingredients": [],
         "price_value": None, "price_currency": None, "is_ephemeral_candidate": True},
    ],
    "menu_pdf_main.pdf": [
        {"raw_name": "Tacos al Pastor", "normalized_name": "Tacos al Pastor",
         "inferred_dish_type": "taco", "menu_category": "Tacos",
         "ingredients": ["pork", "pineapple", "onion", "cilantro"], "price_value": 4.0, "price_currency": "USD"},
        {"raw_name": "Tacos de Carnitas", "normalized_name": "Tacos de Carnitas",
         "inferred_dish_type": "taco", "menu_category": "Tacos",
         "ingredients": ["pork", "onion", "cilantro"], "price_value": 4.0, "price_currency": "USD"},
        {"raw_name": "Tacos de Barbacoa", "normalized_name": "Tacos de Barbacoa",
         "inferred_dish_type": "taco", "menu_category": "Tacos",
         "ingredients": ["beef", "onion", "cilantro"], "price_value": 4.5, "price_currency": "USD"},
        {"raw_name": "Quesadilla de Queso", "normalized_name": "Quesadilla de Queso",
         "inferred_dish_type": "quesadilla", "menu_category": "Quesadillas",
         "ingredients": ["cheese", "tortilla"], "price_value": 3.5, "price_currency": "USD"},
    ],
    "menu_screenshot_delivery.png": [
        {"raw_name": "Al Pastor Tacos", "normalized_name": "Tacos al Pastor",
         "inferred_dish_type": "taco", "menu_category": "Tacos",
         "ingredients": ["pork", "pineapple", "onion"], "price_value": 4.5, "price_currency": "USD"},
        {"raw_name": "Carnitas Tacos", "normalized_name": "Tacos de Carnitas",
         "inferred_dish_type": "taco", "menu_category": "Tacos",
         "ingredients": ["pork", "onion"], "price_value": 4.5, "price_currency": "USD"},
        {"raw_name": "Barbacoa Tacos", "normalized_name": "Tacos de Barbacoa",
         "inferred_dish_type": "taco", "menu_category": "Tacos",
         "ingredients": ["beef", "onion"], "price_value": 5.0, "price_currency": "USD"},
        {"raw_name": "Cheese Quesadilla", "normalized_name": "Quesadilla de Queso",
         "inferred_dish_type": "quesadilla", "menu_category": "Quesadillas",
         "ingredients": ["cheese", "tortilla"], "price_value": 3.95, "price_currency": "USD"},
    ],
    "modifiers_chalkboard.jpg": [
        {"raw_name": "add guacamole +2", "normalized_name": "add guacamole +2",
         "inferred_dish_type": "unknown", "ingredients": [],
         "price_value": 2.0, "price_currency": "USD", "is_modifier_candidate": True},
        {"raw_name": "add queso +1", "normalized_name": "add queso +1",
         "inferred_dish_type": "unknown", "ingredients": [],
         "price_value": 1.0, "price_currency": "USD", "is_modifier_candidate": True},
        {"raw_name": "extra salsa +0", "normalized_name": "extra salsa +0",
         "inferred_dish_type": "unknown", "ingredients": [],
         "price_value": 0.0, "price_currency": "USD", "is_modifier_candidate": True},
    ],
    "menu_pdf_lunch.pdf": [
        {"raw_name": "Beet Tartare", "normalized_name": "Beet Tartare",
         "inferred_dish_type": "tartare", "menu_category": "Starters",
         "ingredients": ["beet", "capers", "lemon"], "price_value": 14.0, "price_currency": "USD"},
        {"raw_name": "Ricotta Gnudi", "normalized_name": "Ricotta Gnudi",
         "inferred_dish_type": "gnudi", "menu_category": "Mains",
         "ingredients": ["ricotta", "spinach", "butter"], "price_value": 18.0, "price_currency": "USD"},
        {"raw_name": "Mushroom Toast", "normalized_name": "Mushroom Toast",
         "inferred_dish_type": "toast", "menu_category": "Starters",
         "ingredients": ["mushroom", "bread", "thyme"], "price_value": 12.0, "price_currency": "USD"},
    ],
    "menu_pdf_dinner.pdf": [
        {"raw_name": "Short Rib", "normalized_name": "Short Rib",
         "inferred_dish_type": "rib", "menu_category": "Mains",
         "ingredients": ["beef", "red wine", "shallot"], "price_value": 34.0, "price_currency": "USD"},
        {"raw_name": "Halibut en Papillote", "normalized_name": "Halibut en Papillote",
         "inferred_dish_type": "halibut", "menu_category": "Mains",
         "ingredients": ["halibut", "lemon", "thyme"], "price_value": 32.0, "price_currency": "USD"},
        {"raw_name": "Beet Tartare", "normalized_name": "Beet Tartare",
         "inferred_dish_type": "tartare", "menu_category": "Starters",
         "ingredients": ["beet", "capers", "lemon"], "price_value": 16.0, "price_currency": "USD"},
        {"raw_name": "Ricotta Gnudi", "normalized_name": "Ricotta Gnudi",
         "inferred_dish_type": "gnudi", "menu_category": "Mains",
         "ingredients": ["ricotta", "spinach", "butter"], "price_value": 20.0, "price_currency": "USD"},
    ],
    "chef_special_board.jpg": [
        {"raw_name": "Chef's Special", "normalized_name": "Chef's Special",
         "inferred_dish_type": "unknown", "ingredients": [],
         "price_value": None, "price_currency": None, "is_ephemeral_candidate": True},
    ],
}


def extract_fallback(source: SourceDocument) -> list[DishCandidate]:
    """Deterministic fixture extraction keyed on filename.

    Used by the eval harness when `MISE_PIPELINE_MODE != real` so tests and
    CI runs do not require an API key. The payloads mirror what Opus 4.7
    would return on the three MVP bundles.
    """
    hints = _FALLBACK_HINTS.get(source.filename, [])
    out: list[DishCandidate] = []
    for h in hints:
        cand_id = f"cand-{uuid.uuid4().hex[:10]}"
        out.append(
            DishCandidate(
                id=cand_id,
                source_id=source.id,
                raw_name=h["raw_name"],
                normalized_name=h["normalized_name"],
                inferred_dish_type=h.get("inferred_dish_type"),
                ingredients=h.get("ingredients", []),
                price_value=h.get("price_value"),
                price_currency=h.get("price_currency"),
                is_modifier_candidate=bool(h.get("is_modifier_candidate", False)),
                is_ephemeral_candidate=bool(h.get("is_ephemeral_candidate", False)),
                menu_category=_normalize_category(h.get("menu_category")),
                evidence=EvidenceRecord(
                    source_id=source.id,
                    raw_text=h["raw_name"],
                    span_hint=None,
                ),
            )
        )
    return out
