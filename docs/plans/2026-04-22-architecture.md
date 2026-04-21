# Mise — Architecture Plan (Milestone 1)

> Produced by `writing-plans` skill on 2026-04-21 (dated 2026-04-22 per milestone naming convention).
> This plan is the contract that milestones 2, 3, and 4 implement. No code yet.

**Goal.** Freeze the minimal, composable architecture that serves the hero frame in `docs/demo_script.md` and lets `evals/run_eval.py` measure the four demo-critical decisions, correcting every ambiguity in the strategy docs with a concrete rule.

**Architecture (one line).** Four deterministic layers. Opus 4.7 is **core-guaranteed** in two of them (extraction per source; reconciliation on `AMBIGUOUS` pairs only). A third layer (routing) uses Opus 4.7 as an **optional enhancement** on lines the deterministic regex cannot classify — if the regex covers every line in the three bundles (expected), routing never calls Opus and the MVP still ships intact.

**Tech stack.** FastAPI + Pydantic v2 backend (in-memory store), React + Vite + Tailwind v4 + shadcn/ui frontend, Anthropic Python SDK against `claude-opus-4-7`. No LangChain, no LlamaIndex, no external OCR.

---

## 0. Opus 4.7 — breaking-change corrections to the project docs

The `claude-api` skill and the Opus 4.7 migration notes flag behaviors that the strategy docs (`extras.md`, `judging_strategy.md`, `4th_prompt.md`) encoded with older mental models. This plan supersedes them on three points.

**Primary sources** (read these before editing backend AI code):
- Models overview — confirms Opus 4.7 has Adaptive thinking = Yes and Extended thinking = **No**: <https://platform.claude.com/docs/en/about-claude/models/overview#latest-models-comparison>
- Migrating to Opus 4.7 — the full breaking-change list: <https://platform.claude.com/docs/en/about-claude/models/overview#migrating-to-claude-opus-4-7>
- Adaptive thinking syntax and behavior: <https://platform.claude.com/docs/en/build-with-claude/adaptive-thinking>
- Task budgets — the documented replacement for the old `budget_tokens` knob on 4.7: <https://platform.claude.com/docs/en/build-with-claude/task-budgets>

**Confirmed by Anthropic docs** (treat as contract):

| Old phrasing anywhere in this repo | Correct for Opus 4.7 |
|---|---|
| "Extended thinking with a deliberate token budget" | `thinking: {type: "adaptive"}`. `type: "enabled"` and `budget_tokens` are **not accepted** on Opus 4.7. Cost is controlled with `output_config: {effort: "high"\|"xhigh"\|"max"}`, optionally `output_config: {task_budget: {type: "tokens", total: N}}` (beta header `task-budgets-2026-03-13`, Messages API only). |
| "Adaptive thinking budget documented and respected" | The documented budget is the `effort` level and a `max_tokens` cap. No `budget_tokens`. |

**Documented but not yet verified on this key.** The `claude-api` skill lists these as breaking changes on Opus 4.6/4.7 but the project does not treat them as a hard contract until `scripts/smoke_api.py` probes 5 and 6 confirm it on this deployment:

| Claim | How we verify | What we do if verification fails |
|---|---|---|
| `temperature`, `top_p`, `top_k` return HTTP 400 on 4.7 | `smoke_api.py` probe 5 sends `temperature=0.5` and asserts 400 | Log warning; update this section to "accepted on this deployment"; never send them regardless, because the docs say 4.7 ignores them |
| Last-assistant-turn prefill returns HTTP 400 | `smoke_api.py` probe 6 sends a prefill and asserts 400 | Same as above. Still rely on `output_config: {format}` for shape, never on prefill |

These corrections are propagated into the AI integration section of this plan. The strategy docs stay as narrative; the API shape lives here.

---

## 1. Architecture diagram

