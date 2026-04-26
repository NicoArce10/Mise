# submissions

Deliverables for the Claude Opus 4.7 Hackathon (April 2026).

## Files

| File | State | Notes |
|---|---|---|
| `written_summary.md` | Committed. | Submission summary (≤ 200 words above the rule); every number mirrors `metrics.json`. |
| `metrics.json` | Committed. | Search metrics; reproducible via `python evals/run_search_eval.py --mode fallback`. |
| `demo.mp4` | Not committed. | ≤ 3:00, hosted on YouTube unlisted or Loom. URL is the one below. |

## Links

- **Demo video** (≤ 3:00): `<YouTube / Loom URL — filled on submission day>`
- **Repo**: <https://github.com/NicoArce10/Mise>
- **License**: MIT (see [`LICENSE`](../LICENSE))

## Reproducing every number in the video and in the summary

```bash
# Search metrics — populates submissions/metrics.json
python evals/run_search_eval.py --mode fallback

# Identity-graph metrics — six demo-critical decisions across 3 bundles
python evals/run_eval.py --bundle all

# Side-by-side benchmark vs Veryfi (optional, requires your own Veryfi key)
python evals/run_competitor_bench.py --bundle bundle_01_italian \
       --mise-mode real --with-veryfi
```

## Rules of engagement (self-imposed)

- Every number in `written_summary.md` or in the video matches `metrics.json` exactly. No rounding, no "approximately".
- Identity-graph claims are reproducible with `python evals/run_eval.py --bundle all`; search claims are reproducible with `python evals/run_search_eval.py --mode fallback`.
- Live Opus demo claims must be visible in the recorded product flow. Do not publish a number that only appeared in a local dry run.
- Restaurant menus used during development and video recording are not redistributed in this repository; deterministic reproducibility rests on the eval harness and the bundles under `evals/sample_menus/` and `evals/fixtures/`.
