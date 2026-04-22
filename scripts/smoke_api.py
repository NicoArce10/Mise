"""
Mise — Anthropic API smoke test (text + vision + PDF + adaptive thinking + 4.7 guardrails).

Verifies that the current ANTHROPIC_API_KEY has access to `claude-opus-4-7`
via the Messages API AND that the four load-bearing capabilities Mise depends
on actually work, AND probes the Opus 4.7 breaking-change claims from the
`claude-api` skill so we stop treating them as undocumented dogma:

  1. Text round-trip                   — baseline reachability
  2. Image vision                      — extraction layer depends on this
  3. PDF vision (native, no OCR)       — extraction layer depends on this
  4. Adaptive thinking                 — reconciliation layer depends on this

Defensive guardrail probes (warning only; they inform, they do not block):
  5. temperature=0.5 against 4.7       — per docs, should be rejected with 400
  6. last-assistant-turn prefill       — per docs, should be rejected with 400

If probes 5 or 6 pass instead of failing, it simply means the backend MAY
still accept those parameters at this moment. We log it and continue — but
the brief and the plan stop claiming the behavior as a hard contract until
this smoke confirms it on your key.

Run:
    pip install anthropic python-dotenv pillow
    python scripts/smoke_api.py

Exit codes:
    0  — all four core probes passed (guardrail probes may warn, not block)
    1  — missing / placeholder API key, or missing dependency
    2  — at least one core probe failed
"""
from __future__ import annotations

import base64
import io
import os
import sys
from pathlib import Path


# ----------------------------- env loading -----------------------------


def _load_env() -> None:
    """Load .env from repo root if python-dotenv is installed. Silent no-op otherwise."""
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    repo_root = Path(__file__).resolve().parent.parent
    load_dotenv(repo_root / ".env")


# ----------------------------- fixtures -----------------------------


def _build_tiny_menu_png() -> bytes:
    """Render a minimal one-dish menu as PNG, in-memory. Deterministic bytes."""
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError as exc:
        raise RuntimeError(
            "Pillow is required for the vision probe. Install with: pip install pillow"
        ) from exc

    img = Image.new("RGB", (640, 360), color=(251, 248, 242))  # paper tone
    draw = ImageDraw.Draw(img)

    # Use the default PIL bitmap font to keep this probe dependency-free.
    font = ImageFont.load_default()
    draw.text((40, 40), "TRATTORIA DEMO", fill=(28, 25, 23), font=font)
    draw.text((40, 120), "Pizza Marghertia     12.00", fill=(28, 25, 23), font=font)
    draw.text((40, 160), "Pizza Funghi         14.50", fill=(28, 25, 23), font=font)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _build_tiny_menu_pdf() -> bytes:
    """Render a minimal one-dish menu as single-page PDF, in-memory.

    We avoid reportlab to keep the smoke test's dependency footprint tight —
    Pillow can produce a valid single-page PDF directly from an image.
    """
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError as exc:
        raise RuntimeError(
            "Pillow is required for the vision probe. Install with: pip install pillow"
        ) from exc

    img = Image.new("RGB", (1240, 1754), color=(251, 248, 242))  # A4 @ ~150 dpi
    draw = ImageDraw.Draw(img)
    font = ImageFont.load_default()
    draw.text((80, 80), "RISTORANTE BRANCH A", fill=(28, 25, 23), font=font)
    draw.text((80, 220), "Pizza Marghertia     12.00", fill=(28, 25, 23), font=font)
    draw.text((80, 280), "Pizza Funghi         14.50", fill=(28, 25, 23), font=font)
    draw.text((80, 340), "Pizza Diavola        15.00", fill=(28, 25, 23), font=font)

    buf = io.BytesIO()
    img.save(buf, format="PDF", resolution=150.0)
    return buf.getvalue()


# ----------------------------- probes -----------------------------


