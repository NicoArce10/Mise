# Demo Recording Plan

The shot list lives in `docs/demo_script.md`. This document covers the tooling, resolution, audio approach, and day-of workflow to actually record it.

## Tooling (all free, all cross-platform)

| Purpose | Tool | Why |
|---|---|---|
| Screen capture | **OBS Studio** | Open source, matches the hackathon's open-source rule. High-quality screen capture with scene composition. |
| Editing | **DaVinci Resolve (free)** | Industry-grade free editor. Color, audio, and titling in one tool. Alternative: OpenShot. |
| Typography for title cards | `Fraunces` + `Instrument Serif` + `IBM Plex Sans` | Same stack as the Cockpit. Install locally or embed at export time. |
| Video hosting | **YouTube unlisted** (primary) or **Loom** (backup) | Unlisted YouTube passes async judging without making the video searchable. Loom is a fallback if YouTube processing is slow on submission day. |

Do not use any tool that requires a paid subscription or that watermarks the output.

## Canonical recording spec

| Parameter | Value |
|---|---|
| Resolution (record) | **1920×1080** |
| Resolution (browser viewport when capturing the Cockpit) | **1440×900 logical** (so the hero frame renders at its designed proportions) |
| Frame rate | 30 fps |
| Video codec | H.264 |
| Audio | **No voice-over.** Text captions on screen instead. |
| Target length | **2:45** (15-second buffer under the 3:00 hard cap) |
| Aspect ratio | 16:9 |

### Why no voice-over
- Async judging — judges may watch muted
- No accent or regional-sound concerns
- Captions are always on, always legible, always reproducible
- Saves a whole day of audio recording, re-recording, and noise cleanup

Captions are set in Fraunces 500 at 40–56px, color `ink`, with a subtle `paper-tint` background band when placed over busy content.

## Scene setup in OBS

Create one scene per beat from `docs/demo_script.md`. Having scenes, not one long capture, lets you re-record a single beat without redoing the whole video.

| Scene | Source |
|---|---|
| 00 — Hero frame | Browser window at 1440×900 showing the Cockpit in "Present" mode |
| 01 — Problem cards | Image source displaying pre-rendered cards from Figma export |
| 02 — Upload | Browser window, Upload view |
| 03 — Processing | Browser window, Processing view |
| 04 — Cockpit (Margherita beat) | Browser window, Cockpit with Margherita card focused |
| 05 — Cockpit (Funghi beat) | Browser window, two dish cards side by side |
| 06 — Cockpit (burrata modifier beat) | Browser window, modifier chip zoomed |
| 07 — Cockpit (ephemeral beat) | Browser window, ephemeral lane |
| 08 — Metrics pane | Browser window, metrics pane |
| 09 — Why Opus 4.7 closing | Image source, three-line closing card |

Use the "Studio Mode" feature in OBS to line up the next scene before cutting to it.

## Takes strategy

For every scene, capture at least **two clean takes**. A clean take is:
- No console errors visible
- No cursor accidents
- Timing within ±10% of the shot list

Store takes in `takes/raw/YYYY-MM-DD/<scene-id>/take-N.mp4`, gitignored.

## Editing workflow (DaVinci Resolve)

1. Import all takes, organize by scene in a bin.
2. Assemble in order using the shot list from `docs/demo_script.md`.
3. Use a single cross-fade (120ms) only where adjacent scenes would otherwise jump cut awkwardly. Default is a hard cut.
4. Titles and captions use a fixed set of three templates (hero title, scene caption, closing card). Do not improvise more.
5. Audio: one soft ambient bed track, royalty-free, from a source that permits commercial use (e.g., Pixabay Music, Kevin MacLeod's Incompetech with attribution). Keep it below -24 LUFS so captions dominate.
6. Color: no grading. Keep the browser capture as-is.
7. Export as **H.264 MP4, 1920×1080, 30 fps, 8 Mbps**. Target file size under 150 MB.

## Day-of workflow (Sunday April 26)

Pre-recording checklist:
- [ ] `python evals/run_eval.py --bundle all --out evals/reports/submission.json` succeeds
- [ ] `submissions/metrics.json` is populated from the report
- [ ] Browser windows cleared of bookmarks and tabs bar customized to minimum
- [ ] Cockpit running against real backend with real Opus 4.7 responses
- [ ] OS notifications muted (Focus Mode / Do Not Disturb)
- [ ] Browser zoom at 100%
- [ ] Scaling / DPI at 100% (Windows Display Settings)

Recording order:
1. Scene 00 (hero frame) — **shoot first, 3 takes minimum**. This is the single most important frame in the submission.
2. Scenes 04–07 (four demo-critical decisions) — shoot next, they reuse the same Cockpit state.
3. Scene 08 (metrics pane) — ensure it shows the numbers from `submissions/metrics.json`.
4. Scenes 02, 03, 01, 09 — shoot last, they are short and do not depend on app state.

Post-recording checklist:
- [ ] All captions proofread (misspellings in captions are lethal for judging)
- [ ] Timing is 2:45 ± 10 seconds
- [ ] Every number on screen matches `submissions/metrics.json` exactly
- [ ] No prior-product references appear anywhere
- [ ] No dev tools, localhost URLs, or error toasts visible
- [ ] Export plays back cleanly in VLC (catches codec issues that some browsers hide)

## Upload and link

1. Upload to YouTube as **unlisted**. Title: `Mise — trust layer for dish-level menu data`.
2. Copy the URL into `submissions/README.md`.
3. Do not click "Publish" in the public sense — unlisted only.
4. Keep the raw `.mp4` locally; do not commit it. The repo links to the hosted URL.

## Failure modes and mitigation

| Failure | Mitigation |
|---|---|
| OBS crashes mid-record | Use OBS recording recovery (auto-save on close). Keep intermediate recordings per scene to cap the damage to one scene at a time. |
| Opus 4.7 API rate limits during a capture | Record the real run once early Saturday. On Sunday, re-play the saved state rather than re-hitting the API during the capture. |
| A Cockpit UI glitch appears in one scene | Re-capture that scene only. Do not re-edit the entire timeline. |
| YouTube processing is stuck | Upload to Loom as a backup and swap the URL. |
| Final length exceeds 3:00 | Tighten scenes 02 and 03 first (they are the most compressible). Then shorten scene 08 metrics. Do not cut the hero frame. |