```mermaid
flowchart LR
  subgraph Client
    UI[Review Cockpit<br/>React+Vite]
  end

  subgraph API[FastAPI]
    UP[POST /api/upload]
    PR[POST /api/process/{batch_id}]
    PS[GET /api/process/{processing_id}]
    RV[GET /api/review/{processing_id}]
    DC[POST /api/review/{processing_id}/decisions]
  end

  subgraph Pipeline
    EX[Extraction Layer<br/>per SourceDocument]
    RE[Reconciliation Layer<br/>deterministic prefilter]
    RT[Routing Layer<br/>canonical/modifier/ephemeral/needs-review]
    VA[Validation Layer<br/>Pydantic + enum + invariants]
    ST[(In-memory Store<br/>ProcessingRun)]
  end

  subgraph Opus[claude-opus-4-7]
    OX[extraction call<br/>vision: PDF/image]
    OR_S[reconciliation call<br/>simple]
    OR_A[reconciliation call<br/>adaptive thinking]
    ORT[routing call<br/>edge cases only]
  end

  UI -- upload --> UP
  UI -- start  --> PR
  UI -- poll   --> PS
  UI -- fetch  --> RV
  UI -- act    --> DC

  UP --> ST
  PR --> EX
  EX --> OX
  OX --> VA
  VA --> RE
  RE -. gate=ambiguous .-> OR_A
  RE -. gate=simple    .-> OR_S
  OR_S --> VA
  OR_A --> VA
  VA --> RT
  RT -. optional: regex-unclassified only .-> ORT
  ORT --> VA
  VA --> ST
  ST --> RV
  DC --> ST
```

Opus 4.7 has **two core-guaranteed call sites** (extraction per source, reconciliation on `AMBIGUOUS` pairs) and **one optional call site** (routing, only for lines the deterministic regex cannot classify — see §2.2). On the three MVP bundles the routing regex is expected to cover every line, so the optional call site stays dark in the demo. If it ever fires, the response is parsed and validated like any other Opus call.

---

## 2. Four ambiguities — closed

Each decision below is the final word for the MVP. Alternatives considered are listed so the reasoning is auditable.

### 2.1 The deterministic gate for adaptive thinking

**Problem.** Strategy docs described the gate as "typically when normalized names match but ingredients or dish type differ". That is prose, not a rule.

**Decision.** A pair `(a, b)` of extracted dish candidates is classified by the prefilter into exactly one of `OBVIOUS_MERGE | OBVIOUS_NON_MERGE | AMBIGUOUS`. Only `AMBIGUOUS` goes to Opus 4.7 with adaptive thinking.

```text
let N(s) = lower(strip_accents(collapse_ws(strip_punct_keep_space(s))))
let lev_ratio(x, y) = levenshtein(x, y) / max(len(x), len(y))
let tokens(xs) = set of normalized tokens of xs (stopwords removed)
let jaccard(A, B) = |A ∩ B| / |A ∪ B|   # 1.0 if both empty
let DISH_TYPE_LEX = {
  "pizza","calzone","pasta","lasagna","linguine","spaghetti","ravioli","gnudi",
  "taco","tacos","quesadilla","burrito","torta","tostada",
  "salad","soup","sandwich","burger","toast","tartare","steak","rib","fish",
  "halibut","salmon","cod","chicken","pork","lamb"
}
let dish_type(c) = first token in N(c.name).split() that is in DISH_TYPE_LEX, else "unknown"

# Primary signals
let name_close  = lev_ratio(N(a.name), N(b.name)) <= 0.25      # "Marghertia" vs "Margherita" ≈ 0.10
let name_exact  = N(a.name) == N(b.name)
let type_same   = dish_type(a) != "unknown" AND dish_type(a) == dish_type(b)
let type_differ = dish_type(a) != "unknown" AND dish_type(b) != "unknown" AND dish_type(a) != dish_type(b)
let ingr_high   = jaccard(tokens(a.ingredients), tokens(b.ingredients)) >= 0.60
let ingr_low    = jaccard(tokens(a.ingredients), tokens(b.ingredients)) < 0.30

# Classification
OBVIOUS_MERGE     iff name_exact AND (type_same OR dish_type(a)=="unknown" OR dish_type(b)=="unknown") AND NOT ingr_low
OBVIOUS_NON_MERGE iff NOT name_close AND NOT (type_same AND ingr_high)
AMBIGUOUS         otherwise
```