def _probe_text(client, model: str) -> tuple[bool, str]:
    try:
        msg = client.messages.create(
            model=model,
            max_tokens=32,
            messages=[{"role": "user", "content": "Reply with exactly the two letters: ok"}],
        )
    except Exception as exc:
        return False, f"text probe failed: {exc}"
    if not msg.content or not hasattr(msg.content[0], "text"):
        return False, f"text probe: unexpected response shape: {msg!r}"
    reply = msg.content[0].text.strip().lower()
    if "ok" not in reply:
        return False, f"text probe: expected 'ok', got {reply!r}"
    return True, f"text ok ({reply!r})"


def _probe_image_vision(client, model: str) -> tuple[bool, str]:
    try:
        png_bytes = _build_tiny_menu_png()
    except RuntimeError as exc:
        return False, str(exc)

    b64 = base64.standard_b64encode(png_bytes).decode("ascii")
    try:
        msg = client.messages.create(
            model=model,
            max_tokens=128,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {"type": "base64", "media_type": "image/png", "data": b64},
                        },
                        {
                            "type": "text",
                            "text": (
                                "List every dish name exactly as written, one per line. "
                                "Do not correct spelling. Do not add prices. Only names."
                            ),
                        },
                    ],
                }
            ],
        )
    except Exception as exc:
        return False, f"image probe failed: {exc}"

    text = "".join(getattr(b, "text", "") for b in msg.content).strip().lower()
    if "marghertia" not in text:
        return False, (
            "image probe: model did not preserve the typo 'Marghertia' verbatim. "
            f"Got:\n---\n{text}\n---"
        )
    return True, "image vision ok (preserved 'Marghertia' typo)"


def _probe_pdf_vision(client, model: str) -> tuple[bool, str]:
    try:
        pdf_bytes = _build_tiny_menu_pdf()
    except RuntimeError as exc:
        return False, str(exc)

    b64 = base64.standard_b64encode(pdf_bytes).decode("ascii")
    try:
        msg = client.messages.create(
            model=model,
            max_tokens=256,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "document",
                            "source": {
                                "type": "base64",
                                "media_type": "application/pdf",
                                "data": b64,
                            },
                        },
                        {
                            "type": "text",
                            "text": (
                                "List every dish name exactly as written in this PDF, one per line. "
                                "Do not correct spelling."
                            ),
                        },
                    ],
                }
            ],
        )
    except Exception as exc:
        return False, f"pdf probe failed: {exc}"

    text = "".join(getattr(b, "text", "") for b in msg.content).strip().lower()
    if "marghertia" not in text:
        return False, (
            "pdf probe: model did not preserve the typo 'Marghertia' verbatim. "
            f"Got:\n---\n{text}\n---"
        )
    return True, "pdf vision ok (native PDF read, preserved typo)"


def _probe_adaptive_thinking(client, model: str) -> tuple[bool, str]:
    """Opus 4.7 takes `thinking: {type: "adaptive"}` only. `budget_tokens` is a 400."""
    try:
        msg = client.messages.create(
            model=model,
            max_tokens=1024,
            thinking={"type": "adaptive"},
            messages=[
                {
                    "role": "user",
                    "content": (
                        "Consider whether 'Pizza Funghi' and 'Calzone Funghi' are the same dish. "
                        "Reply with exactly one word: YES or NO."
                    ),
                }
            ],
        )
    except Exception as exc:
        return False, f"adaptive thinking probe failed: {exc}"

    text = "".join(getattr(b, "text", "") for b in msg.content).strip().upper()
    if "NO" not in text:
        return False, f"adaptive probe: expected NO, got {text!r}"
    return True, "adaptive thinking ok (answered NO)"


# ----------------------------- guardrail probes (warning only) -----------------------------


def _probe_temperature_rejected(client, model: str) -> tuple[bool, str]:
    """Per Opus 4.7 migration notes, `temperature` should return HTTP 400.

    We send a request with temperature=0.5 and assert it is rejected. If the
    API instead accepts it, we surface a warning — the brief stops claiming
    this as a hard contract for this key/deployment.
    """
    try:
        client.messages.create(
            model=model,
            max_tokens=16,
            temperature=0.5,
            messages=[{"role": "user", "content": "Say: temp_probe"}],
        )
    except Exception as exc:
        detail = str(exc)
        if "400" in detail or "temperature" in detail.lower() or "bad_request" in detail.lower():
            return True, "temperature correctly rejected by 4.7 (400)"
        return False, f"temperature probe errored but not with 400: {detail}"
    return False, (
        "temperature=0.5 was ACCEPTED on claude-opus-4-7 — docs claim it is removed. "
        "Your deployment may still allow it; update docs if so."
    )


