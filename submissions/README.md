# submissions

Deliverables for the hackathon submission.

## Files

| File | State | Notes |
|---|---|---|
| `written_summary.md` | **Draft in repo.** Refresh on submission day after the final eval run. | Every number mirrors `metrics.json`. Video URL is the one placeholder to fill. |
| `metrics.json` | **Snapshot in repo** (fallback mode, 2026-04-21). | Overwrite from the latest `evals/reports/*.json` after any re-run. Committed so reviewers can verify without booting the app. |
| `written_summary_template.md` | Reference. | Keep for future hackathons — do not submit. |
| `demo.mp4` | Not committed. | ≤ 3:00, hosted on YouTube unlisted or Loom. URL lives in this README. |
| `hero_frame.png` | Not committed. | Still export of the opening shot; used in the written summary and README header. |

## Links (filled in on submission day)

- Demo video: `<YouTube / Loom URL>`
- Repo: `<GitHub URL>`

## Rules
- Every number in `written_summary.md` or in the video matches `metrics.json` exactly. No rounding, no "approximately".
- The video must be reproducible: anyone with the repo and a valid `ANTHROPIC_API_KEY` should be able to regenerate the metrics within ±1 absolute percentage point.
