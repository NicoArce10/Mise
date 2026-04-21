# Cockpit Visual Direction

Locked aesthetic: **A — Editorial / Cartographic**. Direction chosen against two alternatives (Industrial / Kitchen panel, Soft / Paper-and-ingredients) because it best communicates "enterprise trust layer" and is the hardest for other hackathon teams to replicate with stock components.

Everything below is committed. Do not negotiate these tokens during implementation. If a design question is not answered here, prefer the option that is more restrained.

## Concept in one line
A food atlas rendered by a serious editorial publisher. Authoritative, unhurried, precise. More *The New York Times* food section than *Notion template*.

## Forbidden patterns
- **No Inter, no Roboto, no Arial, no system-ui.** These read as generic AI defaults.
- **No purple-to-blue gradients.** No neon. No glassmorphism.
- **No big rounded blobs.** Radii are small and restrained.
- **No bouncy motion.** No spring-overshoot. No "pop" scale-ups on hover.
- **No dark mode for the MVP.** Pick one theme and execute it perfectly.

## Typography

Font stack, all open-source (SIL Open Font License or equivalent), hosted via the Fontsource packages or `@fontsource/*` imports to avoid third-party requests in the demo.

| Role | Family | Weights used | Notes |
|---|---|---|---|
| Display (hero, H1) | **Fraunces** | 400, 500, 700 + opsz | Use optical sizing. Prefer `wght 500` for H1, `wght 700` only for the hero frame title. |
| Editorial accent (pull quotes, decision summary leads) | **Instrument Serif** | 400 italic | Italic only. Treat as editorial flourish, sparse. |
| Body / UI | **IBM Plex Sans** | 400, 500, 600 | Default body. Has character without being loud. |
| Data / mono (confidence scores, timestamps, provenance IDs) | **IBM Plex Mono** | 400, 500 | All numeric tabular displays use this. Tabular-nums enabled. |

Type scale (px / line-height):
- `display-xl` 72 / 76 — hero frame title only
- `display` 56 / 60 — section hero
- `h1` 40 / 44
- `h2` 28 / 32
- `h3` 22 / 28
- `body` 16 / 24
- `body-sm` 14 / 20
- `caption` 12 / 16 (tracking +0.02em, uppercase for eyebrow labels)
- `mono` 13 / 20

Rules:
- Tracking tightens as size grows. `display-xl` gets `letter-spacing: -0.02em`. `caption` opens to `+0.02em`.
- Tabular figures mandatory in any data display: `font-feature-settings: "tnum" 1;`
- Italics are reserved for `Instrument Serif` pull quotes and for dish aliases inside decision summaries (e.g., *Marghertia*).

## Color palette

Name the tokens, not the hex values. Semantic usage is listed after the table.

| Token | Hex | Usage |
|---|---|---|
| `paper` | `#FBF8F2` | Default background — warm off-white, never pure white |
| `paper-tint` | `#F3EEE3` | Second surface (cards against background) |
| `paper-deep` | `#E9E1CF` | Third surface, quiet emphasis |
| `ink` | `#1C1917` | Primary text, iconography |
| `ink-muted` | `#57534E` | Secondary text |
| `ink-subtle` | `#A8A29E` | Tertiary text, placeholders |
| `hairline` | `#E7E5E1` | 1px dividers, quiet borders |
| `sienna` | `#8B2E23` | Critical / reject / no-merge — the sharp accent |
| `sienna-tint` | `#F2D9D4` | Background for sienna chips |
| `olive` | `#5F6B3F` | Approve / merged — the quiet positive |
| `olive-tint` | `#E4E8D8` | Background for olive chips |
| `ochre` | `#B45309` | Needs review / edit — the caution |
| `ochre-tint` | `#F5E4CC` | Background for ochre chips |
| `gold-leaf` | `#B59046` | High-confidence emphasis, the rare flourish |

Semantic mapping:
- **Merged** (high-confidence canonical): olive chip + `olive` label
- **Not merged** (kept separate on purpose): sienna chip + `sienna` label
- **Modifier**: `paper-deep` chip + `ink-muted` label, italic `Instrument Serif` tag
- **Ephemeral**: `ochre` chip + `ochre` label
- **Needs review**: `ochre` dashed border + `ochre` label
- **High confidence (≥ 0.90)**: confidence number set in `gold-leaf`
- **Low confidence (< 0.70)**: confidence number set in `sienna`

Rule: **dominant paper + ink, accents sparingly**. On any given screen, accent tokens should cover under 8% of the pixel area.