**Why these thresholds.** `Marghertia` vs `Margherita` has `lev_ratio == 1/10 = 0.10` — inside the 0.25 band and correctly flagged `name_close`. `Pizza Funghi` vs `Calzone Funghi` has identical ingredients but `type_differ` — it falls into AMBIGUOUS, which is what we want (Opus 4.7 must give the "not merged because dish type differs" decision on video). `Tacos al Pastor` vs `Al Pastor Tacos` normalizes to the same token multiset → `N(a.name) == N(b.name)` → `OBVIOUS_MERGE`, no LLM call needed.

**Alternatives considered.** (a) Name-only gate (too trigger-happy, wastes Opus calls). (b) Embedding similarity (requires an extra model, violates "keep it composable"). (c) Fuzzy cluster then model-adjudicate (too much moving parts for 5 days).

**Cost implication.** With 3 bundles and ~15 extracted candidates per bundle, full pairwise is ≲ 315 pairs. The gate cuts that to ≤ ~10 AMBIGUOUS pairs per bundle on the mock fixtures. Adaptive calls are bounded.

**UI implication.** The processing view shows the count of pairs routed to each class ("Adaptive thinking engaged on 2 pairs") — this is the live caption in the demo video. The count comes from the gate, not from the model.

### 2.2 Modifier without `parent_dish`

**Problem.** Bundle 02 (taqueria) has a chalkboard listing only modifiers (`add guacamole +2`, `add queso +1`, `extra salsa +0`) with no dish on the board. The expected JSON encodes them as `parent_dish: null`.

**Decision.** `Modifier` has an optional `parent_dish_id`. When `null`, the modifier is surfaced in a distinct Cockpit lane "Unattached modifiers", independently approvable. Attachment is a separate decision the reviewer can make in a later pass; the MVP does not auto-attach across sources when the chalkboard is dish-less.

**Router rule.** A candidate line is a `Modifier` iff it matches `MODIFIER_REGEX = /^\s*(add|extra|with|without|sin|con)\s+.+\s+[+\-]?\$?\d+(\.\d{1,2})?\s*$/i` **or** it appears under a heading matching `/^\s*(extras?|add-ons?|modificadores?|sides?)\s*$/i`. If both conditions fail and the router is uncertain, it returns `needs-review` — never silently promotes a line to `canonical`.

### 2.3 Pydantic domain models (frozen shape)

These are the exact field names and types the backend, frontend, and eval harness all use. `from __future__ import annotations` everywhere. Python 3.11+. No `Any`. All enums closed.

