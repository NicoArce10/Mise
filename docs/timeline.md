# Timeline

Solo developer. Hard deadline **Sunday, April 26, 2026, 8:00 PM EST**.

Today is Tuesday, April 21. Five-and-a-half days net. Anything that slips by more than the buffers below triggers the cut rules at the bottom of this document.

## Day-by-day plan

### Tue Apr 21 — Preflight close (today, partial day)
- [x] Strategy docs locked (`judging_strategy`, `demo_script`, `evals`, `cockpit_visual_direction`, `extras`, `preflight`)
- [x] Repo skeleton + infra files (`README`, `AGENTS`, `LICENSE`, `.gitignore`, `.env.example`)
- [x] Four prompts rewritten and aligned
- [x] All authoring docs written (this file, `AUTHORING.md` per bundle, `demo_recording_plan`, `smoke_api.py`, `written_summary_template`, `plans/README`)
- [ ] User creates GitHub repo and pastes URL back
- [ ] First commit + push to `origin/main`
- [ ] Smoke test: `python scripts/smoke_api.py` returns 0 against `claude-opus-4-7`
- [ ] **Gate 0 green → arrancamos prompt 1 si queda energía, si no mañana a primera hora**

**End-of-day target:** Gate 0 green. Optionally: prompt 1 plan drafted.

### Wed Apr 22 — Architecture + Cockpit start
- Morning: execute `1st_prompt.md`. Invoke `brainstorming` then `writing-plans`. Output: `docs/plans/2026-04-22-architecture.md` with domain models, API contracts, mock data plan.
- User reviews and approves the architecture plan (hard gate).
- Afternoon/evening: execute `2nd_prompt.md` (Cockpit). Invoke `writing-plans` with the architecture as input. Scaffold Vite + Tailwind + shadcn with our tokens.
- Parallel micro-task during breaks: start authoring bundle 01 assets (see `evals/datasets/bundle_01_italian/AUTHORING.md`).

**End-of-day target:** architecture approved. Cockpit scaffolded with token-compliant shell. Bundle 01 assets 50% authored.

### Thu Apr 23 — Cockpit finish + assets
- Morning: finish Cockpit. All four demo-critical decisions render with mock data. Hero frame overlay reachable from a "Present" button. Approve / Edit / Reject wired to local state.
- Afternoon: finish bundle 01 assets. Start bundle 02 (taqueria) and bundle 03 (bistro).
- End of day: **Gate 2 green**. Cockpit smoke-tested with `webapp-testing`. Hero frame looks memorable on 1440×900.

**End-of-day target:** Gate 2 green. Bundle 01 complete with `expected.json`. Bundle 02 and 03 at 60%.

### Fri Apr 24 — Backend shell
- Morning: execute `3rd_prompt.md`. Invoke `writing-plans` with architecture + Cockpit in context. TDD the three test files.
- Afternoon: Cockpit consumes real backend (remove local mocks on the happy path). Swap `VITE_API_BASE` to `http://127.0.0.1:8000`.
- Evening: finish bundles 02 and 03. Author all three `expected.json` files.

**End-of-day target:** Gate 3 green. All three bundles have `expected.json`. Backend returns correctly shaped mock responses.

### Sat Apr 25 — AI integration + first eval + first video takes
- Morning: execute `4th_prompt.md`. Invoke `writing-plans`. Wire real Opus 4.7 calls for extraction, reconciliation, routing.
- Midday: first end-to-end run with real API. Debug.
- Afternoon: run `python evals/run_eval.py --bundle all`. Fix failures until all four demo-critical decisions pass.
- Evening: first clean takes of the demo video. Target 2 complete takes of the hero frame and the metrics pane.

**End-of-day target:** Gate 4 green. Eval report on disk showing all four decisions passing. Two clean takes of the hero frame.

### Sun Apr 26 — Polish, final eval, final edit, submit (deadline 8 PM EST)
- Morning: polish Cockpit micro-details. Re-run eval to produce `evals/reports/submission.json`. Copy to `submissions/metrics.json`.
- Midday: final take of every beat. Edit video in DaVinci Resolve. Target 2:45.
- Afternoon: write `submissions/written_summary.md` using the template, numbers pulled verbatim from `metrics.json`.
- Evening (early): upload video to YouTube unlisted. Update `submissions/README.md` with URL. Tag `submission-v1`. Push.
- Evening (before 8 PM EST): final check of all links. Submit repo URL and video URL through the hackathon portal.

**End-of-day target:** submitted with at least 90 minutes of cushion before 8 PM EST.

## Buffer rules (hard)

Check at the end of each day. If red, apply the cut immediately without negotiation.

| Milestone | Slip tolerance | Cut rule |
|---|---|---|
| Wed EOD — architecture not approved | 0 days | Escalate to user same night. Do not touch code. |
| Thu EOD — Cockpit not smoke-testable | 0 days | Cut: non-essential Cockpit polish, keep hero frame + 4 demo cards only. Drop any view beyond Upload / Processing / Review. |
| Fri EOD — backend not wired to frontend | 0 days | Cut: Supabase (if it was pursued). Stay in-memory. Drop any endpoint not required by the Cockpit. |
| Sat EOD — eval not green on 4 decisions | 0 days | Cut: Managed Agents. Cut: any reconciliation nuance beyond the 4 demo-critical cases. Hard-code the 4 cases in eval fixtures if needed so the numbers are honest for those cases. |
| Sun 2 PM EST — video not final-cut | 0 days | Ship a 2-minute video if that is what is clean. A shorter honest video beats a 3-minute rough one. |

## Sacred constraints (never violate, even under pressure)

- The **hero frame** must be in the video
- The **four demo-critical decisions** must demonstrably pass in the eval report that ships with submission
- **Metrics in the video match `metrics.json` exactly** — no invented numbers ever
- **Raw model thinking never appears in any user-facing surface**
- **No reference to any prior product anywhere**
- **No commit of `.env`**

## Soft code freeze

Saturday 10:00 PM local. After that, the only allowed changes are:
- Video editing
- `written_summary.md`
- `submissions/README.md` link updates
- Commit message fixes

Any bug found after code freeze that cannot be fixed in 30 minutes is addressed by changing the video, not the code.
