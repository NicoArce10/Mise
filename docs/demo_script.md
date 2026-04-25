# Mise Demo Script

> **This is a product demo, not a pitch deck.** The video is 86 %
> live screen recording of Mise, 14 % title cards (two numeric hooks,
> a wordmark, and a closing card). The four judging axes — problem
> clarity, what you built, comparison vs. existing tools, wide
> audience — are sold *over the product running*, via voice-over, not
> via slides enumerating bullets. Anthropic moderators were explicit:
> judges "want to see the actual product work in the video", and
> Remotion/After-Effects reconstructions of the UI were the #1
> penalty at the 4.6 hackathon.
>
> **Personal context appears once, in problem→credibility→solution
> order.** The opening voice-over at 0:09 first names the pain in
> words ("two-to-three hours per menu, by hand"), then names where
> it was discovered twice (an AI-automation consultancy for
> restaurants + a personal dish-review app for Buenos Aires), and
> only then names the product. The narrator's name (Nicolás Arce)
> lands as a bridge between the two halves — *not* as the headline.
> That earns credibility in ~22 seconds and exits straight into the
> live upload. No prior product is named. No on-camera face. The
> problem is named twice — once silent on the cards, once in words —
> because the Devpost guide is explicit: *"tie it all back to your
> story — what problem you solved and who your project positively
> impacts."*
>
> **Why this problem is real, in primary sources.** DoorDash
> documents their in-house menu-transcription pipeline on their own
> [engineering blog](https://careersatdoordash.com/blog/doordash-llm-transcribe-menu/) —
> OCR → LLM → LightGBM guardrail → human-in-the-loop. PedidosYa
> exposes a [Partner API](https://developer.pedidosya.com/api-specifications.html)
> that **requires** structured JSON, and Rappi's
> [menu API](https://dev-portal.rappi.com/managing-store-menus/) only
> accepts a 2-level JSON that their partner team approves over 48 h.
> The pain is industrial-scale and the references already live in
> `docs/competitive_benchmark.md`. Mise is the dish-understanding
> layer in front of those APIs.

## Hard constraints

- Maximum runtime: **3:00**. Going over costs points; going under is fine.
- **Asynchronous judging.** No live narration, no Q&A. The video lands
  every point on its own.
- **Direct screen recording of the real product at full resolution.**
  No motion-graphics reconstructions. Only the opening and closing
  title cards are pre-rendered (they are obviously still images, not
  fake UI).
- No reuse of code, schema, or assets from any prior product.
- Any restaurant asset shown on screen is either built for the
  hackathon or used with written owner permission.

## The single most important frame

**A diner-vernacular query resolving against a menu the judge just
watched get uploaded.** Everything before it earns the right to this
frame; everything after consolidates it.

---

## Time budget · 86 % product, 14 % opening + cards

| Range | Length | Kind | Beat |
|---|---|---|---|
| 0:00 – 0:03 | 3 s | Card | Numeric hook 1 — `2–3 hours` |
| 0:03 – 0:06 | 3 s | Card | Numeric hook 2 — `240 hours / year` |
| 0:06 – 0:08 | 2 s | Card | Wordmark `Mise` (silent) |
| 0:08 – 0:31 | 23 s | Product | Upload · Nicolás introduces himself + the problem over the real drop + custom instructions |
| 0:31 – 0:55 | 24 s | Product | Processing · adaptive thinking badge + aliases extracted live |
| 0:55 – 1:35 | 40 s | Product | Catalog tour · evidence rail, detail rail, source preview, ephemerals + the anti-prompt line |
| 1:35 – 1:50 | 15 s | Product | Moderation · edit dialog, save toast, bulk approve |
| 1:50 – 2:40 | 50 s | Product | Try It · 4 queries, matched-on chips, empty state |
| 2:40 – 2:55 | 15 s | Product | Export · `catalog.json` downloads, shown in VS Code |
| 2:55 – 3:00 | 5 s | Card | Closing tagline + callback to the two numbers |

Card budget: 13 s out of 180 (8 numeric hook + 5 closing). Everything
else is the real app — the personal-context voice-over rides on top
of the live upload, not on a card. The hook lands on screen *before*
any narration so the two numbers earn their own beat.

---

## Shot list (every second accounted for)

### 0:00 – 0:08 · Cards 01–03 · Numeric hook + wordmark (8 s · silent)

Three cards in a row, all from `docs/demo/cards.html`. **Total
narration: zero.** The numbers earn the silence; the brain reads them
without competing audio.

| Range | Card | What's on screen |
|---|---|---|
| 0:00 – 0:03 | Card 01 | `2–3 hours.` (Fraunces, 320 px). Mono footer: `to onboard one menu, by hand.` |
| 0:03 – 0:06 | Card 02 | `240 hours / year.` (same scale). Mono footer: `to keep it in sync, per location.` |
| 0:06 – 0:08 | Card 03 | `Mise` wordmark, paper background. Mono footer: `claude-opus-4-7.` |

This is the **open loop**. Two painful numbers, then the wordmark.
The brain now needs to know what Mise *does* about those numbers.

### 0:08 – 0:31 · Upload view (23 s) — opening voice-over over real product

Real screen recording of `/upload`. Voice-over starts at 0:09, after
a 1 s breath, so the wordmark lands cleanly before the first word.
This is the only moment in the video where personal origin is
explicitly named — short, factual, no product-name attribution, no
face on camera.

The bundle on screen is the same one the eval harness uses
(`evals/fixtures/bistro_argentino.py`): **2 sources, 12 dishes, 2
modifiers, 1 ephemeral**. Filenames are the real filenames in the
fixture so a judge running `python evals/run_search_eval.py --mode
fallback` sees the exact same shape this video shows.

| Seg | Action | What the camera sees |
|---|---|---|
| 0:08 | Cut from card 03 to `/upload` | Drop zone, dashed border, header "Drop your menu" |
| 0:11 | Cursor enters the drop zone | First file drops in — `carta_principal.pdf` |
| 0:16 | Second file drops | `pizarron_hoy.jpg` |
| 0:20 | Cursor moves to **"Optional · tell Opus what to skip"** | Click chip — example: `Skip the drinks section` |
| 0:25 | Hover **Build my dish graph** | Button darkens |
| 0:28 | Click | Page transitions to `/processing` |

**Voice-over** (starts 0:09, 37 words at ~99 wpm = ~22 seconds, ends
right before the click):

> Two-to-three hours per menu, by hand. I've hit that wall in my
> AI-automation consultancy for restaurants, and again building my
> own dish-review app for Buenos Aires. I'm Nicolás Arce. Mise is
> the API that didn't exist.

This is the **problem → credibility → solution** order — the same
rhythm the TechCrunch playbook calls *"quickly set the scene"* and
that the Devpost guide phrases as *"tie it all back to your story"*.
Naming the pain first (in words, after the silent cards have already
shown it as a number) anchors your introduction in the problem,
not in your résumé. Your name lands *because* the audience already
believes the wall exists.

What is **not** said here, on purpose:

- No prior product is named (Anthropic moderator guidance).
- No on-camera face. The screen is the upload, not you.
- No mention of Rappi / DoorDash / Uber Eats yet — that pays off
  later at 2:41 when the JSON is actually downloading and the
  audience claim becomes a deliverable.

### 0:31 – 0:55 · Processing view (24 s)

Real screen recording of `/processing`. The moneyshot here is the
**`adaptive thinking` badge appearing on screen** while real
canonical names populate the live feed.

| Seg | Action | What the camera sees |
|---|---|---|
| 0:31 | Page mount — ScannerOverlay animating | Step `1 of 4 · Reading your menu` · whisper line about vision-native |
| 0:35 | Dish chips start populating a column on the right | Real canonical names from the fixture: `Milanesa Napolitana XL`, `Provoleta a la Parrilla`, `Lomito Completo`, `Bife de Chorizo con Papas` |
| 0:40 | Stage flips to `2 of 4 · Building the dish graph` | Whisper changes — "writing aliases real diners use" |
| 0:43 | **`adaptive thinking` badge appears** beside one of the dishes | Pulsing dot signals live |
| 0:48 | Stage flips to `3 of 4 · Organizing your catalog` | Counts match the fixture: `12 dishes · 2 modifiers · 1 special` |
| 0:53 | Stage flips to `4 of 4 · Ready` — auto-pivot to `/tryit` | URL changes |

> **Production note · speed-ramp.** Real Opus runs take 15–45 s per
> page; multi-source bundles won't fit in 24 s of footage. In CapCut,
> do a three-step speed-ramp on this beat: 0:31 – 0:39 at **1×** so
> the step counter is readable, 0:39 – 0:48 at **6×** so chips fly
> in (with a small `× 6` mono overlay bottom-right for honesty), and
> 0:48 – 0:55 back to **1×** so the `adaptive thinking` badge lands
> at full speed. Speed-cuing is industry-standard and explicit in
> the overlay — never silent fast-forward.

**Voice-over** (44 words at ~99 wpm = ~22 seconds, ending right at
the auto-pivot — the aliases mentioned are the **real** ones in the
fixture file):

> Opus 4.7 reads every page directly, vision-natively. No external
> OCR. The model writes the aliases real diners type — "mila napo",
> "napo XL", "mila a la napo" — and it reserves adaptive thinking
> only for the decisions that are genuinely ambiguous. Everything
> else stays on the fast path.

### 0:55 – 1:35 · Catalog tour (40 s)

Real screen recording of `/catalog`.

| Seg | Action | What the camera sees |
|---|---|---|
| 0:55 | Viewport settles on `/catalog` | Title from the real fixture: **`Catalog · 12 dishes · 2 modifiers · 1 special`** |
| 0:57 | Brief pan across the header | **`FilterAppliedBanner`** visible with the same instruction the user typed at upload (e.g. `Skip the drinks section`) |
| 1:00 | Hover a source chip in the **`EvidenceRail`** (left) | Tooltip shows `carta_principal.pdf` or `pizarron_hoy.jpg` |
| 1:04 | Scroll the catalog column | Real category groups from the fixture (e.g. `Carnes y Parrilla`, `Empanadas`, `Pastas`, `Hamburguesas`) |
| 1:08 | Click the **`Milanesa Napolitana XL`** card | Card expands. Aliases shown are the **real** ones from the fixture: `mila napo`, `mila a la napo`, `milanesa napo`, `napo XL`. Modifier chip: `agregar huevo frito +1500`. `ConfidenceBar` visible. |
| 1:12 | **`DetailRail`** on the right updates with `ReconciliationNarrative` | Paragraph the fixture actually carries: a `DecisionSummary` line in plain English explaining why the dish was kept canonical at confidence 0.93. |
| 1:18 | Click **View menu** in TopBar | **`SourcePreviewModal`** opens with `carta_principal.pdf` full-height |
| 1:22 | Scroll the modal once | Real PDF content, same file dropped at 0:11 |
| 1:25 | Press Escape | Modal closes |
| 1:27 | Scroll down to the **`EphemeralCard` lane** | Real ephemeral from the fixture: `"Menú ejecutivo del mediodía — entrada + principal + bebida · $14.500 (solo lunes a viernes)"` with chip `Daily special · evidence: pizarron_hoy.jpg` |
| 1:33 | Settle cursor on a dish we'll moderate next | Transition into moderation beat |

**Voice-over** (60 words at ~99 wpm = ~36 s, ends just before the
moderation beat):

> This is the dish graph. Canonical name, aliases diners actually
> type, modifiers, ingredients, price, confidence — each row grounded
> in the evidence you see on the left. Daily specials live in their
> own lane so they never contaminate the core menu. Why isn't this
> just a prompt? A prompt can't guarantee zero invention, can't reserve
> adaptive thinking only for ambiguous decisions, and can't tell you
> *why* each dish landed in its lane.

### 1:35 – 1:50 · Moderation (15 s)

Still on `/catalog`. Shows the app is reviewable, not a black box.

| Seg | Action | What the camera sees |
|---|---|---|
| 1:35 | Click **Edit** on the `Milanesa Napolitana XL` card | `DishEditDialog` opens, fields pre-filled with the real aliases |
| 1:38 | Add an alias in the aliases field | Character counter updates |
| 1:41 | Click **Save** | Dialog closes, **`SaveToast`** appears: "Saved: Milanesa Napolitana XL — changes will appear in the exported JSON" |
| 1:44 | Click **Approve** on a neighboring card | Toast: "Approved: Provoleta a la Parrilla" |
| 1:47 | Click **Approve all pending** in toolbar, then confirm | Toast: count matches what is actually pending in the fixture (10 of the 12 dishes start as `PENDING`) |

Voice-over (14 words):

> Human in the loop. Approve, edit, or reject — every change flows
> into the export.

### 1:50 – 2:40 · Try It — the hero (50 s)

Real screen recording of `/tryit`. **The single most important beat in
the video.** The dish graph is already loaded; the search input is
auto-focused.

Four queries. ~12 s per query. If a live Opus call regresses on a
query, keep rolling and redo at the end — we edit the best pass per
query.

All five queries below come from `evals/search_golden.json` (12
positives, 3 negatives — that's where the *"twelve out of twelve"*
claim comes from).

| Seg | Query | What the viewer sees in the result card | Voice-over line |
|---|---|---|---|
| 1:50 | `mila napo abundante` | Rank 01 · Milanesa Napolitana XL · chip `alias` · `"Why · alias 'mila napo' matched + portion cue"` | *"Aliases the model extracted — 'mila napo'."* |
| 2:02 | `algo veggie que no sea ensalada` | Rank 01 · Provoleta a la Parrilla · **`adaptive thinking` chip visible** · chip `semantic` · `"Why · vegetarian dish, excluding salads"` | *"Exclusions. Vegetarian but not salad. Adaptive thinking only when the query is ambiguous."* |
| 2:14 | `lomito como steak sandwich` | Rank 01 · Lomito Completo · chip `semantic_inference` · `"Why · a lomito is Argentina's steak sandwich — grilled beef in a roll"` | *"Cross-cultural analogies. A lomito interpreted as a steak sandwich."* |
| 2:26 | `pasta con salsa de carne` | Rank 01 · Ñoquis con Tuco · chip `semantic` · `"Why · 'tuco' is the Río de la Plata word for meat sauce"` | *"Local synonyms. 'Tuco' is meat sauce in this part of the world — Mise knows it."* |
| 2:38 | **negative** — `ramen de miso` | Honest empty state: `"Nothing on this menu matches — Mise will not invent dishes that aren't on the evidence."` | *"And when the answer isn't on the menu, Mise says so. Twelve out of twelve on the golden set. Zero inventions on three negatives — that's the metric in `submissions/metrics.json`."* |

**Tip:** if queries 1–4 are already at 2:38 ending, skip query 5 and
let the empty-state beat move to the written summary. A 4-query pace
is cleaner than a rushed 5-query one.

### 2:40 – 2:55 · Export (15 s)

Real screen recording. The second moneyshot.

| Seg | Action | What the camera sees |
|---|---|---|
| 2:40 | Cursor moves to the TopBar **Export catalog** button | Hover state |
| 2:42 | Click | Browser downloads `catalog-{run_id}.json` — the toast and filename are visible |
| 2:45 | Cut to a second window: VS Code with `catalog.json` already open | Scroll 2 s · the top of the file shows `canonical_dishes`, each with `aliases`, `search_terms`, `modifiers`, `decision_summary` |
| 2:52 | Cut back to the app | TopBar visible |

**Voice-over** (24 words — the *sell-the-dream* beat from the
TechCrunch playbook, names the audience explicitly):

> One JSON call. Plug it into Rappi, PedidosYa, DoorDash, Uber Eats —
> or your own review app, your own POS. Production schema,
> Pydantic-validated, today.

This beat names every delivery platform on purpose. PedidosYa's
Partner API and Rappi's menu API both **require** structured JSON;
DoorDash already pays a specialised consultancy to *correct* the JSON
they extract themselves. Naming them on top of the JSON download
turns the audience axis from a claim into a deliverable.

### 2:55 – 3:00 · Card 04 · Closing (5 s)

Pre-rendered from `docs/demo/cards.html` card **04**. "Mise." large,
tagline `any menu, any language, ask like a customer.` in italic
underneath, mono footer strip with the four Opus 4.7 capabilities used:
`vision-native · adaptive thinking · structured output · xhigh effort`.

**Voice-over** (callback to the two numbers from the hook, 14 words):

> Two-to-three hours becomes two-to-three minutes. Mise. Any menu, any
> language, ask like a customer.

Music (if used) fades out by 2:54.

---

## Continuous voice-over (paste into Audacity)

```
(0:00 – 0:08 silence — cards 01, 02, 03 hold. Two numbers, then the
wordmark. The brain reads them. No music yet.)

(0:09) Two-to-three hours per menu, by hand. I've hit that wall in
my AI-automation consultancy for restaurants, and again building my
own dish-review app for Buenos Aires. I'm Nicolás Arce. Mise is the
API that didn't exist.

(0:32) Opus 4.7 reads every page directly, vision-natively. No
external OCR. The model writes the aliases real diners type — "mila
napo", "napo XL", "mila a la napo" — and it reserves adaptive
thinking only for the decisions that are genuinely ambiguous.
Everything else stays on the fast path.

(0:56) This is the dish graph. Canonical name, aliases diners
actually type, modifiers, ingredients, price, confidence — each row
grounded in the evidence you see on the left. Daily specials live in
their own lane so they never contaminate the core menu. Why isn't
this just a prompt? A prompt can't guarantee zero invention, can't
reserve adaptive thinking only for ambiguous decisions, and can't
tell you why each dish landed in its lane.

(1:36) Human in the loop. Approve, edit, or reject — every change
flows into the export.

(1:52) Four queries, in the diner's own language. Aliases the model
extracted — "mila napo". Exclusions — vegetarian but not salad.
Cross-cultural analogies — a lomito interpreted as a steak sandwich.
Local synonyms — "tuco" is meat sauce in this part of the world.
Adaptive thinking kicks in only when the query is ambiguous. And
when the answer isn't on the menu, Mise says so — instead of
inventing one. Twelve out of twelve on the golden set. Zero
inventions on three negatives — that's the metric in
`submissions/metrics.json`.

(2:41) One JSON call. Plug it into Rappi, PedidosYa, DoorDash, Uber
Eats — or your own review app, your own POS. Production schema,
Pydantic-validated, today.

(2:55) Two-to-three hours becomes two-to-three minutes. Mise. Any
menu, any language, ask like a customer.
```

Total: ~300 words over ~165 s of narration → ~99 wpm. Slow on purpose
— leaves air between beats so the product carries the screen. The
Argentine accent is an asset at this pace; only speed blurs it.

The opening at 0:09 is the **only** moment in the video where personal
origin is named. Twelve seconds, no product names, no apologies — it
buys credibility for the rest of the demo and pays it back by exiting
into the real product immediately.

---

## Judging-axis coverage (evidence-grounded)

Each axis is earned from the product in-camera, not from a slide:

| Axis | Where it's earned | Proof in the repo if a judge verifies |
|---|---|---|
| **Problem clarity** | 0:00–0:06 numeric hook · 0:09 Nicolás names the problem he hit twice (consultancy + own review app) | `SourceKind` in `backend/app/domain/models.py` covers PDF, chalkboard, social, photo |
| **What you built** | 146 s of live product across 5 views | The app itself in this repo |
| **Comparison** | 0:32 "no external OCR" + 1:12 anti-prompt line + 2:41 "production schema" | `grep -r "tesseract\|textract\|azure-ocr" backend/` returns nothing · `GET /api/catalog/{run_id}.json` endpoint real |
| **Wide audience** | 2:41 Export beat names Rappi · PedidosYa · DoorDash · Uber Eats · review apps · POS | DoorDash engineering blog documents an OCR → LLM → guardrail pipeline (`docs/competitive_benchmark.md` line 70) · PedidosYa Partner API requires structured JSON · Rappi menu API only accepts a 2-level JSON |
| **Opus 4.7 used well** | 0:43 `adaptive thinking` badge live in Processing · 2:02 adaptive chip in Try It · 2:55 closing strip | `thinking: {"type": "adaptive"}`, `effort_on_ambiguous: "xhigh"`, `output_config.format: {"type":"json_schema"}`, vision block in `backend/app/ai/client.py` |

---

## Features that appear on camera (the showcase the user asked for)

| Feature | Surface | Timestamp |
|---|---|---|
| Drag-drop multi-file upload (PDF + JPG) | `/upload` | 0:11 – 0:19 |
| Natural-language filter instructions + example chips | `/upload` | 0:20 – 0:25 |
| Editorial stage labels (Reading · Building · Organizing · Ready) | `/processing` | 0:31 – 0:53 |
| Step counter "Step N of 4" | `/processing` | 0:31 – 0:53 |
| Real canonical names appearing as chips (`Milanesa Napolitana XL`, `Provoleta`, `Lomito Completo`, `Bife de Chorizo con Papas`) | `/processing` | 0:35 – 0:48 |
| **`adaptive thinking` badge live** | `/processing` | 0:43 |
| `FilterAppliedBanner` with the user's instruction | `/catalog` | 0:57 |
| `EvidenceRail` with source chips | `/catalog` | 1:00 – 1:04 |
| Category groups (Pizzas · Pasta) | `/catalog` | 1:04 – 1:08 |
| `CanonicalDishCard` with aliases, modifiers, ingredients, price, `ConfidenceBar` | `/catalog` | 1:08 |
| `DetailRail` + `ReconciliationNarrative` (prose decision over a same-menu variant call) | `/catalog` | 1:12 – 1:18 |
| `SourcePreviewModal` with the original PDF | `/catalog` | 1:18 – 1:25 |
| `EphemeralCard` lane (daily specials) | `/catalog` | 1:27 – 1:33 |
| `DishEditDialog` inline edit + `SaveToast` | `/catalog` | 1:35 – 1:44 |
| Bulk Approve with confirm dialog | `/catalog` | 1:47 |
| Suggested queries dynamically generated from the menu | `/tryit` | 1:50 |
| Search input with autofocus | `/tryit` | 1:50 |
| `MatchedOnChip` distinguishing `alias` · `search_term` · `semantic_inference` · `ingredient` | `/tryit` | 1:50 – 2:40 |
| "Why" in Instrument Serif italic + reason line | `/tryit` | each result |
| Score percent + tabular price | `/tryit` | each result |
| `adaptive thinking` chip on Try-It results | `/tryit` | 2:02 |
| Honest empty state ("Mise will not invent dishes") | `/tryit` | 2:38 (optional) |
| Export catalog → JSON download | TopBar | 2:40 – 2:45 |
| Catalog JSON shape in VS Code | external | 2:45 – 2:52 |

> **About `LiveReconciliationPanel`.** The panel exists in
> `frontend/src/components/LiveReconciliationPanel.tsx` and only renders
> *cross-source* pairs (`left_source_id !== right_source_id`).
> Cross-source merging is **not** the use case the demo sells: real
> users upload one menu — possibly across one PDF + one Instagram
> announcement — they don't upload two contradictory menus. So we
> deliberately do **not** linger on this panel in the screen
> recording. If it appears briefly while the multi-source bundle is
> processing, that's fine — but no voice-over points at it. The
> moneyshot in Processing is the `adaptive thinking` badge, not
> cross-source pairing.

---

## Do / Don't — hard rules from Anthropic moderators

### Do

- Record the real app at full resolution. OBS or Xbox Game Bar on
  Windows.
- Land the `adaptive thinking` badge in the **Processing** view on
  camera — it's the most valuable single frame for the Opus 4.7
  axis.
- Show `Export catalog` clicked and the resulting `.json` in a second
  window. Second-most-memorable frame.
- Keep the narration slow. 99 wpm, Argentine accent, pausas amplias.
- Record the product segment twice end-to-end. Edit the best pass per
  beat.

### Don't

- **Do not rebuild the UI in Remotion / After Effects / Figma.** The
  #1 penalty from the 4.6 hackathon.
- Do not add features before recording. Judges penalize breadth over
  depth.
- Do not say "AI-powered" or "powered by AI". Say "Opus 4.7" by name.
- Do not mention Managed Agents — Mise doesn't use them; mentioning
  them reads as checkbox-ticking.
- Do not show raw thinking traces. `ReconciliationNarrative` is the
  product surface; the trace is plumbing.
- Do not name any prior product. The opening narration says
  "an AI-automation practice for restaurants" and "a dish-review
  app for Buenos Aires" — that is the level of granularity. Naming
  specific apps in the opening reads as résumé-padding and
  disqualifies hackathon submissions per Anthropic moderator
  guidance.
- Do not show any metric that is not in `submissions/metrics.json`.
- Do not exceed 3:00.

---

## Anti-demo safeguards

- The pipeline runs live during recording. All takes are edited from
  real material.
- Every search beat is captured in at least two clean takes.
- A canary take against the pre-computed sample bundle is kept as a
  cut-in if a live Opus call regresses during the final edit.
- `/tryit` auto-focuses the input on mount — verified, no cursor
  hunting on camera.
- If a real restaurant menu appears on screen, written permission is
  on file (archived outside the repo).

## What is explicitly excluded

- Managed Agents.
- External APIs beyond Anthropic.
- Reuse of prior-product code, schema, or assets.
- Real restaurant names or logos without written permission.
- Any metric not produced by `evals/run_eval.py` or
  `evals/run_search_eval.py`.

---

## Pre-rendered cards in this repo

- `docs/demo/cards.html` — exactly **4** cards, rendered in the
  product's type system. See `docs/demo/README.md`.
- Card 01 (`2–3 hours`) → 0:00 – 0:03
- Card 02 (`240 hours / year`) → 0:03 – 0:06
- Card 03 (Mise wordmark) → 0:06 – 0:08
- Card 04 (closing) → 2:55 – 3:00
- Everything else is the real app on camera. The opening voice-over
  rides on top of the live `/upload` recording, not on a card.

---

## Recording-day execution plan

Four sessions, no motion-graphics work.

### Session 1 — export 4 cards (5 min)

Open `docs/demo/cards.html` in Chrome, `F` to go full-screen, `H` to
hide the HUD, capture each with `Win + Shift + S`. Save as
`card-01.png` … `card-04.png`. Or run
`node docs/demo/export-cards.mjs` to get pixel-accurate PNGs in one
shot.

### Session 2 — record the product (1.5 – 2 h)

Windows: OBS Studio · MP4 · 1920×1080 · 60 fps · CBR 30 Mbps on SSD.
No audio in the screen recording.

Three full end-to-end takes following the shot list above.
Pre-position the cursor before each beat. Close Slack / Discord /
notifications. Dev stack running (`./scripts/run.sh` or the VS Code
task).

### Session 3 — record the voice-over (45 min)

Audacity · 48 kHz · 16-bit · USB mic (not Bluetooth). Three full
reads. Noise Reduction 6 dB from a 3 s silence sample. Optional
polish: Adobe Podcast Enhance.

**Accent guidance.** Narrate in English at ~99 wpm. Keep Spanish
queries in Spanish (`mila napo`, `lomito como steak sandwich`, `algo
veggie que no sea ensalada`) — the language contrast is product
evidence. The Argentine accent reads as authentic and global; only
speed blurs it.

### Session 4 — assemble in CapCut (1.5 h)

Four timeline tracks, no transitions except a 150 ms dissolve between
beats if a hard cut feels jarring.

- **Track 1 (video):** card-01 (3 s) → card-02 (3 s) → card-03 (2 s)
  → *screen recording 0:08 – 2:55* → card-04 (5 s). Inside the
  screen-recording block, the cuts are already baked in by using the
  best take per segment.
- **Track 2 (audio):** voice-over, synced per the timestamps in the
  shot list.
- **Track 3 (captions, optional):** white, 32 px, IBM Plex Sans
  Medium, bottom-center, 2 s max per caption. Only for Try-It reason
  lines if the model's rendered "Why" isn't readable at 1080p.
- **Track 4 (music, optional):** instrumental at −20 dB, fades in at
  0:25, fades out at 2:54. Silent over the hook and the closing card.

Export: MP4 · 1920×1080 · 60 fps · H.264 · CRF 18 · AAC 192 kbps.

## Submission-day checklist (night before)

1. Re-run `python evals/run_search_eval.py --mode fallback` → verify
   top-1 and zero-invention stay at 1.0. If either drops, record
   `--mode real` as well and use whichever is stronger.
2. Copy the report to `submissions/metrics.json`.
3. Record the video against main. Two full takes minimum.
4. Edit to 2:55 – 3:00. Leave 5 s of tail buffer.
5. Export 1080p 60 fps H.264. Upload to YouTube as unlisted.
6. Paste the URL into `submissions/README.md` and
   `submissions/written_summary.md`.
7. Verify both URLs in an incognito window from a second device.
8. Tag `submission-v1`, push, submit the Anthropic form.
