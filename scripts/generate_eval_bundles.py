"""
Mise — deterministic asset generator for all three eval bundles.

Produces every evidence file under `evals/datasets/bundle_*/evidence/` with the
dish names and typos spelled EXACTLY as the eval harness expects (including the
intentional `Marghertia` typo and the inline `add burrata +3` modifier). No
image model in the loop — so we never waste time iterating until the generator
happens to render the typo correctly.

The assets are visually plausible but intentionally not pixel-perfect
photographs; the demo video shows the Cockpit, not the raw evidence. What
matters for the pipeline is that the text is exact and the surface style is
distinguishable (PDF vs photo vs chalkboard vs social post vs delivery-app).

Usage:
    pip install pillow
    python scripts/generate_eval_bundles.py                 # all three bundles
    python scripts/generate_eval_bundles.py --bundle 01     # bundle 01 only
    python scripts/generate_eval_bundles.py --bundle 02
    python scripts/generate_eval_bundles.py --bundle 03

Re-runs are idempotent; existing files are overwritten.
"""
from __future__ import annotations

import argparse
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


# ----------------------------- paths -----------------------------

REPO_ROOT = Path(__file__).resolve().parent.parent
DATASETS_DIR = REPO_ROOT / "evals" / "datasets"


# ----------------------------- fonts -----------------------------


def _font(size: int, *, bold: bool = False, italic: bool = False) -> ImageFont.FreeTypeFont:
    """Resolve a TrueType font across OSes, falling back to PIL's default bitmap font."""
    candidates_regular = [
        "C:/Windows/Fonts/georgia.ttf",
        "C:/Windows/Fonts/times.ttf",
        "/System/Library/Fonts/Supplemental/Georgia.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf",
    ]
    candidates_bold = [
        "C:/Windows/Fonts/georgiab.ttf",
        "C:/Windows/Fonts/timesbd.ttf",
        "/System/Library/Fonts/Supplemental/Georgia Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
    ]
    candidates_italic = [
        "C:/Windows/Fonts/georgiai.ttf",
        "C:/Windows/Fonts/timesi.ttf",
        "/System/Library/Fonts/Supplemental/Georgia Italic.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Italic.ttf",
    ]
    sources = candidates_bold if bold else candidates_italic if italic else candidates_regular
    for path in sources:
        try:
            return ImageFont.truetype(path, size=size)
        except OSError:
            continue
    return ImageFont.load_default()


def _sans_font(size: int, *, bold: bool = False) -> ImageFont.FreeTypeFont:
    """Neutral sans for the delivery-app screenshot and Instagram caption."""
    candidates = (
        ["C:/Windows/Fonts/seguisb.ttf", "/System/Library/Fonts/Helvetica.ttc",
         "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"]
        if bold
        else ["C:/Windows/Fonts/segoeui.ttf", "/System/Library/Fonts/Helvetica.ttc",
              "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"]
    )
    for path in candidates:
        try:
            return ImageFont.truetype(path, size=size)
        except OSError:
            continue
    return ImageFont.load_default()


