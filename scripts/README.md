# scripts/

One-off utilities. Not part of the product runtime.

## smoke_api.py
Four-probe smoke test for `claude-opus-4-7`. Verifies the capabilities Mise depends on:

1. **Text round-trip** — baseline reachability
2. **Image vision** — feeds a synthesized PNG with `Marghertia` typo and asserts the typo is preserved verbatim in the response (this is the exact signal the extraction layer relies on)
3. **PDF vision** — same check against a single-page synthesized PDF, so we know Opus 4.7 reads PDFs natively with no external OCR
4. **Adaptive thinking** — sends `thinking: {type: "adaptive"}` (the Opus 4.7 form; `budget_tokens` returns 400 on 4.7) and checks the model answers `NO` to a "is Pizza Funghi the same as Calzone Funghi" prompt

Run once during preflight, any time the key is rotated, and any time the `ANTHROPIC_MODEL` env var is bumped.

```bash
pip install anthropic python-dotenv pillow
python scripts/smoke_api.py
```

Exit 0 means all four probes pass. Exit 1 means the key / env / dependencies are wrong. Exit 2 means the model is reachable but at least one capability failed — in that case **do not advance past Gate 0**; fix the capability first (usually key access to `claude-opus-4-7` with vision enabled).

## generate_eval_bundles.py
Deterministic generator for every evidence file under `evals/datasets/bundle_*/evidence/`. Produces all 10 assets (2 PDFs + menu photo + chalkboard + Instagram post for bundle 01; taqueria PDF + delivery-app screenshot + extras chalkboard for bundle 02; dinner PDF + lunch PDF + chef's-special board for bundle 03) with the dish names and typos spelled **exactly** as required by the eval harness, so we never waste time iterating with an image model that mangles text. See the script's header for the contract.

```bash
pip install pillow
python scripts/generate_eval_bundles.py                 # all three bundles
python scripts/generate_eval_bundles.py --bundle 01     # a single bundle
```

Re-runs are idempotent. Commit the generated files — they are part of the golden set.