```python
# backend/app/domain/models.py

from __future__ import annotations
from enum import Enum
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict


class ModerationStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    EDITED = "edited"
    REJECTED = "rejected"


class RouteLabel(str, Enum):
    CANONICAL = "canonical"
    MODIFIER = "modifier"
    EPHEMERAL = "ephemeral"
    NEEDS_REVIEW = "needs_review"


class SourceKind(str, Enum):
    PDF = "pdf"
    PHOTO = "photo"
    POST = "post"
    BOARD = "board"


class ReconciliationClass(str, Enum):
    OBVIOUS_MERGE = "obvious_merge"
    OBVIOUS_NON_MERGE = "obvious_non_merge"
    AMBIGUOUS = "ambiguous"


class ProcessingState(str, Enum):
    QUEUED = "queued"
    EXTRACTING = "extracting"
    RECONCILING = "reconciling"
    ROUTING = "routing"
    READY = "ready"
    FAILED = "failed"


# ---------- Evidence ----------

class SourceDocument(BaseModel):
    model_config = ConfigDict(frozen=True)
    id: UUID
    filename: str
    kind: SourceKind
    content_type: str                 # "image/jpeg", "application/pdf", ...
    sha256: str
    width_px: int | None = None
    height_px: int | None = None


class EvidenceRecord(BaseModel):
    """One snippet of raw evidence anchored back to a source."""
    source_id: UUID
    raw_text: str                     # extracted text, unmodified
    span_hint: str | None = None      # e.g. "page 1, line 3" or "top-left tile"


# ---------- Extraction ----------

class DishCandidate(BaseModel):
    id: UUID
    source_id: UUID
    raw_name: str
    normalized_name: str
    inferred_dish_type: str | None    # "pizza", "calzone", "taco", "unknown", ...
    ingredients: list[str] = Field(default_factory=list)
    price_value: float | None = None
    price_currency: str | None = None         # "EUR", "USD", "MXN", ...
    is_modifier_candidate: bool = False       # set by deterministic regex
    is_ephemeral_candidate: bool = False      # set by deterministic heuristic
    evidence: EvidenceRecord


# ---------- Reconciliation ----------

class ReconciliationResult(BaseModel):
    """Output of comparing one PAIR of DishCandidates."""
    left_id: UUID
    right_id: UUID
    gate_class: ReconciliationClass           # prefilter verdict
    merged: bool                              # final decision
    canonical_name: str | None                # set when merged==True
    confidence: float = Field(ge=0.0, le=1.0)
    decision_summary: str                     # human-readable, <=240 chars
    used_adaptive_thinking: bool              # true iff gate_class == AMBIGUOUS


# ---------- Routing ----------

class RoutingDecision(BaseModel):
    candidate_id: UUID
    route: RouteLabel
    parent_dish_id: UUID | None = None        # only meaningful when route==MODIFIER
    decision_summary: str
    confidence: float = Field(ge=0.0, le=1.0)


# ---------- Decision summary (Cockpit-facing) ----------

class DecisionSummary(BaseModel):
    """The product-surface decision. Never contains raw thinking."""
    text: str                                 # one to three sentences
    lead_word: Literal["Merged", "Not merged", "Routed", "Held"]   # UI styling anchor
    confidence: float = Field(ge=0.0, le=1.0)


# ---------- Canonical output ----------

class Modifier(BaseModel):
    id: UUID
    text: str
    price_delta_value: float | None = None
    price_delta_currency: str | None = None
    parent_dish_id: UUID | None = None
    source_ids: list[UUID]                    # where this modifier was observed


class CanonicalDish(BaseModel):
    id: UUID
    canonical_name: str
    aliases: list[str] = Field(default_factory=list)
    ingredients: list[str] = Field(default_factory=list)
    source_ids: list[UUID]                    # provenance back to every source
    modifier_ids: list[UUID] = Field(default_factory=list)
    decision: DecisionSummary
    moderation: ModerationStatus = ModerationStatus.PENDING


class EphemeralItem(BaseModel):
    id: UUID
    text: str                                 # "Chef's Special", "Linguine del giorno", ...
    source_ids: list[UUID]
    decision: DecisionSummary
    moderation: ModerationStatus = ModerationStatus.PENDING


# ---------- Processing run ----------

class ProcessingRun(BaseModel):
    id: UUID                                  # "processing_id"
    batch_id: UUID
    state: ProcessingState
    state_detail: str | None = None           # e.g. "Adaptive thinking engaged on 2 pairs"
    adaptive_thinking_pairs: int = 0          # live counter, for the Cockpit caption
    started_at: str                           # ISO-8601 UTC
    ready_at: str | None = None


class CockpitState(BaseModel):
    """Exactly what GET /api/review/{processing_id} returns."""
    processing: ProcessingRun
    sources: list[SourceDocument]
    canonical_dishes: list[CanonicalDish]
    unattached_modifiers: list[Modifier]      # only modifiers where parent_dish_id is None
    ephemerals: list[EphemeralItem]
    reconciliation_trace: list[ReconciliationResult]   # provenance for the detail rail
    metrics_preview: MetricsPreview | None = None      # populated when eval report exists
    
    
class MetricsPreview(BaseModel):
    """Subset of evals report surfaced in the Cockpit metrics pane."""
    sources_ingested: int
    canonical_count: int
    modifier_count: int
    ephemeral_count: int
    merge_precision: float | None = None
    non_merge_accuracy: float | None = None
    time_to_review_pack_seconds: float | None = None
```

### 2.4 `GET /api/review/{processing_id}` — contract by example

The frontend reads this one endpoint and renders the whole Cockpit. Shape is exactly `CockpitState` serialized. When `processing.state != "ready"`, everything except `processing` and `sources` may be empty lists. When `ready`, nothing is null except explicitly optional fields.

