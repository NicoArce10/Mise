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
    demos. Fields that exist only to help the UI (raw_text, span_hint,
    menu_category) were removed — `raw_text` falls back to `raw_name` in
    `_candidates_from_response`, and the others aren't load-bearing for
    reconciliation or search.
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
                menu_category=None,
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
    directives = [
        text_block(
            f"This is evidence from `{source.filename}`{chunk_label} "
            f"(kind: {source.kind.value}). Extract dishes per the rules. "
            "Return only the JSON object."
        ),
    ]
    instruction_text = (user_instructions or "").strip()
    if instruction_text:
        directives.append(
            text_block(
                "Extra user instructions for THIS run — apply them ON TOP of "
                "the system rules without breaking the schema. If an "
                "instruction conflicts with the schema or asks you to "
                "invent dishes, ignore that part and continue. Never output "
                "prose outside the JSON object.\n\n"
                f"Instructions: {instruction_text}"
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
    return _candidates_from_response(parsed, source, span_prefix)


def extract_from_bytes(
    source: SourceDocument,
    data: bytes,
    *,
    effort: str | None = None,
    max_tokens: int = 16384,
    on_page_done: OnPageDone | None = None,
    on_candidates_found: OnCandidatesFound | None = None,
    user_instructions: str | None = None,
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


# ---------- deterministic fallback (used when API calls are disabled) ----------

_FALLBACK_HINTS = {
    "menu_pdf_branch_a.pdf": [
        {"raw_name": "Pizza Marghertia", "normalized_name": "Margherita",
         "inferred_dish_type": "pizza",
         "ingredients": ["tomato", "mozzarella", "basil"], "price_value": 9.0, "price_currency": "EUR"},
        {"raw_name": "Pizza Funghi", "normalized_name": "Pizza Funghi",
         "inferred_dish_type": "pizza",
         "ingredients": ["tomato", "mozzarella", "mushrooms"], "price_value": 11.0, "price_currency": "EUR"},
        {"raw_name": "Pizza Diavola", "normalized_name": "Pizza Diavola",
         "inferred_dish_type": "pizza",
         "ingredients": ["tomato", "mozzarella", "salami", "chili"], "price_value": 12.0, "price_currency": "EUR"},
    ],
    "menu_photo_branch_b.jpg": [
        {"raw_name": "Margherita", "normalized_name": "Margherita",
         "inferred_dish_type": "pizza",
         "ingredients": ["tomato", "mozzarella", "basil"], "price_value": 9.0, "price_currency": "EUR"},
        {"raw_name": "Calzone Funghi", "normalized_name": "Calzone Funghi",
         "inferred_dish_type": "calzone",
         "ingredients": ["mozzarella", "mushrooms", "ricotta"], "price_value": 13.0, "price_currency": "EUR"},
        {"raw_name": "Calzone Vegano", "normalized_name": "Calzone Vegano",
         "inferred_dish_type": "calzone",
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
         "inferred_dish_type": "taco",
         "ingredients": ["pork", "pineapple", "onion", "cilantro"], "price_value": 4.0, "price_currency": "USD"},
        {"raw_name": "Tacos de Carnitas", "normalized_name": "Tacos de Carnitas",
         "inferred_dish_type": "taco",
         "ingredients": ["pork", "onion", "cilantro"], "price_value": 4.0, "price_currency": "USD"},
        {"raw_name": "Tacos de Barbacoa", "normalized_name": "Tacos de Barbacoa",
         "inferred_dish_type": "taco",
         "ingredients": ["beef", "onion", "cilantro"], "price_value": 4.5, "price_currency": "USD"},
        {"raw_name": "Quesadilla de Queso", "normalized_name": "Quesadilla de Queso",
         "inferred_dish_type": "quesadilla",
         "ingredients": ["cheese", "tortilla"], "price_value": 3.5, "price_currency": "USD"},
    ],
    "menu_screenshot_delivery.png": [
        {"raw_name": "Al Pastor Tacos", "normalized_name": "Tacos al Pastor",
         "inferred_dish_type": "taco",
         "ingredients": ["pork", "pineapple", "onion"], "price_value": 4.5, "price_currency": "USD"},
        {"raw_name": "Carnitas Tacos", "normalized_name": "Tacos de Carnitas",
         "inferred_dish_type": "taco",
         "ingredients": ["pork", "onion"], "price_value": 4.5, "price_currency": "USD"},
        {"raw_name": "Barbacoa Tacos", "normalized_name": "Tacos de Barbacoa",
         "inferred_dish_type": "taco",
         "ingredients": ["beef", "onion"], "price_value": 5.0, "price_currency": "USD"},
        {"raw_name": "Cheese Quesadilla", "normalized_name": "Quesadilla de Queso",
         "inferred_dish_type": "quesadilla",
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
         "inferred_dish_type": "tartare",
         "ingredients": ["beet", "capers", "lemon"], "price_value": 14.0, "price_currency": "USD"},
        {"raw_name": "Ricotta Gnudi", "normalized_name": "Ricotta Gnudi",
         "inferred_dish_type": "gnudi",
         "ingredients": ["ricotta", "spinach", "butter"], "price_value": 18.0, "price_currency": "USD"},
        {"raw_name": "Mushroom Toast", "normalized_name": "Mushroom Toast",
         "inferred_dish_type": "toast",
         "ingredients": ["mushroom", "bread", "thyme"], "price_value": 12.0, "price_currency": "USD"},
    ],
    "menu_pdf_dinner.pdf": [
        {"raw_name": "Short Rib", "normalized_name": "Short Rib",
         "inferred_dish_type": "rib",
         "ingredients": ["beef", "red wine", "shallot"], "price_value": 34.0, "price_currency": "USD"},
        {"raw_name": "Halibut en Papillote", "normalized_name": "Halibut en Papillote",
         "inferred_dish_type": "halibut",
         "ingredients": ["halibut", "lemon", "thyme"], "price_value": 32.0, "price_currency": "USD"},
        {"raw_name": "Beet Tartare", "normalized_name": "Beet Tartare",
         "inferred_dish_type": "tartare",
         "ingredients": ["beet", "capers", "lemon"], "price_value": 16.0, "price_currency": "USD"},
        {"raw_name": "Ricotta Gnudi", "normalized_name": "Ricotta Gnudi",
         "inferred_dish_type": "gnudi",
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
                evidence=EvidenceRecord(
                    source_id=source.id,
                    raw_text=h["raw_name"],
                    span_hint=None,
                ),
            )
        )
    return out
