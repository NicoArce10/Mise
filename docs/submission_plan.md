# Submission Plan

## Required assets
- Demo video, max 3:00 — specified by `docs/demo_script.md`
- Repo link — this repository
- Written summary — `submissions/written_summary.md`

## Video
Detailed shot list and hero frame live in `docs/demo_script.md`. Do not restructure the video independently of that document.

## Repo requirements
- Clear `README.md` at repo root with hero paragraph, quickstart, architecture, and doc links
- Easy local run instructions (`frontend/` and `backend/` each have a README)
- Clear architecture — milestone 1 plan in `docs/plans/`
- Open source license — `LICENSE` (MIT)
- No references to any prior product anywhere
- `.env` never committed; `.env.example` serves as the template

## Written summary
`submissions/written_summary.md`, authored on submission day from the structure below. It must be internally consistent with the video and the eval report.

### Required sections
1. **Problem** — one paragraph, enterprise-framed, drawn from `docs/product.md`
2. **User** — one paragraph, drawn from the users list in `docs/product.md`
3. **Solution** — one paragraph plus the hero frame description from `docs/demo_script.md`
4. **Why Opus 4.7** — the four pillars from `docs/judging_strategy.md` section "Opus 4.7 Use", condensed to one paragraph
5. **Measured outcomes** — numbers copied verbatim from `submissions/metrics.json` (no rounding, no adjectives like "roughly")
6. **Links** — video URL, repo URL

## Submission-day workflow
1. Run `python evals/run_eval.py --bundle all --out evals/reports/submission.json`
2. Verify all four demo-critical decisions pass in the report
3. Copy `evals/reports/submission.json` to `submissions/metrics.json`
4. Record the demo video against the current main branch
5. Upload the video (YouTube unlisted or Loom), paste the URL into `submissions/README.md`
6. Author `submissions/written_summary.md` using the numbers from `submissions/metrics.json`
7. Commit, tag `submission-v1`, push, submit the repo URL and the video URL

## Do-not list
- Do not quote any metric that is not in `submissions/metrics.json`
- Do not mention Managed Agents unless the bonus path was actually completed (see `docs/extras.md`)
- Do not rewrite the hero frame between recording and submission
