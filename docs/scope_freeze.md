# Scope Freeze — MVP vs Upside

> Dated 2026-04-21. Authoritative over `docs/extras.md` and all prompt files on questions of what is in and what is out. Supersedes any earlier casual mention of optional scope.

## Why this document exists

Mise has five days and one developer. The single highest risk is not API access — it is scope drift that eats hours owed to the demo video and the eval report. This doc names the handful of features that are ruthlessly excluded from the MVP path, the exact test that must be passed before any of them can be reconsidered, and how to signal that across the repo.

## MVP path (all five are mandatory for submission)

1. Upload a batch of evidence (images + PDFs) into an in-memory store.
2. Extract dish candidates from each source via one Opus 4.7 call per source (vision-native).
3. Reconcile candidates through the deterministic gate in `docs/plans/2026-04-22-architecture.md` §2.1; call Opus 4.7 with adaptive thinking only on `AMBIGUOUS` pairs.
4. Surface the result in the Review Cockpit with decision summaries, provenance, confidence, and the four demo-critical cards (Margherita merge, Pizza Funghi vs Calzone Funghi non-merge, `add burrata +3` modifier, Chef's Special ephemeral).
5. Produce a measured eval report from `evals/run_eval.py --bundle all`. The metrics pane in the Cockpit reads from that report.

Nothing else ships in the MVP.

## Hard exclusions (frozen — require explicit unfreeze to enter scope)

| Excluded | Why it's out | What would unfreeze it |
|---|---|---|
| **Managed Agents** (async batch reconciliation) | Adds a second SDK surface, a second tool runtime, and an entire "Batch" tab. Every hour spent here is an hour not spent on the hero frame, the eval report, or the video. | Gate 4 green **and** at least 12 clear hours remain before submission **and** the demo video has at least one acceptable take. |
| **Supabase** (or any external database) | In-memory store serves three bundles and the demo just fine. A DB adds schema migrations, connection config, and a failure mode mid-demo. | Same as above, plus a concrete Cockpit feature that cannot be demoed from in-memory state. |
| **Authentication / users / teams** | Not on the judging rubric for this hackathon, burns a full day. | Never in this project. |
| **External OCR or text-extraction services** | Explicitly against the product thesis ("not an OCR company"). Also redundant with Opus 4.7 vision. | Never in this project. |
| **LangChain / LlamaIndex / any agent-orchestration framework** | Hides what Opus 4.7 is doing behind an abstraction — the opposite of what judges need to see. | Never in this project. |
| **A third eval bundle beyond the three already defined** | Three bundles cover the four demo-critical cases and the three surface kinds (PDF, photo, chalkboard / social). | Never in this project. |
| **Video compositing or animation beyond the shot list** | OBS cuts plus DaVinci Resolve is enough. | Never in this project. |

## Soft cuts (first things to drop if the schedule slips)

If the timeline in `docs/timeline.md` shows any buffer day consumed by the end of Thursday, cut in this order:

1. **Bundle 03 photography polish.** Ship the generated assets from `scripts/generate_eval_bundles.py` as-is. Do not manually restyle.
2. **Cockpit "Present" hero overlay animation.** Ship a static hero frame — the overlay just fades in, nothing else.
3. **Cockpit "edit" flow.** Ship approve / reject only if edit is unfinished. Moderation status still works.
4. **`/api/process/{processing_id}` polling caption.** Ship the state label without the adaptive-thinking count if the counter plumbing is incomplete. The hero frame already shows "Adaptive thinking engaged on 2 pairs" as a static caption in the video.

Never cut: the four demo-critical decisions, the eval report, or the video.

## How the freeze is enforced in the repo

- `docs/extras.md` links here and defers all optional-scope decisions to this document.
- `docs/preflight.md` Gate 0 asserts this doc has been read in the current session.
- Any PR or commit that touches `backend/**/managed_agents*`, `backend/**/supabase*`, `docker-compose.yml` for a DB, or adds a new dependency whose name contains `langchain`, `llamaindex`, `supabase`, or `openai`, must be rejected without discussion. There is no exception before Gate 4 is green.

## How the freeze can be lifted

One sentence in a fresh commit message, in the first line: `feat(scope): unfreeze <item> — gate 4 green at <time>, buffer = <hours>`. That commit is also where the work begins. Until that commit exists, every other commit assumes the freeze.