```json
{
  "processing": {
    "id": "b0e2...-...",
    "batch_id": "a1c3...-...",
    "state": "ready",
    "state_detail": "Adaptive thinking engaged on 2 pairs",
    "adaptive_thinking_pairs": 2,
    "started_at": "2026-04-26T16:03:11Z",
    "ready_at": "2026-04-26T16:03:47Z"
  },
  "sources": [ { "id": "...", "filename": "menu_pdf_branch_a.pdf", "kind": "pdf", "content_type": "application/pdf", "sha256": "..." } ],
  "canonical_dishes": [
    {
      "id": "d1...",
      "canonical_name": "Margherita",
      "aliases": ["Marghertia", "Pizza Margherita"],
      "ingredients": ["tomato","mozzarella","basil"],
      "source_ids": ["s_a","s_b","s_c"],
      "modifier_ids": ["m_burrata"],
      "decision": {
        "text": "Merged because the name matched after typo normalization and ingredients matched across two branches.",
        "lead_word": "Merged",
        "confidence": 0.94
      },
      "moderation": "pending"
    }
  ],
  "unattached_modifiers": [
    { "id":"m_guac", "text":"add guacamole +2", "price_delta_value":2.0, "price_delta_currency":"USD", "parent_dish_id": null, "source_ids":["s_chalk"] }
  ],
  "ephemerals": [
    {
      "id":"e_chef",
      "text":"Chef's Special",
      "source_ids":["s_board"],
      "decision": {
        "text":"Routed as ephemeral because no stable name across sources and no fixed price.",
        "lead_word":"Routed",
        "confidence": 0.88
      },
      "moderation":"pending"
    }
  ],
  "reconciliation_trace": [
    { "left_id":"c_a","right_id":"c_b","gate_class":"ambiguous","merged":false,"canonical_name":null,
      "confidence":0.91,"decision_summary":"Not merged with Pizza Funghi because dish type differs despite ingredient overlap.","used_adaptive_thinking": true }
  ],
  "metrics_preview": { "sources_ingested": 10, "canonical_count": 11, "modifier_count": 5, "ephemeral_count": 2,
                       "merge_precision": 1.00, "non_merge_accuracy": 1.00, "time_to_review_pack_seconds": 36.4 }
}
```

---

## 3. API contracts (frozen)

All endpoints return JSON. All 4xx errors use `{ "error": { "code": "...", "message": "...", "request_id": "..." } }`. CORS allows `CORS_ORIGINS` from env. No auth in the MVP.

| Method | Path | Request body | Success | Notes |
|---|---|---|---|---|
| POST | `/api/upload` | `multipart/form-data` files[] (jpg/png/pdf) | `201 { "batch_id": UUID, "sources": [SourceDocument] }` | Limit 10 files, 10 MB each. SHA256 computed server-side. |
| POST | `/api/process/{batch_id}` | empty | `202 { "processing_id": UUID }` | Fire-and-forget; state starts at `queued`. |
| GET | `/api/process/{processing_id}` | — | `200 ProcessingRun` | Poll every 750 ms from Cockpit. |
| GET | `/api/review/{processing_id}` | — | `200 CockpitState` | Always safe to call; returns partial state when not `ready`. |
| POST | `/api/review/{processing_id}/decisions` | `{ "target_kind": "canonical\|modifier\|ephemeral", "target_id": UUID, "action": "approve\|edit\|reject", "edit"?: { ...partial CanonicalDish/Modifier/EphemeralItem... } }` | `200 CockpitState` | Returns the updated Cockpit state so the frontend just re-renders. |

**Cut preemptively (milestone 3).** No `/api/health`, no `/api/sources/{id}` binary streaming — the Cockpit embeds evidence thumbnails as URLs served from a static mount. No pagination — three bundles with <30 canonical dishes each fit in one payload.

---

## 4. Mock data plan (for Cockpit milestone 2)

Location: `frontend/src/mocks/cockpit.ts`. The mock exports a single `CockpitState` that renders the hero frame and the four demo-critical decisions without any backend.

Required entries (every one of them is in the mock, exact strings below):

