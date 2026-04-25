# Demo assets — how to use

The demo is **86 % live screen recording of the real product** and
14 % pre-rendered cards (2 numeric hooks + wordmark + closing).
Everything between the hooks and the closing card is Mise on camera.

Two files live here:

- `cards.html` — standalone 4-card HTML rendered in the product's own
  type system. Cards 01 + 02 carry the numeric hook, card 03 is the
  wordmark, card 04 is the closing.
- `export-cards.mjs` — optional Node script to batch-export the cards
  as 1920 × 1080 PNGs using Playwright.

---

## Option A — Manual capture (3 minutes · zero dependencies)

Recommended. Produces four PNGs that drop directly into CapCut.

1. Open `cards.html` in **Chrome** (or Edge).
2. Press `F` to go full-screen.
3. Press `H` to hide the HUD at the bottom-right.
4. Capture each card with **Win + Shift + S** → "Full-screen snip".
5. Save as `card-01.png`, `card-02.png`, `card-03.png`, `card-04.png`.
6. Navigate with `←` / `→` or press `1` / `2` / `3` / `4`.

Tip — use a 1920 × 1080 monitor if possible. On higher-DPI screens
the card still renders crisp, but the captured PNG will be larger;
that is fine for a 1080p video (it scales down cleanly).

---

## Option B — Automatic PNG export (Playwright, one command)

If you have Node 20+:

```bash
cd docs/demo
npm install --no-save playwright
npx playwright install --with-deps chromium
node export-cards.mjs
```

Produces `card-01.png` … `card-04.png` next to `cards.html`, each
exactly 1920 × 1080.

---

## Card ↔ timestamp mapping

| Card | Timestamp | Purpose |
|---|---|---|
| 01 · numeric hook A | 0:00 – 0:03 | `2–3 hours.` (cost of one menu by hand). Silent. |
| 02 · numeric hook B | 0:03 – 0:06 | `240 hours / year.` (cost of keeping it in sync). Silent. |
| 03 · wordmark | 0:06 – 0:08 | `Mise` + Opus 4.7 footer. Silent. |
| 04 · closing | 2:55 – 3:00 | Tagline + 4 Opus 4.7 capabilities strip. |

Everything between 0:08 and 2:55 is the live product. See
`docs/demo_script.md` for the per-second shot list of the product
segment (upload → processing → catalog tour → moderation → Try-It →
export). The opening voice-over rides on top of the live `/upload`
recording starting at 0:09 — it is **not** layered over a card.

---

## Editing rules

- **Hard cuts only** at the card seams. A 150 ms dissolve only if a
  hard cut feels jarring.
- The two numeric hooks are silent — no narration, no music. The
  brain reads them in isolation; this is what gives the closing
  callback ("two-to-three hours becomes two-to-three minutes") its
  punch.
- Do not overlay captions on top of the cards. Captions belong on the
  product footage.
- Do not alter the card contents in post — the tagline is the
  tagline. If you want to tweak the wordmark, edit `cards.html` and
  re-export.
