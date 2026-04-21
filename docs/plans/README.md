# docs/plans/

Implementation plans produced by the `writing-plans` skill, one per milestone.

## Naming convention
`YYYY-MM-DD-<milestone>.md`

Milestone identifiers:
- `architecture` — output of `1st_prompt.md`
- `cockpit` — output of `2nd_prompt.md`
- `backend` — output of `3rd_prompt.md`
- `ai-integration` — output of `4th_prompt.md`

## Structure
Each plan follows the format defined in the `writing-plans` skill:
- Header with goal, architecture, tech stack
- File structure (what will be created or modified)
- Tasks as bite-sized steps (2-5 minutes each)
- Each step is checkboxed for tracking progress
- Acceptance criteria before the milestone closes

## Lifecycle
1. Before running a milestone prompt, invoke `writing-plans` to produce its plan here
2. User reviews and approves the plan
3. Invoke `executing-plans` to run it task by task
4. Commit each task individually with a conventional message
5. Do not edit the plan after it is approved — if the plan is wrong, write a new plan dated the next day and supersede

## What is NOT in this folder
- Strategy docs (those live in `docs/` root)
- Asset authoring guides (those live in `evals/datasets/bundle_*/AUTHORING.md`)
- This folder contains execution plans only