| Demo-critical decision | Mock entry |
|---|---|
| `Marghertia → Margherita` merge | `CanonicalDish` with `canonical_name: "Margherita"`, `aliases: ["Marghertia","Pizza Margherita"]`, decision `lead_word: "Merged"`, confidence `0.94`. Three `source_ids` pointing to `menu_pdf_branch_a.pdf`, `menu_photo_branch_b.jpg`, `chalkboard_branch_c.jpg`. |
| `Pizza Funghi ≠ Calzone Funghi` non-merge | Two `CanonicalDish` entries side by side. `reconciliation_trace` has one `ReconciliationResult` with `merged:false, gate_class:"ambiguous", used_adaptive_thinking:true`, decision text on the Calzone card: *"Not merged with Pizza Funghi because dish type differs despite ingredient overlap."* |
| `add burrata +3` modifier | One `Modifier` with `parent_dish_id` pointing to the Margherita canonical. Rendered as a chip under the Margherita card. |
| `Chef's special` ephemeral | One `EphemeralItem` in its own lane. Decision text: *"Routed as ephemeral because no stable name across sources and no fixed price."* |

Hero-frame bundle reuses the three Italian sources above. The mock file also ships `adaptive_thinking_pairs: 2` so the processing caption demo works before the backend exists.

---

## 5. Implementation order (milestones 2-4 mapped to bite-sized tasks)

Each task below is 20-60 minutes. The timeline doc budgets ~3h per milestone block; these bite-sizes fit inside.

### Milestone 2 — Cockpit (Wed afternoon → Thu EOD)

1. **T2.1 — Scaffold Vite+TS+Tailwind v4+shadcn.** Install `@fontsource/fraunces`, `@fontsource/instrument-serif`, `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono` with only the weights in `docs/cockpit_visual_direction.md`. `@theme` block in `src/styles/index.css` exposes the color + font tokens as CSS vars. Acceptance: `npm run dev` opens `127.0.0.1:5173`, page shows "Mise" in Fraunces 500 against `paper` background. Skills: `vite`, `tailwind-design-system`, `shadcn`.
2. **T2.2 — Domain types mirror backend.** Port the Pydantic models from §2.3 to `frontend/src/domain/types.ts` as TypeScript types. Skills: `typescript-advanced-types`.
3. **T2.3 — Mock `CockpitState`.** Author `frontend/src/mocks/cockpit.ts` with the four demo-critical entries from §4. One typed export `mockCockpit: CockpitState`.
4. **T2.4 — Cockpit three-column layout.** Evidence rail (left), canvas with dish cards (middle), detail rail (right). Width/tokens from `docs/cockpit_visual_direction.md`.
5. **T2.5 — Canonical dish card.** Exact visual contract from the visual direction doc. Confidence in Plex Mono tabular-nums, two decimals, color by band (`gold-leaf` / `ink` / `sienna`). `Instrument Serif` italic for lead word and for typo'd aliases.
6. **T2.6 — Modifier chip + unattached modifiers lane.** Chip style per visual direction. Unattached lane appears only when the array is non-empty.
7. **T2.7 — Ephemeral lane.** `ochre` chip. Distinct header in Fraunces 500.
8. **T2.8 — Approve / Edit / Reject actions.** Local state only. Chip color follows `docs/cockpit_visual_direction.md` semantic map. `120ms` fade.
9. **T2.9 — Hero frame overlay.** Triggered by top-bar "Present" button. Two equal columns, signature phrase in Fraunces 500 40px with Instrument Serif italic flourish on "trustworthy".
10. **T2.10 — Upload view + Processing view.** Drag-drop area. Processing view polls `processing.state` (reads the mock for now). Caption "Adaptive thinking engaged on {n} pairs" when `adaptive_thinking_pairs > 0`.
11. **T2.11 — webapp-testing smoke.** Headless browser opens `/`, asserts: Margherita card visible with "Marghertia" alias, Funghi-vs-Calzone both visible, burrata chip rendered, ephemeral lane populated, Present button opens hero overlay. Skill: `webapp-testing`.

**Gate 2 acceptance.** Same as the acceptance in `2nd_prompt.md` — re-read it before closing.

### Milestone 3 — Backend shell (Fri)

