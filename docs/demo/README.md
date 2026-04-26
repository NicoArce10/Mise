# Demo assets — how to use

The demo is **about 86 % live screen recording of the real product** and
**~19 seconds of cards** (0:00–0:10 hooks · 0:27–0:42 wall + wordmark ·
3:32–3:38 closing). Everything outside those windows is Mise on camera.

Two files live here:

- `cards.html` — standalone 5-card HTML rendered in the product's own
  type system. Cards 01 + 02 carry the numeric hook, card 02b is the
  three-line "wall" (DoorDash · Veryfi · everyone else, stagger-revealed),
  card 03 is the wordmark, card 04 is the closing.
- `export-cards.mjs` — optional Node script to batch-export the cards
  as 1920 × 1080 PNGs using Playwright.

---

## Option A — Manual capture (3 minutes · zero dependencies)

Recommended. Produces four PNGs that drop directly into CapCut.

1. Open `cards.html` in **Chrome** (or Edge).
2. Press `F` to go full-screen.
3. Press `H` to hide the HUD at the bottom-right.
4. Capture each card with **Win + Shift + S** → "Full-screen snip".
5. Save as `card-01.png`, `card-02.png`, `card-02b.png`, `card-03.png`,
   `card-04.png`. **For card 02b** capture three frames: one when only
   the first line is visible (`card-02b-1.png`), one when the first two
   are visible (`card-02b-2.png`), and one with all three (`card-02b-3.png`).
   You will sequence them in Clipchamp to drive the stagger reveal.
6. Navigate with `←` / `→` or press `1` / `2` / `3` / `4` / `5` (1 = hook A,
   2 = hook B, 3 = wall, 4 = wordmark Mise, 5 = closing).

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
| 01 · numeric hook A | 0:00 – 0:03 | `2–3 hours.` (cost of one menu by hand). **No voice yet** — only SFX in post (tick + thump + ambient pad at ~12 % volume). The brain reads the number. |
| 02 · numeric hook B | 0:03 – 0:10 | `Hundreds of hours.` (a year, per restaurant — one menu in sync across every channel). Voice starts here. Source: [Nutrislice](https://blog.nutrislice.com/why-manual-menu-updates-are-costing-you-time) — *"hundreds of lost hours annually"*. |
| 02b · the wall | **0:27 – 0:38 — three lines, stagger-revealed** | `DoorDash built it for themselves.` · `Veryfi sells lines.` · `Everyone else: by hand.` Each line fades in (800 ms) on its own, synced with the narrator naming each player (0:27 · 0:31 · 0:34). Synthesis lower-thirds, **not** speech subtitles — the lines paraphrase the voice-over in three crisp beats. Card holds in full until 0:38, then fades into the wordmark. |
| 03 · wordmark | **0:38 – 0:42 — synced with voice** | `Mise` + Opus 4.7 footer. The card fades in **exactly** as the narrator says *"So I built Mise"*. Cupertino-style reveal: visual name and verbal name land together, with a soft piano sting in post. The callback *"… One menu. One file. Done."* lands while the wordmark is still 100 % opaque, before the fade-out at 0:42. |
| 04 · closing | 3:32 – 3:38 | Single tagline (*"The menu-import layer that didn't exist."*) + Opus 4.7 attribution. **No buzzword strip** — the close is humanly stated, not enumerated. |

Everything between 0:11 and 3:32, except the wall reveal at 0:27–0:38
and the wordmark reveal at 0:38–0:42, is the live product. The
narrator (builder Nicolás Arce) introduces himself in Phase 2 —
between 0:11 and 0:27, while dragging the menu into the dropzone —
to satisfy the *"Built FROM what you know"* judging axis without
spending the opening seconds on a face-cam. The 0:27 – 0:38 wall
card names DoorDash and Veryfi explicitly to anticipate the
*"hasn't this been done?"* objection inside the video itself,
instead of leaving it to comments — and breaks up an otherwise
static 27-second stretch on the upload screen. The 0:38 – 0:42
wordmark reveal lands the product name at the dramatic peak of
the competitive beat.

The recording-day source of truth (cards → upload → processing →
Cockpit → Try-It → export, with the full voice-over and the design
rationale behind every beat) is kept private to the builder's
workflow and is not part of the public deliverable. The output of
that workflow is the submission video itself.

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
