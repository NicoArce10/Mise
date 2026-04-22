# Bundle 01 — Italian trattoria — Authoring guide

Purpose: carry the `Marghertia -> Margherita` normalization case and the `Pizza Funghi != Calzone Funghi` non-merge case. Also carries the modifier case via Branch C.

All four assets below must exist under `evals/datasets/bundle_01_italian/evidence/` before `evals/run_eval.py` can run this bundle.

## Asset 1 — `menu_pdf_branch_a.pdf`

**Purpose:** introduce the typo'd `Marghertia` spelling plus the flat `Pizza Funghi` case.

**Content (required, verbatim):**
```
RISTORANTE BRANCH A
— PIZZE —

Pizza Marghertia     12.00     tomato, mozzarella, basil
Pizza Funghi         14.50     tomato, mozzarella, mushrooms
Pizza Diavola        15.00     tomato, mozzarella, salami piccante
```

Note the misspelling `Marghertia` on purpose. Price formatting with two decimals.

**How to author:**
- Tool: Google Docs / LibreOffice Writer / Typst / any text editor that exports to PDF.
- Paper size: A4 portrait.
- Font: a display serif (Fraunces is fine if installed locally; any serif with character is acceptable). Do not use Arial.
- Heading "RISTORANTE BRANCH A" in 28pt, uppercase.
- Body in 14pt.
- Generous margins (at least 2.5cm).
- Export as PDF. One page only.

**Validation checklist:**
- [ ] Filename is exactly `menu_pdf_branch_a.pdf`
- [ ] The typo `Marghertia` is present exactly as spelled above
- [ ] `Pizza Funghi` is present with no "pizza" qualifier difference from Branch B's calzone
- [ ] No real restaurant name is used

---

## Asset 2 — `menu_photo_branch_b.jpg`

**Purpose:** introduce `Margherita` (correctly spelled) so reconciliation must match it with `Marghertia` from Branch A. Introduce `Calzone Funghi` so the router learns it is a different dish type from Branch A's `Pizza Funghi`.

**Content (required, verbatim):**
```
TRATTORIA BRANCH B
— specialità —

Margherita           13.00     san marzano, fior di latte, basilico
Calzone Funghi       15.50     ricotta, mozzarella, funghi porcini
Calzone Vegano       14.00     crema di ceci, funghi, spinaci
```

**How to author:** two acceptable paths.

### Path A — Figma / image editor

1. Open Figma. Create a 1200×1200 frame.
2. Fill background with a warm paper texture. A subtle cream `#F3EEE3` solid with a 10% overlay of a paper grain PNG is enough.
3. Add content using a display serif for the heading and a body serif for the items.
4. Add a very slight tilt (1.5 degrees) so it reads as a photograph.
5. Apply a subtle warm shadow around the edges (0 8px 24px rgba(139, 69, 19, 0.08)) to fake a photograph frame.
6. Export as JPG at quality 85.

### Path B — Image model

Prompt to paste into any image model that allows legible text (Imagen, Midjourney with text prompt, etc):

```
A photograph of a printed trattoria menu on warm cream paper. The menu shows:
"TRATTORIA BRANCH B" as the heading in a classic serif font.
Below it, three dishes with prices in euros:
Margherita - 13.00
Calzone Funghi - 15.50
Calzone Vegano - 14.00
Each dish has a short italic description of ingredients underneath.
Square format 1:1. Soft natural lighting. Slight paper texture.
No real restaurant name. No logos. No stock photography artifacts.
```

Iterate until the spelling of `Margherita` and `Calzone Funghi` is exactly correct — no extra letters, no missing letters. Image models often mangle text; verify with OCR-free visual inspection twice before accepting.

**Validation checklist:**
- [ ] Filename is exactly `menu_photo_branch_b.jpg`
- [ ] Dimensions: square, at least 1000×1000
- [ ] `Margherita` is spelled correctly with one 'g' and one 'h' in the right places
- [ ] `Calzone Funghi` is present as a calzone, not a pizza
- [ ] Reads as a photo, not as a screenshot

---

## Asset 3 — `chalkboard_branch_c.jpg`

**Purpose:** introduce the modifier case `add burrata +3` attached to Margherita, and another modifier on Pizza Diavola.

**Content (required, verbatim):**
```
BRANCH C — oggi
Margherita         add burrata +3
Pizza Diavola      extra chili +1
Chef's pick: chat with your server
```

**How to author:**

### Path A — Figma

1. Frame 1400×1000.
2. Background: a chalkboard texture. Free source: export a chalkboard PNG from a stock site like Unsplash (search "black chalkboard texture"), confirm the license permits commercial use, and credit in this file if required.
3. Alternative if license is unclear: create it in Figma by filling with `#1E1E1E`, adding a layered noise texture, and a slight vignette at the edges.
4. Text in a handwriting-like font (Google Fonts: `Homemade Apple`, `Kalam`, or `Caveat` — all SIL OFL). Color `#F5F5F0` with 5% opacity noise overlay to fake chalk dust.
5. The modifier lines ("add burrata +3", "extra chili +1") must be visually INLINE with the dish name they modify, not on separate numbered lines.
6. Export as JPG at quality 85.

