# Preflight Checklist

Green-light gates before each milestone. Never start a milestone with a red check in its gate.

## Gate 0 — Before running `1st_prompt.md` (architecture) ✅ GREEN 2026-04-21

- [x] `git status` shows a clean working tree on `main` *(initial commit 2026-04-21)*
- [x] `.env` exists locally with a valid `ANTHROPIC_API_KEY`
- [x] `python scripts/smoke_api.py` exits 0 — all 4 core probes + 2 guardrail probes PASS against `claude-opus-4-7` (2026-04-21)
- [x] All agent-facing docs readable
- [x] Repo skeleton directories exist: `frontend/`, `backend/`, `evals/datasets/{bundle_01_italian,bundle_02_taqueria,bundle_03_bistro}/evidence/`, `submissions/`
- [x] `LICENSE` present
- [x] `README.md` present with hero paragraph and quickstart

Owner decisions locked:
- [x] Cockpit aesthetic: Editorial / Cartographic (direction A)
- [x] Primary prize targets: Main + Best Opus 4.7 use
- [x] Managed Agents: day 5 upside only, never MVP path — see `docs/scope_freeze.md`
- [x] Supabase / external DB: out of MVP — see `docs/scope_freeze.md`
- [x] Opus 4.7 API shape (no `budget_tokens`, no `temperature`/`top_p`/`top_k`, no assistant prefill) acknowledged — see `docs/plans/2026-04-22-architecture.md` §0

## Gate 1 — Before running `2nd_prompt.md` (Cockpit) ✅ GREEN 2026-04-21

- [x] `docs/plans/2026-04-22-architecture.md` exists and is approved by the user (518 lines, frozen)
- [x] Domain models (`§2.3`) and API contracts (`§3`) are the single source of truth
- [x] Mock data plan (`§4`) enumerates the four demo-critical decisions explicitly
- [x] `docs/cockpit_visual_direction.md` has been re-read in the same session as the UI implementation
- [x] Node 20+ and npm are available locally
- [x] `evals/datasets/bundle_01_italian/evidence/` contains the four generated assets

## Gate 2 — Before running `3rd_prompt.md` (backend shell) ✅ GREEN 2026-04-21

- [x] The Cockpit renders the four demo-critical decisions with mock data (all 8 strings verified in compiled bundle)
- [x] The API contract document from milestone 1 has not changed without being re-approved (one documented extension: `CockpitState.modifiers` flat list replaces the `unattached_modifiers` split — see `docs/plans/2026-04-22-cockpit.md` T2.2 comment, propagated into `docs/plans/2026-04-22-architecture.md` §2.3 on 2026-04-23)
- [x] Python 3.11+ and a virtualenv-ready toolchain are available
- [x] `backend/requirements.txt` plan exists in the implementation plan for milestone 3 *(`docs/plans/2026-04-23-backend.md`)*

## Gate 3 — Before running `4th_prompt.md` (AI integration) ✅ GREEN 2026-04-23

- [x] Backend endpoints exist, return mock responses in the contract shape (`§3` of the arch plan) — 5 endpoints + `/api/health`, 21/21 tests passing
- [x] Frontend consumes the backend (no more inline mocks on the happy path) — `frontend/src/api/client.ts`, `useCockpitState(processingId)` polls live, mock retained as offline fallback
- [ ] `.env` key has been tested against `claude-opus-4-7` in the last 24 hours (re-run `python scripts/smoke_api.py`) — **user action before M4**
- [x] The four demo-critical decisions are encoded in `evals/datasets/bundle_*/expected.json` (done 2026-04-21)
- [x] All three `evals/datasets/bundle_*/evidence/` folders are populated (done via `scripts/generate_eval_bundles.py`)
- [x] The deterministic adaptive-thinking gate is frozen at `docs/plans/2026-04-22-architecture.md` §2.1; no ad-hoc loosening

## Gate 4 — Before recording the demo video

- [ ] `python evals/run_eval.py --bundle all` runs end-to-end and produces a report
- [ ] Each of the four demo-critical decisions passes in the report
- [ ] The hero frame renders with real data at the chosen browser size (1440×900 reference)
- [ ] At least two clean takes of each demo beat exist
- [ ] The metrics pane in the Cockpit reads from the latest eval report, not from static mock numbers
- [ ] The written summary draft exists and is internally consistent with the video

## Gate 5 — Before submission

- [ ] `demo.mp4` is ≤ 3:00 and ≥ 2:45
- [ ] The video is hosted (YouTube unlisted or Loom) and the URL is in `submissions/README.md`
- [ ] The repo README links to the video and the written summary
- [ ] `LICENSE` is MIT, no copyright references to any prior product
- [ ] No `.env` or secret is tracked in git (`git ls-files | findstr /i env` returns nothing except `.env.example`)
- [ ] `submissions/metrics.json` matches the numbers shown in the video
- [ ] `git log` shows conventional commits, no "wip" at HEAD

## If a gate is red
Do not proceed. Fix the red check first. If fixing it would require more time than is budgeted, escalate to the user and decide whether to cut scope rather than cut quality.
