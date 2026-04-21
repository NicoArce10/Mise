# Mise Demo Script

## Constraints
- Hard limit: 3 minutes
- Asynchronous judging — must be understandable without live narration
- No references to any prior product
- All visible assets created or licensed for the hackathon

## The single most important frame

**Opening shot. Fixed. Do not redesign during editing.**

Split-screen hero composition, held for 6 to 8 seconds, with voice-over.

| Side | Content |
|---|---|
| Left | Three messy evidence artifacts tiled together: a PDF menu with the typo "Marghertia", a chalkboard photo with handwritten specials, and an Instagram post of a daily dish |
| Right | One canonical dish card for "Margherita" showing: aliases (including "Marghertia"), three provenance links pointing back to each left-side artifact, a confidence score, and a one-line decision summary |

**Signature phrase on screen and in voice-over:**

> Three messy sources in. One trustworthy dish record out.

**Secondary phrase for the written summary and thumbnail:**

> What used to require manual catalog operations becomes a reviewable canonical dish pack in minutes.

This frame exists to give the judges one thing they remember after closing the video. Everything else in the script supports it.

## Shot list (3:00)

### 0:00 — 0:10  Hero frame
Described above. Tagline appears in the last 2 seconds.

### 0:10 — 0:25  Problem framing
Plain-text cards on neutral background. No stock imagery.

- "Dish identity fragments across PDFs, photos, chalkboards, posts, branches, typos, and modifiers."
- "When identity breaks, catalogs break. Search breaks. Analytics split across duplicates."
- "Mise is the trust layer that decides when evidence refers to the same dish, and tells you why."

### 0:25 — 0:55  Upload view
Screen recording of the actual Upload view.
1. Drag three files from Bundle 01 Italian into the drop zone
2. A fourth file (the modifiers chalkboard from Bundle 02) dragged in as an intentional ambiguous case
3. Click "Start reconciliation"

On-screen caption when ingestion begins:
> Opus 4.7 reads images and PDFs directly. No external OCR.

### 0:55 — 1:20  Processing view
Show the processing view progressing through its stages: ingestion, extraction, reconciliation, routing. Each stage briefly highlighted.

On-screen caption overlaid on the reconciliation stage:
> Adaptive thinking is invoked only on ambiguous pairs.

This is where the Opus 4.7 pillar becomes visible without showing raw thinking.

### 1:20 — 2:20  Review Cockpit — the four demo-critical decisions
One decision per ~15-second beat. Each beat zooms into a canonical dish card and surfaces its decision summary.

1. **Marghertia → Margherita.** Card shows the normalized name and the alias. Summary text: *"Merged because name matched after typo normalization and ingredients matched across two branches."*
2. **Pizza Funghi vs Calzone Funghi stay separate.** Two distinct cards side by side. Summary on the Calzone card: *"Not merged with Pizza Funghi because dish type differs despite ingredient overlap."*
3. **add burrata +3 routed as modifier.** Modifier chip shown under the Margherita card. Summary: *"Routed as modifier because it has a relative price and no standalone dish body."*
4. **Chef's special routed as ephemeral.** A distinct "Ephemeral" lane in the cockpit. Summary: *"Routed as ephemeral because no stable name across sources and no fixed price."*

For each beat, Approve / Edit / Reject buttons are visible on the card. Human-in-the-loop is shown, not just described.

### 2:20 — 2:40  Metrics pane
A dedicated cockpit pane shows the measured metrics from the eval harness for this run.

- Sources ingested
- Canonical dishes produced
- Modifiers routed
- Ephemerals routed
- Merge precision and non-merge accuracy from the eval harness
- Time to review pack

**Rule:** every number on screen is produced by `evals/run_eval.py`. No invented numbers.

### 2:40 — 3:00  Why Opus 4.7
Three on-screen lines, one after the other, with a short voice-over.

1. Vision-native ingestion removes a whole pipeline layer.
2. Adaptive thinking handles ambiguous reconciliations that rules cannot.
3. Structured outputs are validated deterministically, so reasoning and safety are separated.

Final card holds the hero frame composition again for the last 2 seconds, with the tagline.

## Anti-demo safeguards

The core product runs live during the recording, but the video is edited from recorded takes to avoid live-model failures on submission night.

- Every beat is captured in at least two clean takes
- A fallback take of Bundle 01 running end-to-end is kept as a cut-in if a live beat regresses during the final edit
- No beat depends on a network call happening at a specific second — recordings are edited, not live-streamed

## What is explicitly excluded from the demo
- Managed Agents — optional, outside the MVP critical path per the rules
- Any mention of prior products
- Real restaurant names, logos, or menus
- Any number not produced by `evals/run_eval.py`
- Raw model thinking traces in the UI

## Deliverables produced from this script
- `submissions/demo.mp4` — final rendered video, max 3:00
- `submissions/hero_frame.png` — still export of the opening shot for the written summary and README header
- `submissions/metrics.json` — copy of the eval report corresponding to the run shown in the metrics pane
