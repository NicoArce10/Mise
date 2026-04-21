# Mise

> The trust layer for dish-level menu data.
> **Three messy sources in. One trustworthy dish record out.**

Mise ingests noisy menu evidence — PDFs, photos, chalkboards, social posts — and produces canonical, reviewable dish records with provenance and confidence. It is not OCR. It is identity reasoning under ambiguity, powered by Claude Opus 4.7.

## Why this exists

Food products do not fail because menus are unavailable. They fail because dish identity fragments across PDFs, screenshots, chalkboards, social posts, branch-level variations, typos, and modifiers. When identity breaks, search breaks, rankings get noisy, analytics split across duplicates, and catalog operations become manual.

Mise is the trust layer upstream of menu management that decides when messy evidence refers to the same dish — and tells you why.

## What it does

1. **Ingests** multi-source menu evidence (images and PDFs go directly to Opus 4.7 — no external OCR in the critical path)
2. **Extracts** dish candidates from each source
3. **Reconciles** identities across sources and branches using adaptive thinking on ambiguous cases
4. **Routes** edge cases deterministically (canonical / modifier / ephemeral / needs-review)
5. **Presents** a Review Cockpit with decision summaries, provenance to every source, and a confidence score per decision

## Demo-critical decisions
- `Marghertia` → normalized to `Margherita`
- `Pizza Funghi` and `Calzone Funghi` are kept separate
- `add burrata +3` is routed as a modifier
- `Chef's special` is routed as ephemeral

## Stack
- **Frontend:** React + Vite + Tailwind + TypeScript + shadcn/ui
- **Backend:** Python + FastAPI
- **Storage:** in-memory for the MVP, Supabase optional
- **AI core:** Anthropic Messages API with `claude-opus-4-7`

## Quickstart

### Prerequisites
- Node.js 20+
- Python 3.11+
- An Anthropic API key with access to `claude-opus-4-7`

### Setup
```bash
cp .env.example .env
# Edit .env and set ANTHROPIC_API_KEY
```

### Backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate   # Windows
# source .venv/bin/activate   # macOS / Linux
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# Opens on http://127.0.0.1:5173
```

### Evaluation harness
```bash
python evals/run_eval.py --bundle all
```

## Architecture
- `frontend/` — Review Cockpit (React + Vite)
- `backend/` — FastAPI service with extraction, reconciliation, and routing layers
- `evals/` — synthetic golden set, harness, and metric reports
- `docs/` — product brief, judging strategy, demo script, evals definition, visual direction
- `submissions/` — rendered demo video, hero frame, metrics report

## For agents working on this repo
See `AGENTS.md`.

## Documentation
- [`docs/product.md`](docs/product.md) — product brief
- [`docs/hackathon_rules.md`](docs/hackathon_rules.md) — competition guardrails
- [`docs/acceptance_criteria.md`](docs/acceptance_criteria.md) — what must be true to submit
- [`docs/judging_strategy.md`](docs/judging_strategy.md) — how Mise targets the judging criteria
- [`docs/demo_script.md`](docs/demo_script.md) — 3-minute video shot list
- [`docs/demo_recording_plan.md`](docs/demo_recording_plan.md) — tooling, resolution, and day-of workflow
- [`docs/evals.md`](docs/evals.md) — evaluation harness specification
- [`docs/cockpit_visual_direction.md`](docs/cockpit_visual_direction.md) — design tokens for the Cockpit
- [`docs/extras.md`](docs/extras.md) — bonus prize strategy
- [`docs/timeline.md`](docs/timeline.md) — day-by-day plan and buffer rules
- [`docs/preflight.md`](docs/preflight.md) — green-light checklist before each milestone
- [`docs/submission_plan.md`](docs/submission_plan.md) — submission-day workflow
- [`docs/plans/`](docs/plans/) — implementation plans per milestone (populated as milestones execute)

## For hackathon judges
If you are reviewing this submission:
- The 3-minute video: see `submissions/README.md` for the link
- The written summary: `submissions/written_summary.md`
- The measured metrics: `submissions/metrics.json`, reproducible via `python evals/run_eval.py --bundle all`

## License
MIT — see [LICENSE](LICENSE). All assets in this repository are created for this hackathon or properly licensed.
