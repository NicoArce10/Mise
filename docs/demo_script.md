# Mise Demo Script

## Constraints
- Hard limit: 3 minutes
- Asynchronous judging — must be understandable without live narration
- No reuse of code, schema, or assets from any prior product
- The builder's personal motivation may appear as narrative framing
- All restaurant assets created for the hackathon or used with explicit written permission (owner menus used locally, not committed)

## The single most important frame

**The star of the demo is a search query in the diner's actual vernacular resolving against a menu the judge just watched get uploaded.**

Personal cold-open (0:00–0:08) followed by the upload → search loop (0:08–2:15) — everything else supports this.

### Cold open — 0:00 to 0:08

Static shot of the builder's desk: a phone with a restaurant chalkboard photo, a printed menu PDF, a notebook with a handwritten dish name. No music for the first beat.

Voice-over, calm, first person, one take:

> I'm building a dish-first review app in beta. Every restaurant I load, I do by hand — because menus live as PDFs and photos, but people ask for food in their own words. So I built Mise.

**Signature line on screen, held for 2 seconds:**

> Any menu. Any language. Ask like a customer.

## Shot list (3:00)

**Budget:** 0:00–0:08 cold open · 0:08–0:18 problem · 0:18–0:42 upload + processing · 0:42–2:20 Try It (the hero) · 2:20–2:40 catalog / provenance · 2:40–3:00 why Opus 4.7. Total: 3:00.

### 0:08 — 0:18  Problem framing
Two plain-text cards on neutral background:

- "Menus arrive as PDFs, chalkboards, and Instagram screenshots."
- "Diners say *mila napo*, *algo veggie que no sea ensalada*, *lomito como steak sandwich*. No catalog indexes any of that."

### 0:18 — 0:42  Upload & processing
Screen recording.

1. Drag a real restaurant menu (the builder's own — a multi-page PDF and a chalkboard photo of the daily specials) into the drop zone.
2. Click **Start**.
3. Processing view runs through extraction with stage captions.

On-screen caption when ingestion begins:
> Opus 4.7 reads PDFs and photos directly. No external OCR.

On-screen caption during extraction:
> The model writes how diners actually ask for each dish — aliases and local search terms, grounded in the evidence.

### 0:42 — 2:20  Try It — the hero
When processing finishes, the UI auto-opens the **Try It** view (not the catalog). The dish graph is loaded silently in the background; the judge sees a clean search field and four suggested queries pulled from the menu that was just extracted.

Four searches, each held ~20 seconds:

| Query | What it proves |
|---|---|
| `mila napo abundante` | Alias resolution — the model extracted "mila napo" as a search term for *Milanesa Napolitana XL*. Match card explains: *alias "mila napo" matched · XL portion on the menu*. |
| `algo veggie que no sea ensalada` | Intent + exclusion. **Adaptive thinking engaged** chip appears. Interpretation line: *"Vegetarian dish excluding salads."* Returns vegetable-based mains that actually exist on the menu. |
| `lomito como steak sandwich` | Cross-cultural analogy. Opus maps the English reference to the Argentine `lomito completo`. Reason: *"Lomito is Argentina's steak sandwich — grilled beef in a roll with toppings."* |
| `algo para compartir tipo tabla` | Size / group constraint. Returns sharing plates or combined platters with a reason citing menu-stated portion size; returns an empty state with a grounded explanation if nothing qualifies. |

On-screen captions during this segment:
> Queries run against the dish graph. The model only returns dishes this restaurant actually serves.

> Adaptive thinking fires only when the query has exclusions, analogies, or multi-constraint intent.

This is where the judge leaves the video thinking *"I have never seen a menu respond like that before."*

### 2:20 — 2:40  Catalog & provenance
Cut to the **Catalog** tab. Briefly hover on one canonical dish to reveal:

- canonical name + aliases + menu category
- source chips (PDF · PHOTO · POST) with a 3-sources count
- confidence score
- one-line decision summary

Caption:
> Every dish carries its source evidence and a confidence score. Low-confidence items are flagged for review — nothing silently disappears.

### 2:40 — 3:00  Why Opus 4.7
Four on-screen lines, one after another, each held ~4 seconds:

1. Vision-native ingestion — PDFs and photos stream directly.
2. A dish graph with aliases and vernacular search terms, written by the model.
3. Natural-language search with adaptive thinking, only when the query is ambiguous.
4. Structured outputs validated by Pydantic before reaching the UI.

Final 2 seconds: hold the tagline.

> Any menu. Any language. Ask like a customer.

## Anti-demo safeguards

The core product runs live during the recording. The video is edited from recorded takes.

- Every search beat is captured in at least two clean takes.
- A fallback take against the pre-computed **sample** bundle is kept as a cut-in if a live Opus call regresses during the final edit.
- The Try It view auto-focuses the input — no cursor hunting on camera.
- If a real restaurant menu is shown on screen, written permission from the owner is on file (WhatsApp screenshot saved outside the repo).

## What is explicitly excluded from the demo
- Managed Agents — out of MVP scope.
- Reuse of code, schema, or assets from any prior product (personal narrative framing is allowed).
- Real restaurant names, logos, or menus without explicit written permission.
- Any number not produced by `evals/run_eval.py`.
- Raw model thinking traces in the UI.

## Deliverables produced from this script
- `submissions/demo.mp4` — final rendered video, max 3:00.
- `submissions/hero_frame.png` — still export of the Try It view with a resolved query.
- `submissions/metrics.json` — eval report corresponding to the run shown in the video.
