# Bundle 02 — Taqueria — Authoring guide

Purpose: carry the `add guacamole +2` modifier case (via the modifiers chalkboard). Also exercises reconciliation across sources with slightly re-ordered token names (e.g., `Tacos al Pastor` ↔ `Al Pastor Tacos`).

All three assets live under `evals/datasets/bundle_02_taqueria/evidence/`.

## Asset 1 — `menu_pdf_main.pdf`

**Content (required, verbatim):**
```
TAQUERIA BRANCH — menu

Tacos al Pastor          3.50
Tacos de Carnitas        3.50
Tacos de Barbacoa        4.00
Quesadilla de Queso      5.50
```

**How to author:** Google Docs / Writer. Single page. Large heading. No prices under $1 or over $10 so the eval doesn't get distracted by currency edge cases. Export to PDF.

**Validation:**
- [ ] Filename is `menu_pdf_main.pdf`
- [ ] Spanish naming convention preserved (`Tacos al Pastor`, `Quesadilla de Queso`)

---

## Asset 2 — `menu_screenshot_delivery.png`

**Purpose:** the same dishes appear with English-reordered naming. Reconciliation must merge `Tacos al Pastor` with `Al Pastor Tacos` across these two sources.

**Content (required, verbatim):**
```
Al Pastor Tacos          $3.50
Carnitas Tacos           $3.50
Barbacoa Tacos           $4.00
Cheese Quesadilla        $5.50
```

**How to author:**

1. Open Figma. Create a 750×1334 frame (iPhone-ish aspect ratio).
2. Sketch a very plausible delivery-app listing UI:
   - Top bar: a faint back arrow icon, a "Taqueria" title.
   - Each dish as its own card: name on the left, price on the right.
   - Card background `#FFFFFF`, outer background `#F7F7F5`, 12px radius.
   - Use a neutral sans like IBM Plex Sans (no Inter).
3. Add faint UI chrome: small "Add" button on the right of each row, a rating like `4.7 (200)` near the title.
4. Export as PNG.

**Validation:**
- [ ] Filename is `menu_screenshot_delivery.png`
- [ ] Each dish matches its Asset 1 counterpart in meaning but not in exact token order
- [ ] Reads unmistakably as a mobile app screenshot

---

## Asset 3 — `modifiers_chalkboard.jpg`

**Purpose:** a chalkboard listing ONLY modifiers, not dishes. The router must classify every line as a modifier, not add any of them to the canonical dish set.

**Content (required, verbatim):**
```
EXTRAS
add guacamole +2
add queso +1
extra salsa +0
```

**How to author:** same process as bundle 01's chalkboard. Export JPG.

**Validation:**
- [ ] Filename is `modifiers_chalkboard.jpg`
- [ ] The header clearly reads `EXTRAS` (so a human can tell at a glance it's not a menu)
- [ ] Each line has a `+N` price delta — this signals to the router that these are modifiers

---

## `expected.json` for Bundle 02

```json
{
  "bundle_id": "bundle_02_taqueria",
  "canonical_dishes": [
    {
      "canonical_name": "Tacos al Pastor",
      "expected_aliases": ["Al Pastor Tacos"],
      "expected_sources": ["menu_pdf_main.pdf", "menu_screenshot_delivery.png"],
      "expected_modifiers": [],
      "expected_route": "canonical"
    },
    {
      "canonical_name": "Tacos de Carnitas",
      "expected_aliases": ["Carnitas Tacos"],
      "expected_sources": ["menu_pdf_main.pdf", "menu_screenshot_delivery.png"],
      "expected_modifiers": [],
      "expected_route": "canonical"
    },
    {
      "canonical_name": "Tacos de Barbacoa",
      "expected_aliases": ["Barbacoa Tacos"],
      "expected_sources": ["menu_pdf_main.pdf", "menu_screenshot_delivery.png"],
      "expected_modifiers": [],
      "expected_route": "canonical"
    },
    {
      "canonical_name": "Quesadilla de Queso",
      "expected_aliases": ["Cheese Quesadilla"],
      "expected_sources": ["menu_pdf_main.pdf", "menu_screenshot_delivery.png"],
      "expected_modifiers": [],
      "expected_route": "canonical"
    }
  ],
  "expected_non_merges": [],
  "expected_modifiers": [
    {"text": "add guacamole +2", "parent_dish": null},
    {"text": "add queso +1", "parent_dish": null},
    {"text": "extra salsa +0", "parent_dish": null}
  ],
  "expected_ephemeral": []
}
```

Note: the modifiers in this bundle have `parent_dish: null` because the chalkboard doesn't associate them with specific dishes. The router must route them as modifiers without incorrectly binding them to a dish.

## Time budget
Approximately 1 hour for bundle 02.
