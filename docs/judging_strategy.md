# Judging Strategy

## Goal
Optimize for top 3, build for top 1.

## Why Mise can win top 1
- Not OCR — identity reconciliation. A clear, defensible category of its own.
- Opus 4.7 is visible in the product surface: vision-native ingestion, adaptive thinking on ambiguous reconciliations, and structured outputs validated deterministically.
- One memorable before/after frame the judges will remember after closing the video.
- Measured reconciliation quality on a synthetic golden set, not adjectives.
- Human-in-the-loop review cockpit with provenance and confidence per decision — this reads as enterprise, not as a toy.

## Impact
Frame Mise as infrastructure for trustworthy dish-level menu data.

## Demo
The demo must show:
- messy evidence in
- canonical reviewable dish records out
- provenance
- merge / no-merge decisions
- edge cases handled safely

## Opus 4.7 Use
Make Opus 4.7 visible in the product surface, not only in the narration. Four load-bearing pillars:

1. **Vision-native ingestion.** Images and PDFs go directly to Opus 4.7. No external OCR step in the critical path.
2. **Adaptive thinking on ambiguous reconciliations.** Triggered only for edge cases the deterministic layer cannot resolve.
3. **Structured output plus deterministic validation.** Opus 4.7 emits JSON; the backend validates shape, types, and routing rules. Reasoning and validation are separated on purpose.
4. **Decision summaries visible in the cockpit.** Each canonical dish card exposes a short, human-readable summary of why evidence was merged, kept separate, or routed as modifier or ephemeral — plus provenance back to every source and a confidence score.

Do not expose raw model thinking in the UI. The product surface is decisions with provenance and confidence, not traces.

Do not present Mise as a basic wrapper over OCR or a single prompt. The architecture deliberately separates extraction, reconciliation, routing, and validation into distinct layers.

## Depth and execution
Show:
- confidence
- moderation states
- deterministic routing
- provenance
- human-in-the-loop

## Demo-critical decisions
- Marghertia -> Margherita
- Pizza Funghi != Calzone Funghi
- add burrata +3 -> modifier
- Chef's special -> ephemeral