# AGENTS.md

Orientation for any AI agent working on Mise. Read this fully before touching code or files.

## Read order, first visit
0. `docs/project_brief.md` — one-page self-contained handoff brief. Read first to get oriented.
1. `CLAUDE.md` — identity, scope, engineering principles
2. `docs/product.md` — what Mise is and is not
3. `docs/hackathon_rules.md` — hard rules from the competition
4. `docs/acceptance_criteria.md` — what must be true to submit
5. `docs/judging_strategy.md` — how we target the judging criteria
6. `docs/demo_script.md` — the video deliverable the whole product serves
7. `docs/demo_recording_plan.md` — tooling and day-of capture workflow
8. `docs/evals.md` — the only source of truth for published metrics
9. `docs/cockpit_visual_direction.md` — design tokens for the Review Cockpit
10. `docs/extras.md` — bonus prize strategy
11. `docs/timeline.md` — day-by-day plan, buffers, and cut rules
12. `docs/preflight.md` — green-light checklist before each milestone
13. `docs/scope_freeze.md` — authoritative exclusions (Managed Agents, Supabase, etc.) and soft-cut order
14. `docs/plans/2026-04-22-architecture.md` — the architecture contract milestones 2–4 implement

## Hard rules (non-negotiable)
- **Never reference any prior product.** Mise is new and standalone.
- **Never commit secrets.** `.env` is gitignored; use `.env.example` as the template.
- **Never publish a metric that was not produced by `evals/run_eval.py`.** No estimates, no "around 90%".
- **Never expose raw model thinking in the UI.** The product surface is decision summaries with provenance and confidence.
- **Never introduce LangChain, LlamaIndex, or similar orchestration frameworks.** We call the Anthropic Messages API directly.
- **Never use OCR libraries in the critical path.** Images and PDFs go directly to Opus 4.7 vision.
- **Keep Managed Agents and Supabase out of the MVP.** See `docs/scope_freeze.md` — both require explicit unfreeze after Gate 4 is green.
- **Opus 4.7 API shape is non-negotiable:** `thinking: {type: "adaptive"}` only; never send `budget_tokens`, `temperature`, `top_p`, `top_k`, or a last-assistant prefill — all return HTTP 400 on 4.7. Control cost with `output_config: {effort, task_budget}`. See the corrections table in `docs/plans/2026-04-22-architecture.md` §0.

## Workflow per milestone
Each prompt in `/1st_prompt.md` … `/4th_prompt.md` is a milestone. For every milestone:

1. **Brainstorm** if anything is ambiguous — invoke `brainstorming` skill.
2. **Plan** — invoke `writing-plans` skill to break the prompt into bite-sized tasks with acceptance criteria. Save to `docs/plans/YYYY-MM-DD-<milestone>.md`.
3. **Execute** — invoke `executing-plans` skill, one task at a time, commit per task.
4. **Verify** — invoke `verification-before-completion` skill before marking the milestone done. Run the acceptance criteria listed in the prompt.
5. **Commit** — conventional commit message, keep commits focused.

## Skills matrix

| Milestone | Primary skills | Secondary |
|---|---|---|
| 1st_prompt — architecture | `brainstorming`, `writing-plans` | `documentation` |
| 2nd_prompt — Cockpit | `frontend-design`, `shadcn`, `tailwind-design-system`, `vite`, `vercel-react-best-practices`, `typescript-advanced-types` | `webapp-testing` |
| 3rd_prompt — backend shell | `fastapi-python`, `fastapi-templates`, `python-code-style` | `test-driven-development`, `systematic-debugging` |
| 4th_prompt — AI integration | `claude-api`, `prompt-engineering-patterns` (LangChain snippets ignored) | `systematic-debugging` |

`verification-before-completion` runs at every checkpoint. `find-skills` runs only if the user explicitly asks to extend capabilities.

## Commit convention
- `feat(area): short imperative summary`
- `fix(area): ...`
- `docs(area): ...`
- `chore(area): ...`
- `eval(area): ...` for changes to the harness or datasets

`area` is one of: `frontend`, `backend`, `evals`, `docs`, `infra`.

## Anchors the product must serve
- The hero frame defined in `docs/demo_script.md` is the north star. Every UI and API decision ultimately supports that frame.
- The four demo-critical decisions (`Marghertia`, `Funghi`, `burrata +3`, `Chef's special`) must be demonstrable end-to-end.
- `docs/judging_strategy.md` section "Why Mise can win top 1" lists the conditions we must satisfy. Re-read it before marking any milestone complete.

## What NOT to do
- Do not scaffold the UI before reading `docs/cockpit_visual_direction.md` — the aesthetic is locked to "Editorial / Cartographic" (direction A).
- Do not write prompts that leak raw chain-of-thought into the user-facing output.
- Do not invent numbers in the video, README, or written summary. If a metric has not been measured, it does not appear.
- Do not add dependencies without a direct justification tied to a milestone acceptance criterion.