## Spatial system

- 4pt grid. Allowed spacing values: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128`.
- Content max-width: **1200px** centered. Outside that, generous margin, never edge-to-edge.
- Section gutters: `64` on desktop, `24` on mobile.
- Card padding: `24` standard, `32` for hero frame.
- Radii: `2` (chips), `4` (inputs, small cards), `8` (hero frame card only). No radius larger than `8` anywhere.

## Borders and dividers

- 1px solid `hairline` for all quiet separators.
- Cards have a single-pixel `hairline` border — no shadows on standard cards.
- The hero frame canonical dish card uses `atmosphere` shadow (defined below) to lift it. No other element does.

## Shadows

Two allowed shadows. Use sparingly.

- `atmosphere`: `0 24px 48px -24px rgba(28, 25, 23, 0.12), 0 2px 4px -1px rgba(28, 25, 23, 0.04)` — reserved for the canonical dish card in the hero frame and for modal dialogs.
- `hover-lift`: `0 6px 16px -6px rgba(28, 25, 23, 0.10)` — only applied when actively hovering a card in the review lane.

## Motion

- Page load: staggered reveal of major sections. Stagger `40ms`, per-element duration `320ms`, easing `cubic-bezier(0.22, 0.61, 0.36, 1)`.
- Hover: hairline color shift from `hairline` to `ink-muted` over `180ms`. No transforms.
- Approve / Reject / Edit: the chip swaps color with a `120ms` fade, no movement.
- No infinite animations. No pulsing. No skeleton shimmer — prefer a static "Processing — reading evidence" placeholder card with a fixed slow pulse of the hairline border (3s period, 10% opacity range).

## Iconography

- Thin, 1.5px stroke. **Lucide Icons** as the base library, but override each icon used at least once with a custom tweak (stroke cap, terminus) so the set does not look stock.
- No emoji anywhere in the product UI. (Allowed in commit messages if humans want them; the codebase avoids them per user rules.)

## Key components — visual contracts

### Canonical dish card (the hero frame right-side element)
- Size: 520px wide desktop, full-width mobile
- Structure top-to-bottom: dish name (display, Fraunces 500), aliases row (Plex Sans sm, italic for typo'd aliases in Instrument Serif), provenance strip (Plex Mono 13, arrows to source thumbnails), decision summary (body, 3 lines max, wrapped at 56ch), confidence row (Plex Mono, aligned right, tabular-nums), action bar (Approve / Edit / Reject)
- Shadow: `atmosphere`. Radius `8`. Background `paper-tint`. Border `hairline`.

### Evidence source tile (left-side tile in hero frame)
- Background `paper-deep`. Radius `4`. Inner content shown faded with a 10% `paper` scrim so the canonical card reads as "cleaned up".
- Source badge top-left with Plex Mono caption: `PDF`, `PHOTO`, `POST`, `BOARD`.

### Decision summary leading word
- The first word of every decision summary ("Merged", "Not merged", "Routed") is set in `Instrument Serif` italic, same size as body. Rest is Plex Sans regular.
- Example: *Merged* because name matched after typo normalization and ingredients matched across two branches.

### Confidence display
- Always two decimals: `0.94`, never `94%` or `0.9`.
- Always right-aligned, always Plex Mono, always tabular-nums.
- Above 0.90 → `gold-leaf`. 0.70–0.89 → `ink`. Below 0.70 → `sienna`.

### Chips
- Uppercase captions. Tracking `+0.04em`. Radius `2`. Padding `4 8`. Border 1px of the accent color for the empty state; filled tint variant for the active state.

## What "Editorial" means for the demo video

- **No bouncy title cards.** Titles enter via a 480ms opacity ramp, no movement.
- **Type size on the hero frame is not shy.** Display-xl for "Margherita". Aliases inline below.
- **The signature phrase** ("Three messy sources in. One trustworthy dish record out.") is set in Fraunces 500, 40px, `ink`, with a single `Instrument Serif` italic word for a controlled flourish if possible.

## Implementation notes for prompt 2
- Use Tailwind v4 with a `@theme` block that exposes these tokens as CSS variables (`--color-paper`, `--font-display`, etc.). Do not use Tailwind defaults for colors, fonts, or radii.
- Install fonts via `@fontsource/fraunces`, `@fontsource/instrument-serif`, `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono`. Include only the weights listed above to keep bundle size honest.
- shadcn components are acceptable as a starting point, but their defaults must be overridden with these tokens before the Cockpit is considered visually ready.
