# Prompt 2 — Review Cockpit with mock data

## Read first (in this order)
- The approved architecture plan from milestone 1 (`docs/plans/YYYY-MM-DD-architecture.md`)
- `docs/cockpit_visual_direction.md` — this is the design contract, not a suggestion
- `docs/demo_script.md` — the UI must make every beat in the shot list reachable
- `docs/acceptance_criteria.md`
- `docs/preflight.md` — verify Gate 1 is green before proceeding

## Skills to invoke
1. `writing-plans` — expand this prompt into bite-sized tasks in `docs/plans/YYYY-MM-DD-cockpit.md`
2. `executing-plans` — run the plan, committing per task
3. `frontend-design` — aesthetic is locked to direction A (Editorial / Cartographic). Use the skill to push for distinctive execution within those tokens, not to renegotiate them.
4. `shadcn` — base components, overridden with our tokens
5. `tailwind-design-system` — Tailwind v4 with a `@theme` block exposing our tokens as CSS variables
6. `vite` — build tool configuration
7. `vercel-react-best-practices` — component patterns
8. `typescript-advanced-types` — for typed mock data and domain types
9. `webapp-testing` — smoke-test the Cockpit end-to-end before calling the milestone done
10. `verification-before-completion` — before marking done

## Goal
Ship a Cockpit that renders the hero frame perfectly and reveals the four demo-critical decisions, using mock data only. When the backend arrives in milestone 3, the Cockpit swaps mock for real fetch without a redesign.

## Stack
- React + Vite + TypeScript
- Tailwind v4
- shadcn/ui overridden with tokens from `docs/cockpit_visual_direction.md`

## Requirements (mandatory)
- Three views: **Upload**, **Processing**, **Review Cockpit**
- The Cockpit is a cohesive workspace, not just a list — see the layout rules below
- The hero frame composition is reachable as a full-bleed view triggered from the Cockpit, so it can be screen-recorded for the demo video
- All four demo-critical decisions are visible in the Cockpit with mock data:
  - `Marghertia -> Margherita` merge with typo alias and decision summary
  - `Pizza Funghi` and `Calzone Funghi` as two separate cards with an explicit non-merge decision summary
  - `add burrata +3` as a modifier chip under the Margherita card
  - `Chef's special` in a distinct ephemeral lane with its own decision summary
- Approve / Edit / Reject actions are present on every canonical dish card and wired to local state
- Confidence display follows the rules in `docs/cockpit_visual_direction.md` (Plex Mono, two decimals, color-mapped by band)

## Layout contract
- Cockpit main workspace: three columns on desktop — evidence rail (source tiles) | canvas (canonical dish cards in a stack) | detail rail (selected dish's provenance and decision summary)
- Hero frame view: overlay triggered by a "Present" button in the top bar. Two equal columns. Left: 2×2 evidence tiles from the selected bundle. Right: the canonical dish card with shadow `atmosphere`. Caption band at the top with the signature phrase in Fraunces.
- The default layout on first load is the Cockpit, not the hero frame. The hero frame is invoked, not the landing surface.

## Design non-negotiables
- Fonts installed via `@fontsource/fraunces`, `@fontsource/instrument-serif`, `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono` — only the weights listed in `docs/cockpit_visual_direction.md`
- Tailwind theme is custom. No default Tailwind colors or fonts appear in the rendered UI.
- No Inter, no Roboto, no purple gradients, no bouncy motion, no dark mode for the MVP.

## Output
- A runnable frontend under `frontend/` with `npm install && npm run dev` working
- A top-level `frontend/README.md` describing how to run and what to inspect for verification
- Mock data lives in `frontend/src/mocks/` and covers the hero-frame bundle plus the four demo-critical decisions

## Verification (Gate 2)
- `npm run dev` opens on `http://127.0.0.1:5173` without console errors
- The Cockpit shows at least: one merged canonical dish (Margherita with `Marghertia` alias), two non-merged dishes (Funghi pizza and calzone), one modifier chip (`add burrata +3`), one ephemeral card (`Chef's special`)
- The Present button opens the hero frame overlay and it matches the composition described in `docs/demo_script.md`
- Approve / Edit / Reject change the moderation status on the local state and the chip color follows the semantic map in `docs/cockpit_visual_direction.md`
- A webapp-testing smoke test script exists and passes
