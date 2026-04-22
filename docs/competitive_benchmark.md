# Competitive benchmark · methodology

This document explains how `evals/run_competitor_bench.py` compares
Mise against commercial menu-parsing APIs — currently Veryfi, with
room to add Klippa and others.

The goal is to let anyone (including hackathon judges) **reproduce
the numbers on the landing page** with their own API credentials,
using the exact bundles we ship in `evals/datasets/`.

## What the script does

1. Picks the first menu file from a bundle
   (e.g. `evals/datasets/bundle_01_italian/evidence/menu_pdf_branch_a.pdf`).
2. Sends that file through the Mise pipeline via `app.pipeline.run_pipeline`.
   This is the **same pipeline** the `/api/process` endpoint uses.
3. Optionally sends the same file to Veryfi's `v8/partner/menus/` endpoint.
4. Times both calls end-to-end, counts dishes, and records which of
   five downstream-relevant fields are present.
5. Writes a Markdown + JSON report under `evals/reports/`.

## The five scored fields

| Field | Why it matters |
|-------|----------------|
| **Dishes returned** | Raw coverage. If an engine drops half the menu, everything downstream suffers. |
| **Aliases** | Whether each dish ships with synonyms / shorthand (`"margarita"`, `"mila napo"`). Without this, you build a hand-curated alias table per restaurant. |
| **Search terms** | Diner vernacular — `"breaded cutlet"`, `"ham cheese tomato"`. This is the bridge between an arbitrary query and the canonical name. |
| **Daily-specials lane** | Whether LTOs / chef suggestions / seasonal inserts are surfaced in a separate bucket. Without this, a Tuesday's special stays in the canonical menu forever. |
| **Latency** | Wall-clock from upload to structured JSON. |

Each claim on the landing page's **"How Mise compares"** section
traces back to a row in one of these reports.

## Running the harness

### Mise only (no third-party accounts needed)

```bash
python evals/run_competitor_bench.py \
    --bundle bundle_01_italian \
    --mise-mode real
```

Requires `ANTHROPIC_API_KEY` in `.env`.

### Mise + Veryfi

1. Sign up at <https://www.veryfi.com/signup/>.
2. Grab the four credentials from the Veryfi dashboard
   (`CLIENT_ID`, `CLIENT_SECRET`, `USERNAME`, `API_KEY`).
3. Export them as env vars and run with `--with-veryfi`:

   ```bash
   export VERYFI_CLIENT_ID=...
   export VERYFI_CLIENT_SECRET=...
   export VERYFI_USERNAME=...
   export VERYFI_API_KEY=...
   python evals/run_competitor_bench.py \
       --bundle bundle_01_italian \
       --mise-mode real \
       --with-veryfi
   ```

Veryfi's Menu Parser is currently priced at a per-document rate; the
free trial covers a handful of requests — enough to reproduce any
single bundle in this repo.

## What the report proves (and what it doesn't)

- ✅ It shows, for the exact same input file, what each engine
  returns and how long it takes.
- ✅ It shows, field-by-field, which downstream-relevant fields
  are populated on the **first call** versus requiring post-processing.
- ⚠️ It does not grade accuracy of individual dish transcriptions
  against a ground-truth set. That belongs in `evals/run_eval.py`,
  which has its own `expected.json` files.
- ⚠️ Latency is wall-clock, not p95. For production deployments,
  run the harness N times and aggregate in a spreadsheet.

## Extending to other engines

The `_run_veryfi` function is intentionally small. Copy it to add
Klippa (`api.klippa.com/.../parseDocument/financial`), a cloud-OCR
vendor, or your own stack. As long as the new function returns an
`EngineResult`, the report layout stays consistent.

## The tables on the landing page

The comparison grid in `frontend/src/views/Landing.tsx` reflects
**published capabilities** of each engine's public docs, not scored
benchmark outputs. The intent is to answer "what comes back on the
first call?" — which is the decision a platform integrator actually
makes. For latency / coverage comparisons, run this harness.
