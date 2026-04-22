"""Extraction wrapper — one Opus 4.7 call per SourceDocument.

Vision-native: PDFs and images are sent as base64 `image` content blocks.
No external OCR in the critical path.
"""
from __future__ import annotations

import logging
import mimetypes
import uuid
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field

from ..core.store import new_id
from ..domain.models import DishCandidate, EntityId, EvidenceRecord, SourceDocument
from .client import OpusCallError, call_opus, image_block, text_block
from .prompts import load as load_prompt

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = load_prompt("extraction")


class _ExtractedCandidate(BaseModel):
    """SDK-facing shape — IDs and evidence are materialized server-side."""

    raw_name: str
    normalized_name: str
    inferred_dish_type: str | None = None
    ingredients: list[str] = Field(default_factory=list)
    price_value: float | None = None
    price_currency: str | None = None
    is_modifier_candidate: bool = False
    is_ephemeral_candidate: bool = False
    raw_text: str = ""
    span_hint: str | None = None


class ExtractionResponse(BaseModel):
    candidates: list[_ExtractedCandidate] = Field(default_factory=list)


_RESPONSE_SCHEMA: dict[str, Any] = ExtractionResponse.model_json_schema()


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


def extract_from_bytes(
    source: SourceDocument,
    data: bytes,
    *,
    effort: str = "high",
    max_tokens: int = 4096,
) -> list[DishCandidate]:
    """Call Opus 4.7 once on this source's raw bytes.

    Returns a list of fully-formed `DishCandidate` with server-minted IDs
    and a single `EvidenceRecord` per candidate that anchors back to the
    source.
    """
    media_type = source.content_type or _guess_media_type(Path(source.filename))
    user_content = [
        image_block(data, media_type),
        text_block(
            f"This is evidence from `{source.filename}` (kind: {source.kind.value}). "
            "Extract dishes per the rules. Return only the JSON object."
        ),
    ]

    try:
        parsed = call_opus(
            system_prompt=_SYSTEM_PROMPT,
            user_content=user_content,
            response_model=ExtractionResponse,
            response_schema=_RESPONSE_SCHEMA,
            adaptive_thinking=False,
            effort=effort,
            max_tokens=max_tokens,
        )
    except OpusCallError as exc:
        logger.error("[mise] extraction failed on %s: %s", source.filename, exc)
        return []
    except Exception as exc:
        # Any other SDK-level error (BadRequestError, RateLimitError, network
        # blip) on a single source must not bring the whole pipeline down —
        # the reviewer still benefits from the sources that did succeed.
        logger.error(
            "[mise] extraction crashed on %s (%s): %s",
            source.filename,
            type(exc).__name__,
            exc,
        )
        return []

    assert isinstance(parsed, ExtractionResponse)

    out: list[DishCandidate] = []
    for candidate in parsed.candidates:
        cand_id: EntityId = new_id("cand")
        evidence = EvidenceRecord(
            source_id=source.id,
            raw_text=candidate.raw_text or candidate.raw_name,
            span_hint=candidate.span_hint,
        )
        out.append(
            DishCandidate(
                id=cand_id,
                source_id=source.id,
                raw_name=candidate.raw_name,
                normalized_name=candidate.normalized_name or candidate.raw_name.strip().title(),
                inferred_dish_type=candidate.inferred_dish_type,
                ingredients=candidate.ingredients,
                price_value=candidate.price_value,
                price_currency=candidate.price_currency,
                is_modifier_candidate=candidate.is_modifier_candidate,
                is_ephemeral_candidate=candidate.is_ephemeral_candidate,
                evidence=evidence,
            )
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