def _handwrite_font(size: int) -> ImageFont.FreeTypeFont:
    """Best-effort casual/handwriting font for chalkboards and letterboards."""
    candidates = [
        "C:/Windows/Fonts/segoesc.ttf",
        "C:/Windows/Fonts/comic.ttf",
        "/System/Library/Fonts/Supplemental/Bradley Hand.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size=size)
        except OSError:
            continue
    return ImageFont.load_default()


# ----------------------------- texture helpers -----------------------------


def _add_paper_grain(img: Image.Image, *, intensity: int = 6, seed: int = 42) -> Image.Image:
    rng = random.Random(seed)
    px = img.load()
    w, h = img.size
    for _ in range((w * h) // 180):
        x = rng.randrange(w)
        y = rng.randrange(h)
        r, g, b = px[x, y][:3]
        d = rng.randrange(-intensity, intensity + 1)
        px[x, y] = (max(0, min(255, r + d)), max(0, min(255, g + d)), max(0, min(255, b + d)))
    return img


def _add_chalk_grain(img: Image.Image, *, seed: int = 7) -> Image.Image:
    rng = random.Random(seed)
    px = img.load()
    w, h = img.size
    for _ in range((w * h) // 140):
        x = rng.randrange(w)
        y = rng.randrange(h)
        r, g, b = px[x, y][:3]
        lift = rng.randrange(0, 18)
        px[x, y] = (min(255, r + lift), min(255, g + lift), min(255, b + lift))
    return img


def _warm_vignette(w: int, h: int, base: tuple[int, int, int], edge: tuple[int, int, int]) -> Image.Image:
    img = Image.new("RGB", (w, h), color=base)
    vignette = Image.new("L", (w, h), 0)
    vd = ImageDraw.Draw(vignette)
    vd.ellipse((-w // 3, -h // 3, w + w // 3, h + h // 3), fill=255)
    vignette = vignette.filter(ImageFilter.GaussianBlur(radius=80))
    overlay = Image.new("RGB", (w, h), edge)
    return Image.composite(img, overlay, vignette)


# ----------------------------- BUNDLE 01 — Italian trattoria -----------------------------


def bundle_01(out_dir: Path) -> None:
    """menu_pdf_branch_a.pdf, menu_photo_branch_b.jpg, chalkboard_branch_c.jpg, instagram_post_special.png"""
    out_dir.mkdir(parents=True, exist_ok=True)

    # --- Asset 1: menu_pdf_branch_a.pdf ---
    w, h = 1240, 1754
    img = Image.new("RGB", (w, h), color=(251, 248, 242))
    draw = ImageDraw.Draw(img)
    draw.text((120, 120), "RISTORANTE BRANCH A", fill=(28, 25, 23), font=_font(64, bold=True))
    draw.line((120, 220, w - 120, 220), fill=(28, 25, 23), width=2)
    draw.text((120, 260), "— PIZZE —", fill=(87, 83, 78), font=_font(34, italic=True))
    rows = [
        ("Pizza Marghertia", "12.00", "tomato, mozzarella, basil"),
        ("Pizza Funghi",     "14.50", "tomato, mozzarella, mushrooms"),
        ("Pizza Diavola",    "15.00", "tomato, mozzarella, salami piccante"),
    ]
    y = 360
    for name, price, desc in rows:
        draw.text((120, y), name, fill=(28, 25, 23), font=_font(34))
        draw.text((w - 260, y), price, fill=(28, 25, 23), font=_font(34))
        draw.text((120, y + 48), desc, fill=(87, 83, 78), font=_font(26, italic=True))
        y += 130
    draw.text((120, h - 160), "Prices in EUR. Service included.", fill=(168, 162, 158), font=_font(26, italic=True))
    img.save(out_dir / "menu_pdf_branch_a.pdf", "PDF", resolution=150.0)
    print("  wrote menu_pdf_branch_a.pdf")

    # --- Asset 2: menu_photo_branch_b.jpg ---
    sw = sh = 1200
    img = _warm_vignette(sw, sh, base=(243, 238, 227), edge=(233, 225, 207))
    draw = ImageDraw.Draw(img)
    draw.text((110, 110), "TRATTORIA BRANCH B", fill=(28, 25, 23), font=_font(68, bold=True))
    draw.line((110, 210, sw - 110, 210), fill=(120, 110, 90), width=2)
    draw.text((110, 240), "— specialità —", fill=(87, 83, 78), font=_font(32, italic=True))
    rows = [
        ("Margherita",     "13.00", "san marzano, fior di latte, basilico"),
        ("Calzone Funghi", "15.50", "ricotta, mozzarella, funghi porcini"),
        ("Calzone Vegano", "14.00", "crema di ceci, funghi, spinaci"),
    ]
    y = 340
    for name, price, desc in rows:
        draw.text((110, y), name, fill=(28, 25, 23), font=_font(36))
        draw.text((sw - 280, y), price, fill=(28, 25, 23), font=_font(36))
        draw.text((110, y + 50), desc, fill=(87, 83, 78), font=_font(26, italic=True))
        y += 150
    img = _add_paper_grain(img)
    img = img.rotate(-1.2, resample=Image.BICUBIC, fillcolor=(233, 225, 207), expand=False)
    img.save(out_dir / "menu_photo_branch_b.jpg", "JPEG", quality=85)
    print("  wrote menu_photo_branch_b.jpg")

    # --- Asset 3: chalkboard_branch_c.jpg ---
    w, h = 1400, 1000
    img = Image.new("RGB", (w, h), color=(28, 30, 28))
    draw = ImageDraw.Draw(img)
    chalk = (240, 238, 225)
    dim_chalk = (200, 198, 185)
    draw.text((80, 70), "BRANCH C — oggi", fill=chalk, font=_handwrite_font(58))
    draw.line((80, 160, w - 80, 160), fill=dim_chalk, width=2)
    rows = [("Margherita", "add burrata +3"), ("Pizza Diavola", "extra chili +1")]
    y = 230
    for name, modifier in rows:
        draw.text((100, y), name, fill=chalk, font=_handwrite_font(46))
        draw.text((720, y + 6), modifier, fill=dim_chalk, font=_handwrite_font(46))
        y += 140
    draw.text((100, y + 60), "Chef's pick: chat with your server", fill=dim_chalk, font=_handwrite_font(34))
    img = _add_chalk_grain(img)
    img = img.filter(ImageFilter.GaussianBlur(radius=0.6))
    img.save(out_dir / "chalkboard_branch_c.jpg", "JPEG", quality=85)
    print("  wrote chalkboard_branch_c.jpg")

    # --- Asset 4: instagram_post_special.png ---
    w = h = 1080
    img = Image.new("RGB", (w, h), color=(251, 248, 242))
    draw = ImageDraw.Draw(img)
    draw.ellipse((200, 220, 880, 720), fill=(255, 255, 253), outline=(168, 162, 158), width=4)
    rng = random.Random(11)
    for _ in range(60):
        cx = rng.randrange(320, 760)
        cy = rng.randrange(340, 620)
        draw.arc(
            (cx - 80, cy - 30, cx + 80, cy + 30),
            rng.randrange(0, 360),
            rng.randrange(0, 360),
            fill=(200, 140, 60),
            width=3,
        )
    draw.arc((440, 360, 640, 460), 0, 360, fill=(139, 46, 35), width=2)
    draw.text((120, 780), "Today only — Linguine del giorno.", fill=(28, 25, 23), font=_font(42, bold=True))
    draw.text((120, 840), "Chef's seasonal special.", fill=(87, 83, 78), font=_font(32, italic=True))
    draw.text((120, 1000), "@trattoria_demo", fill=(168, 162, 158), font=_font(22))
    img.save(out_dir / "instagram_post_special.png", "PNG")
    print("  wrote instagram_post_special.png")


# ----------------------------- BUNDLE 02 — Taqueria -----------------------------


def bundle_02(out_dir: Path) -> None:
    """menu_pdf_main.pdf, menu_screenshot_delivery.png, modifiers_chalkboard.jpg"""
    out_dir.mkdir(parents=True, exist_ok=True)

    # --- Asset 1: menu_pdf_main.pdf ---
    w, h = 1240, 1754
    img = Image.new("RGB", (w, h), color=(251, 248, 242))
    draw = ImageDraw.Draw(img)
    draw.text((120, 120), "TAQUERIA BRANCH — menu", fill=(28, 25, 23), font=_font(60, bold=True))
    draw.line((120, 220, w - 120, 220), fill=(28, 25, 23), width=2)
    rows = [
        ("Tacos al Pastor",     "3.50"),
        ("Tacos de Carnitas",   "3.50"),
        ("Tacos de Barbacoa",   "4.00"),
        ("Quesadilla de Queso", "5.50"),
    ]
    y = 280
    for name, price in rows:
        draw.text((120, y), name, fill=(28, 25, 23), font=_font(34))
        draw.text((w - 260, y), price, fill=(28, 25, 23), font=_font(34))
        y += 110
    draw.text((120, h - 160), "Prices in USD. Tax not included.", fill=(168, 162, 158), font=_font(26, italic=True))
    img.save(out_dir / "menu_pdf_main.pdf", "PDF", resolution=150.0)
    print("  wrote menu_pdf_main.pdf")

    # --- Asset 2: menu_screenshot_delivery.png (iPhone-like frame) ---
    w, h = 750, 1334
    img = Image.new("RGB", (w, h), color=(247, 247, 245))
    draw = ImageDraw.Draw(img)
    # Header bar
    draw.rectangle((0, 0, w, 80), fill=(255, 255, 255))
    draw.polygon([(30, 30), (20, 40), (30, 50), (30, 30)], fill=(28, 25, 23))  # back arrow
    draw.text((60, 24), "Taqueria", fill=(28, 25, 23), font=_sans_font(28, bold=True))
    draw.text((w - 120, 30), "4.7 (200)", fill=(87, 83, 78), font=_sans_font(20))

    items = [
        ("Al Pastor Tacos",   "$3.50"),
        ("Carnitas Tacos",    "$3.50"),
        ("Barbacoa Tacos",    "$4.00"),
        ("Cheese Quesadilla", "$5.50"),
    ]
    y = 120
    for name, price in items:
        # Card
        card_bg = (255, 255, 255)
        draw.rounded_rectangle((24, y, w - 24, y + 120), radius=12, fill=card_bg, outline=(230, 230, 225), width=1)
        draw.text((48, y + 28), name, fill=(28, 25, 23), font=_sans_font(26, bold=True))
        draw.text((48, y + 70), "Fresh corn tortilla, cilantro, onion.", fill=(120, 118, 110), font=_sans_font(18))
        draw.text((w - 180, y + 30), price, fill=(28, 25, 23), font=_sans_font(26, bold=True))
        # "Add" button
        draw.rounded_rectangle((w - 110, y + 68, w - 48, y + 100), radius=8,
                               fill=(139, 46, 35), outline=None)
        draw.text((w - 93, y + 74), "Add", fill=(255, 255, 255), font=_sans_font(20, bold=True))
        y += 150

    # Bottom tab bar
    draw.rectangle((0, h - 80, w, h), fill=(255, 255, 255))
    draw.text((60, h - 55), "Home", fill=(87, 83, 78), font=_sans_font(18))
    draw.text((220, h - 55), "Search", fill=(87, 83, 78), font=_sans_font(18))
    draw.text((420, h - 55), "Cart", fill=(87, 83, 78), font=_sans_font(18))
    draw.text((600, h - 55), "You", fill=(87, 83, 78), font=_sans_font(18))

    img.save(out_dir / "menu_screenshot_delivery.png", "PNG")
    print("  wrote menu_screenshot_delivery.png")

    # --- Asset 3: modifiers_chalkboard.jpg ---
    w, h = 1400, 1000
    img = Image.new("RGB", (w, h), color=(28, 30, 28))
    draw = ImageDraw.Draw(img)
    chalk = (240, 238, 225)
    draw.text((80, 70), "EXTRAS", fill=chalk, font=_handwrite_font(72))
    draw.line((80, 180, w - 80, 180), fill=(200, 198, 185), width=2)
    lines = ["add guacamole +2", "add queso +1", "extra salsa +0"]
    y = 260
    for line in lines:
        draw.text((120, y), line, fill=chalk, font=_handwrite_font(54))
        y += 120
    img = _add_chalk_grain(img, seed=3)
    img = img.filter(ImageFilter.GaussianBlur(radius=0.6))
    img.save(out_dir / "modifiers_chalkboard.jpg", "JPEG", quality=85)
    print("  wrote modifiers_chalkboard.jpg")


# ----------------------------- BUNDLE 03 — Modern bistro -----------------------------


def bundle_03(out_dir: Path) -> None:
    """menu_pdf_dinner.pdf, menu_pdf_lunch.pdf, chef_special_board.jpg"""
    out_dir.mkdir(parents=True, exist_ok=True)

    def _write_bistro_pdf(path: Path, heading: str, rows: list[tuple[str, str]]) -> None:
        w, h = 1240, 1754
        img = Image.new("RGB", (w, h), color=(251, 248, 242))
        draw = ImageDraw.Draw(img)
        draw.text((120, 120), heading, fill=(28, 25, 23), font=_font(56, bold=True))
        draw.line((120, 220, w - 120, 220), fill=(28, 25, 23), width=2)
        y = 280
        for name, price in rows:
            draw.text((120, y), name, fill=(28, 25, 23), font=_font(34))
            draw.text((w - 200, y), price, fill=(28, 25, 23), font=_font(34))
            y += 130
        draw.text((120, h - 160), "Prices in USD.", fill=(168, 162, 158), font=_font(26, italic=True))
        img.save(path, "PDF", resolution=150.0)

    _write_bistro_pdf(
        out_dir / "menu_pdf_dinner.pdf",
        "BISTRO — dinner",
        [("Short Rib", "28"),
         ("Halibut en Papillote", "32"),
         ("Beet Tartare", "16"),
         ("Ricotta Gnudi", "22")],
    )
    print("  wrote menu_pdf_dinner.pdf")

    _write_bistro_pdf(
        out_dir / "menu_pdf_lunch.pdf",
        "BISTRO — lunch",
        [("Beet Tartare", "14"),
         ("Ricotta Gnudi", "20"),
         ("Mushroom Toast", "15")],
    )
    print("  wrote menu_pdf_lunch.pdf")

    # --- Asset 3: chef_special_board.jpg ---
    w, h = 1600, 1000
    img = Image.new("RGB", (w, h), color=(24, 24, 22))
    draw = ImageDraw.Draw(img)
    draw.text((160, 220), "Today's Chef's Special", fill=(240, 238, 225), font=_handwrite_font(78))
    draw.text((380, 380), "— ask your server —", fill=(200, 198, 185), font=_handwrite_font(50))
    img = _add_chalk_grain(img, seed=5)
    img = img.filter(ImageFilter.GaussianBlur(radius=0.6))
    img.save(out_dir / "chef_special_board.jpg", "JPEG", quality=85)
    print("  wrote chef_special_board.jpg")


# ----------------------------- driver -----------------------------

BUNDLES = {
    "01": ("bundle_01_italian", bundle_01),
    "02": ("bundle_02_taqueria", bundle_02),
    "03": ("bundle_03_bistro",   bundle_03),
}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0] if __doc__ else None)
    ap.add_argument("--bundle", choices=["01", "02", "03", "all"], default="all")
    args = ap.parse_args()

    selected = list(BUNDLES.keys()) if args.bundle == "all" else [args.bundle]
    for key in selected:
        folder_name, fn = BUNDLES[key]
        out = DATASETS_DIR / folder_name / "evidence"
        print(f"\nGenerating {folder_name} -> {out}")
        fn(out)

    print(
        "\nAll evidence files carry exact strings the eval harness expects "
        "('Marghertia' typo; 'add burrata +3'; 'EXTRAS' header; 'Chef\\'s Special'; "
        "Taqueria token reorder). Commit them alongside the expected.json files."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
