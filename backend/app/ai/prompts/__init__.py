"""Prompt loader — reads markdown templates and strips frontmatter."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

_PROMPTS_DIR = Path(__file__).resolve().parent


@lru_cache(maxsize=8)
def load(name: str) -> str:
    """Return the prompt body (after frontmatter)."""
    path = _PROMPTS_DIR / f"{name}.md"
    raw = path.read_text(encoding="utf-8")
    if raw.startswith("---"):
        # Strip frontmatter between --- markers.
        parts = raw.split("---", 2)
        if len(parts) >= 3:
            return parts[2].strip() + "\n"
    return raw.strip() + "\n"
