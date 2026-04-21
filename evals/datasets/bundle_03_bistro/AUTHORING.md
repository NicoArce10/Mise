# Bundle 03 — Modern bistro — Authoring guide

Purpose: carry the `Chef's special` ephemeral case. Also exercises reconciliation across lunch and dinner menus where some dishes are shared and some are not.

All three assets live under `evals/datasets/bundle_03_bistro/evidence/`.

## Asset 1 — `menu_pdf_dinner.pdf`

**Content (required, verbatim):**
```
BISTRO — dinner

Short Rib                 28
Halibut en Papillote      32
Beet Tartare              16
Ricotta Gnudi             22
```

**How to author:** Google Docs / Writer. A4 portrait. Clean serif or modern sans. Export as PDF.

**Validation:**
- [ ] Filename is `menu_pdf_dinner.pdf`
- [ ] The heading says `dinner` (lowercase) to cue the source channel

---

## Asset 2 — `menu_pdf_lunch.pdf`

**Purpose:** partial overlap with dinner. `Beet Tartare` and `Ricotta Gnudi` must reconcile to the same canonical dish across the two PDFs. `Mushroom Toast` is lunch-only.

**Content (required, verbatim):**
```
BISTRO — lunch

Beet Tartare              14
Ricotta Gnudi             20
Mushroom Toast            15
```

**Note:** prices differ slightly between lunch and dinner for the same dish. This is realistic and the router should reconcile by dish identity, not by price.

**Validation:**
- [ ] Filename is `menu_pdf_lunch.pdf`
- [ ] The same dish names are spelled identically in both PDFs

---

## Asset 3 — `chef_special_board.jpg`

**Purpose:** introduce the ephemeral case. The content has no stable name, no fixed price. It must be routed as ephemeral, not as a canonical dish.

**Content (required, verbatim):**
```
Today's Chef's Special
— ask your server —
```

**How to author:**

1. Figma frame 1600×1000.
2. Background: a simulated handwritten letterboard or a plain black chalkboard. Either is fine; letterboard reads more "bistro".
3. Typography: handwriting-like for the heading if chalkboard, or an all-caps geometric serif if letterboard.
4. Ensure NO PRICE appears anywhere on the board.
5. Ensure NO SPECIFIC DISH NAME appears — just "Chef's Special".
6. Export as JPG.

**Validation:**
- [ ] Filename is `chef_special_board.jpg`
- [ ] No specific dish name (no "lamb shank", no "bouillabaisse" — nothing concrete)
- [ ] No price
- [ ] The phrase `Chef's Special` appears exactly, with the apostrophe

---

## `expected.json` for Bundle 03

```json
{
  "bundle_id": "bundle_03_bistro",
  "canonical_dishes": [
    {
      "canonical_name": "Short Rib",
      "expected_aliases": [],
      "expected_sources": ["menu_pdf_dinner.pdf"],
      "expected_modifiers": [],
      "expected_route": "canonical"
    },
    {
      "canonical_name": "Halibut en Papillote",
      "expected_aliases": [],
      "expected_sources": ["menu_pdf_dinner.pdf"],
      "expected_modifiers": [],
      "expected_route": "canonical"
    },
    {
      "canonical_name": "Beet Tartare",
      "expected_aliases": [],
      "expected_sources": ["menu_pdf_dinner.pdf", "menu_pdf_lunch.pdf"],
      "expected_modifiers": [],
      "expected_route": "canonical"
    },
    {
      "canonical_name": "Ricotta Gnudi",
      "expected_aliases": [],
      "expected_sources": ["menu_pdf_dinner.pdf", "menu_pdf_lunch.pdf"],
      "expected_modifiers": [],
      "expected_route": "canonical"
    },
    {
      "canonical_name": "Mushroom Toast",
      "expected_aliases": [],
      "expected_sources": ["menu_pdf_lunch.pdf"],
      "expected_modifiers": [],
      "expected_route": "canonical"
    }
  ],
  "expected_non_merges": [],
  "expected_modifiers": [],
  "expected_ephemeral": [
    {"text": "Chef's Special", "source": "chef_special_board.jpg"}
  ]
}
```

The key assertion for this bundle: the router **must not** create a canonical dish named "Chef's Special" or "Today's Chef's Special". It must be routed as ephemeral.

## Time budget
Approximately 55 minutes for bundle 03.

## Authoring totals across all bundles
- Bundle 01: ~1:50
- Bundle 02: ~1:00
- Bundle 03: ~0:55

Total: approximately 3 hours 45 minutes of asset authoring. Budget this across Wed afternoon + Thu afternoon evenly so the eval harness has real data by Thu night.