### Path B — Image model

```
A photograph of a black chalkboard in a trattoria, with a handwritten daily specials list.
Handwriting is white chalk, imperfect and slightly smudged.
The board reads exactly:
BRANCH C — oggi
Margherita    add burrata +3
Pizza Diavola    extra chili +1
Chef's pick: chat with your server
Rectangular format, ~1400×1000. Soft warm lighting from the left.
No real restaurant name. No people.
```

**Validation checklist:**
- [ ] Filename is exactly `chalkboard_branch_c.jpg`
- [ ] `add burrata +3` appears inline beside `Margherita`, not as its own bullet
- [ ] Handwriting is legible to a human — if you squint and can't read it, the model won't either
- [ ] The board reads as chalk on a board, not as printed text

---

## Asset 4 — `instagram_post_special.png`

**Purpose:** introduce an ephemeral specialty (`Linguine del giorno`) not present in any of the three branches, to exercise the ephemeral routing case.

**Content (required, verbatim):**
- Caption area: `Today only — Linguine del giorno. Chef's seasonal special.`
- Image area: a stylized rendering of linguine pasta on a ceramic plate.

**How to author:**

1. Open Figma. Create a 1080×1080 frame (Instagram square format).
2. Background: warm off-white.
3. Top two-thirds: an illustration or photograph of linguine. Two acceptable sources:
   - Draw a simple vector illustration of pasta (swirled lines on an oval plate).
   - Use an image model with the prompt: `A top-down photograph of linguine pasta in tomato sauce on a white ceramic plate, soft natural light, minimalist flat lay, square 1:1, no logos, no people`.
4. Bottom third: the caption text in a clean sans.
5. Add a faint Instagram UI frame at the top (a username placeholder like `@trattoria_b`) if desired for visual realism, but do not use a real handle.
6. Export as PNG (Instagram posts are typically PNG or JPG — PNG gives crisper text).

**Validation checklist:**
- [ ] Filename is exactly `instagram_post_special.png`
- [ ] Square format 1080×1080
- [ ] The phrase `Linguine del giorno` appears legibly
- [ ] The caption includes the word `today` or `special` or `del giorno` to cue ephemerality
- [ ] No real Instagram handle is used

---

## `expected.json` for Bundle 01

After all four assets exist, author the `expected.json` in this folder. Schema is defined in `docs/evals.md`. Minimum content for this bundle:

```json
{
  "bundle_id": "bundle_01_italian",
  "canonical_dishes": [
    {
      "canonical_name": "Margherita",
      "expected_aliases": ["Marghertia", "Pizza Margherita"],
      "expected_sources": ["menu_pdf_branch_a.pdf", "menu_photo_branch_b.jpg", "chalkboard_branch_c.jpg"],
      "expected_modifiers": [{"text": "add burrata +3", "source": "chalkboard_branch_c.jpg"}],
      "expected_route": "canonical"
    },
    {
      "canonical_name": "Pizza Funghi",
      "expected_aliases": [],
      "expected_sources": ["menu_pdf_branch_a.pdf"],
      "expected_modifiers": [],
      "expected_route": "canonical"
    },
    {
      "canonical_name": "Calzone Funghi",
      "expected_aliases": [],
      "expected_sources": ["menu_photo_branch_b.jpg"],
      "expected_modifiers": [],
      "expected_route": "canonical"
    },
    {
      "canonical_name": "Pizza Diavola",
      "expected_aliases": [],
      "expected_sources": ["menu_pdf_branch_a.pdf", "chalkboard_branch_c.jpg"],
      "expected_modifiers": [{"text": "extra chili +1", "source": "chalkboard_branch_c.jpg"}],
      "expected_route": "canonical"
    },
    {
      "canonical_name": "Calzone Vegano",
      "expected_aliases": [],
      "expected_sources": ["menu_photo_branch_b.jpg"],
      "expected_modifiers": [],
      "expected_route": "canonical"
    }
  ],
  "expected_non_merges": [
    {"left": "Pizza Funghi", "right": "Calzone Funghi", "reason": "different_dish_type"}
  ],
  "expected_modifiers": [
    {"text": "add burrata +3", "parent_dish": "Margherita"},
    {"text": "extra chili +1", "parent_dish": "Pizza Diavola"}
  ],
  "expected_ephemeral": [
    {"text": "Linguine del giorno", "source": "instagram_post_special.png"}
  ]
}
```

## Time budget
- Asset 1 (PDF): 20 min
- Asset 2 (menu photo): 30 min (longer because image-model text needs iteration)
- Asset 3 (chalkboard): 25 min
- Asset 4 (Instagram post): 20 min
- `expected.json`: 15 min

Total: approximately 1 hour 50 minutes for bundle 01.