12. **T3.1 — Scaffold FastAPI.** Python 3.11, `pip-tools`-style `requirements.txt`, `pyproject.toml` with ruff + pytest config. Skill: `fastapi-templates`.
13. **T3.2 — `app/domain/models.py`.** Paste the §2.3 models verbatim. TDD: a round-trip test `model_validate(model_dump())` for every class.
14. **T3.3 — `app/domain/fixtures.py`.** The backend's mock `CockpitState` identical to the frontend mock (same UUIDs, same strings). This lets the Cockpit swap fetch URLs in-place in milestone 3 acceptance.
15. **T3.4 — Upload endpoint.** Multipart → compute SHA256 → return `{batch_id, sources}`. Reject non-image/pdf mime types. TDD first.
16. **T3.5 — Process endpoint + in-memory run store.** `ProcessingRun` state machine advances on a background task that sleeps (mock-mode only — real pipeline arrives in milestone 4). Returns `processing_id`.
17. **T3.6 — Process GET endpoint.** Returns the current `ProcessingRun` object.
18. **T3.7 — Review GET endpoint.** Returns the fixture `CockpitState` keyed by the processing_id. TDD asserts all four demo-critical decisions are in the payload.
19. **T3.8 — Decisions POST endpoint.** Mutates moderation status on the in-memory state, returns new `CockpitState`.
20. **T3.9 — CORS + env config.** Read `CORS_ORIGINS`, `ANTHROPIC_MODEL`, `API_HOST`, `API_PORT` from env. Skill: `fastapi-python`.
21. **T3.10 — Cockpit swap.** Set `VITE_API_BASE=http://127.0.0.1:8000` in frontend, remove direct mock import on the happy path (mock remains as the Storybook fallback). Acceptance: Cockpit renders the four decisions from the running backend.

**Gate 3 acceptance.** Per `3rd_prompt.md`.

### Milestone 4 — AI integration (Sat)

22. **T4.1 — `backend/app/ai/client.py`.** `anthropic.Anthropic()` client. Reads `ANTHROPIC_MODEL` (default `claude-opus-4-7`). All calls stream with `.get_final_message()`. System prompts wrapped in `{"type":"text","text": SYSTEM_PROMPT, "cache_control":{"type":"ephemeral"}}` so caching kicks in across eval runs. No `budget_tokens`, no `temperature`, no `top_p`, no `top_k`.
23. **T4.2 — Extraction wrapper (`app/ai/extraction.py`).** Single call per `SourceDocument`. For PDFs and images, the user message includes one `{"type":"image","source":{"type":"base64","media_type":...,"data":...}}` content block (PDFs are converted to base64 too — Opus 4.7 reads them natively). System prompt stored at `app/ai/prompts/extraction.md`. Output constrained via `output_config:{format:{type:"json_schema","json_schema":{...}}}` matching `list[DishCandidate]`. Response parsed with `client.messages.parse(..., response_model=ExtractionResponse)`. Skill: `claude-api`, `prompt-engineering-patterns` (Pattern 1 only — translate LangChain snippets).
24. **T4.3 — Deterministic reconciliation prefilter (`app/reconciliation/gate.py`).** Implements §2.1 exactly. Pure Python, no LLM. TDD with the four demo-critical cases plus Tacos-reorder case.
25. **T4.4 — Reconciliation wrapper (`app/ai/reconciliation.py`).** Takes the `AMBIGUOUS` pairs from the gate, issues one Opus call per pair with `thinking:{type:"adaptive"}` and `output_config:{effort:"xhigh"}`. `OBVIOUS_*` pairs resolve without a call. Output parsed into `ReconciliationResult`. Updates `ProcessingRun.adaptive_thinking_pairs` live.
26. **T4.5 — Routing wrapper (`app/ai/routing.py`) — OPTIONAL PATH.** Deterministic regex-first (see §2.2). On the three MVP bundles the regex is expected to cover every line; if it does, this task's LLM branch stays untouched in the demo. Only lines the regex cannot classify confidently fall through to Opus with `thinking:{type:"adaptive"}` + `effort:"high"`. If this task runs out of budget, ship the regex-only version and mark the LLM branch as stretch — nothing on the acceptance-criteria path depends on it firing.
27. **T4.6 — Validation layer (`app/domain/validators.py`).** Takes any AI-shaped dict, enforces enum membership, required fields, `confidence ∈ [0,1]`, `decision_summary` length ≤ 240. One retry with tightened system prompt on validation failure; second failure raises.
28. **T4.7 — Wire pipeline.** Replace the sleep-based mock pipeline from T3.5 with the real one: extraction → gate → reconciliation → routing → validation → store.
29. **T4.8 — Eval harness (`evals/run_eval.py`).** Accepts `--bundle {name|all}`. Runs pipeline on every evidence file in the bundle, computes the metrics defined in `docs/evals.md`, writes `evals/reports/<date>.json` and a Markdown report. TDD against a tiny synthetic bundle `evals/datasets/bundle_00_smoke/` not committed to submission.
30. **T4.9 — Wire metrics preview into the Cockpit.** Backend reads the most recent report, populates `CockpitState.metrics_preview`. Frontend renders the metrics pane from that block. No other source of numbers.
31. **T4.10 — Prompt caching audit.** Verify `usage.cache_read_input_tokens > 0` on the second run of each prompt. If zero, read `shared/prompt-caching.md` and audit for silent invalidators (timestamps, unsorted JSON).