def _probe_assistant_prefill_rejected(client, model: str) -> tuple[bool, str]:
    """Per Opus 4.6/4.7 migration notes, a last-assistant-turn prefill returns 400."""
    try:
        client.messages.create(
            model=model,
            max_tokens=16,
            messages=[
                {"role": "user", "content": "Complete the sentence with one word."},
                {"role": "assistant", "content": "The answer is"},
            ],
        )
    except Exception as exc:
        detail = str(exc)
        if "400" in detail or "prefill" in detail.lower() or "assistant" in detail.lower() or "bad_request" in detail.lower():
            return True, "assistant prefill correctly rejected by 4.7 (400)"
        return False, f"prefill probe errored but not with 400: {detail}"
    return False, (
        "last-assistant-turn prefill was ACCEPTED on claude-opus-4-7 — docs claim it is removed. "
        "Your deployment may still allow it; update docs if so."
    )


# ----------------------------- driver -----------------------------


def main() -> int:
    _load_env()

    key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not key or "REPLACE_ME" in key:
        print("ERROR: ANTHROPIC_API_KEY is not set (or is still the placeholder).")
        print("Steps:")
        print("  1. cp .env.example .env")
        print("  2. Edit .env and paste your real Anthropic key")
        print("  3. Re-run: python scripts/smoke_api.py")
        return 1

    model = os.environ.get("ANTHROPIC_MODEL", "claude-opus-4-7")

    try:
        from anthropic import Anthropic
    except ImportError:
        print("ERROR: the 'anthropic' package is not installed.")
        print("Install with:  pip install anthropic python-dotenv pillow")
        return 1

    client = Anthropic(api_key=key)

    print(f"Smoke-testing {model}.\n\nCore capability probes (block the gate if they fail):\n")

    core_probes = [
        ("1/4 text          ", lambda: _probe_text(client, model)),
        ("2/4 image vision  ", lambda: _probe_image_vision(client, model)),
        ("3/4 pdf vision    ", lambda: _probe_pdf_vision(client, model)),
        ("4/4 adaptive think", lambda: _probe_adaptive_thinking(client, model)),
    ]

    failures: list[str] = []
    for label, fn in core_probes:
        ok, detail = fn()
        mark = "PASS" if ok else "FAIL"
        print(f"  [{mark}] {label}  {detail}")
        if not ok:
            failures.append(f"{label.strip()}: {detail}")

    print("\nGuardrail probes (informational — verify the 4.7 breaking-change claims):\n")
    warnings: list[str] = []
    guardrail_probes = [
        ("5/6 temperature    ", lambda: _probe_temperature_rejected(client, model)),
        ("6/6 assistant prefill", lambda: _probe_assistant_prefill_rejected(client, model)),
    ]
    for label, fn in guardrail_probes:
        ok, detail = fn()
        mark = "PASS" if ok else "WARN"
        print(f"  [{mark}] {label}  {detail}")
        if not ok:
            warnings.append(f"{label.strip()}: {detail}")

    print()
    if failures:
        print(f"CORE FAILED ({len(failures)}/{len(core_probes)}). Details above.")
        print("\nIf 'model_not_found' appears, your key lacks access to claude-opus-4-7.")
        print("Request access at https://platform.claude.com.")
        print(
            "\nCRITICAL: this script is the Gate 0 check. Do not start milestone 1 "
            "until all four core probes pass."
        )
        return 2

    if warnings:
        print(
            f"Core OK ({len(core_probes)}/{len(core_probes)}), but {len(warnings)} guardrail "
            "probe(s) warned. Review the messages above — your deployment may differ from the "
            "default Opus 4.7 API shape documented in `AGENTS.md`."
        )
    else:
        print(f"OK — {model} passes all probes (core and guardrail). Gate 0 is green.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