**Gate 4 acceptance.** Per `4th_prompt.md`. Plus: `merge_precision == 1.00` on the four demo-critical cases in the shipped report.

---

## 6. Verification plan (per layer)

| Layer | How it is verified | Command or UI step |
|---|---|---|
| Extraction | Unit tests mock the SDK at the boundary; snapshot the parsed `list[DishCandidate]` for a fixed PDF and a fixed image. | `pytest backend/tests/test_ai_extraction.py -v` |
| Deterministic gate | Table-driven tests for the 4 demo-critical cases plus Tacos reorder. | `pytest backend/tests/test_reconciliation_gate.py -v` |
| Reconciliation (LLM branch) | Integration test over bundle 01 with a deterministic Opus seed (cache-read). Asserts `Pizza Funghi` ≠ `Calzone Funghi`. | `pytest backend/tests/test_ai_reconciliation.py -v -m integration` |
| Routing | Unit tests for regex classifier + integration for bundle 02 modifier-only chalkboard. | `pytest backend/tests/test_ai_routing.py -v` |
| Validation | Unit tests inject malformed dicts, expect retry then hard fail. | `pytest backend/tests/test_validators.py -v` |
| API | `pytest backend/tests/test_api_*.py` covering the five endpoints. | `pytest backend/tests/ -v` |
| Cockpit | Webapp smoke test verifies the four decisions render. Visual check of hero frame at 1440×900. | `python evals/webapp_smoke.py` (built in T2.11) |
| Evals | `evals/run_eval.py --bundle all` emits a report; all four demo-critical decisions pass. | See `docs/evals.md`. |

---

## 7. Self-review against this plan

Checklist ran 2026-04-21.

- [x] Every strategy-doc ambiguity (gate, modifier without parent, Pydantic shapes, review endpoint shape) has a concrete rule or JSON example in this plan.
- [x] Opus 4.7 breakage (thinking, temperature, prefill, output_config) is called out in §0 and propagated into §5 task T4.1-T4.5.
- [x] Every layer has a verification command.
- [x] The four demo-critical decisions appear in the mock (§4) and in a test (§6).
- [x] No step mentions LangChain, LlamaIndex, external OCR, or Managed Agents in the MVP path.
- [x] Task bite-size is 20-60 minutes each. No step is "implement the rest".
- [x] Types referenced in later tasks are defined in earlier tasks (§2.3 before §5).
- [x] No placeholders, no "TBD".

---

## 8. User review gate

Before this plan is considered approved, the user must confirm:

1. The deterministic gate thresholds (§2.1) — `lev_ratio ≤ 0.25`, `jaccard ≥ 0.60` — are acceptable as fixed values for the MVP.
2. The Cockpit lane for unattached modifiers (§2.2) is acceptable as a distinct UI element (alternative: roll them into a generic "needs review" bucket).
3. The Opus 4.7 API shape corrections in §0 are treated as authoritative over the strategy docs (I recommend yes).

If the user approves as-is, the next step is to invoke `executing-plans` on milestone 2 when the Gate 1 checklist is green.
