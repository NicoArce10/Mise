# Competitive benchmark & market map

This document has two parts:

1. A **market map** of every serious player in menu ingestion / sync /
   enrichment, so judges can see where Mise sits in the landscape
   without needing to do their own research.
2. The **methodology** for `evals/run_competitor_bench.py`, which
   reproduces the capability claims on the landing page with your own
   API credentials.

## 1 · Market map

The "menu software" space is not a single market. It splits cleanly
into three layers. Mise sits in the first. We do not compete with the
other two — in most cases we plug into them.

### Layer 01 · Ingestion (photo / PDF → structured JSON)

| Player | Access | Tech | Output shape | Notes |
|--------|--------|------|--------------|-------|
| **Mise** | Open source, self-hosted | Vision-native, single Opus 4.7 call | Dishes + aliases + search terms + canonical vs LTO lane | This repo. |
| [Veryfi Menu OCR API](https://www.veryfi.com/restaurant-menu-ocr-api/) | Commercial, $500/mo min | OCR → NLP | `dish_name`, `dish_price`, `menu_section`, `dish_description` | SOC 2 Type II. Mature infra. No aliases, no search terms, no LTO lane. |
| [Klippa DocHorizon Menu OCR](https://klippa.com/en/ocr/data-fields/menu-cards) | Commercial, custom quote | OCR → TXT → NLP | Dishes + categories + prices | ISO + GDPR certified. 100+ languages. Same shape as Veryfi: flat dish list. |
| [DoorDash internal pipeline](https://careersatdoordash.com/blog/doordash-llm-transcribe-menu/) | **Internal only — not an API** | OCR → LLM, **guardrail (LightGBM classifier)**, human reviewer fallback | DoorDash's internal menu schema | The most sophisticated pipeline documented publicly. Source: DoorDash engineering blog (official). We cover this at length below because it is the conceptual benchmark. |
| Side projects: [Menu_Reader](https://github.com/AlexBandurin/Menu_Reader), [Restabot](https://geneea.com/news/restabot-taming-restaurant-menus-with-ai), [taaruff MenuReader](https://taaruff.com/ai-agent/), Medium tutorials | Open source / concept | Varies (EasyOCR + XGBoost, Gemini vision, etc.) | Flat dish list | Useful as validation that the problem is real. Not commercial competitors. |

### Layer 02 · Sync (already-digital menu → POS + delivery channels)

These tools assume the menu already exists as structured data. They
distribute it across channels and keep it in sync.

| Player | What they do |
|--------|--------------|
| [Deliverect](https://developers.deliverect.com/reference/menu_update) | Webhook-based sync between POS (source of truth) and delivery channels. Publishes JSON containing products, categories, availabilities, PLUs. |
| [Checkmate (EveryWare)](https://itsacheckmate.com/blog/eliminate-chaos-menu-syncing-best-practices-for-modern-restaurants) | 50+ POS integrations, LTOs scheduling, dayparts, centralised menu admin panel. |
| Otter, Olo, ItsaCheckmate | Similar multi-channel menu distribution. |

**These are potential Mise customers, not competitors.** The ingestion
layer is a precondition for their sync product. A restaurant without a
POS cannot publish to Deliverect — but could publish to Mise, and
Mise's JSON is the exact shape Deliverect expects.

### Layer 03 · Enrichment (existing online menu → better copy / photos)

| Player | What they do |
|--------|--------------|
| [Uber Eats AI tools](https://www.theverge.com/news/716578/uber-eats-ai-menu-photo-description-features) | Generates menu item descriptions, enhances food photos, summarises customer reviews. |
| [DoorDash merchant AI tools](https://about.doordash.com/en-us/news/doordash-unveils-ai-powered-tools-to-enhance-online-menus-and-streamline-merchant-operations) | AI-powered item description generator, AI camera, instant photo approvals, background enhancement. |

These operate on menus that are **already live**. They are orthogonal
to ingestion.

### Layer X · Data brokers / scrapers

| Player | What they do |
|--------|--------------|
| [Apify actors](https://apify.com/wedo_software/wedo-scrape-menu), [Food Data Scrape](https://lnkd.in/dzgByxqQ), Actowiz, iWeb Data Scraping, Retail Scrape, Web Data Crawler | Scrape menus from public-facing delivery apps (UberEats, DoorDash, Grubhub) to sell market-intelligence datasets. |

Different segment — they extract menus that are already online, for
analytics. They don't help a restaurant get **onto** those platforms.

---

## 2 · The DoorDash benchmark

DoorDash is the conceptual competitor worth understanding deeply
because they are the only player that has solved the end-to-end
problem. Their pipeline is documented in detail on the
[DoorDash engineering blog](https://careersatdoordash.com/blog/doordash-llm-transcribe-menu/)
(the primary source), with additional analysis on the
[ByteByteGo blog](https://blog.bytebytego.com/p/how-doordash-uses-ai-models-to-understand)
and the
[ZenML LLMOps database](https://www.zenml.io/llmops-database/building-a-guardrail-system-for-llm-based-menu-transcription).

> **Why this matters for a "has it already been solved?" sanity check.**
> DoorDash built a production system that works at scale. Nothing below
> is meant to imply their approach is outdated or inferior — it was the
> right architecture for the models available when it was designed, and
> it still runs millions of menus. Mise's claim is narrower: **what
> DoorDash had to compose as a pipeline with traditional ML, Opus 4.7
> lets an integrator request with a single API call**. That shape
> change is what opens up the non-DoorDash part of the market (every
> other delivery platform, menu sync tool, aggregator, or restaurant
> stack).

### What they built

```
Menu photo
   │
   ├──► OCR → LLM pipeline ──────────┐
   │                                  ├──► Guardrail (LightGBM classifier)
   └──► Multimodal GenAI in parallel ─┘         │
                                                ├── pass → publish automatically
                                                └── fail → human-in-the-loop
```

The guardrail is trained on three feature families:

1. Image-level features (lighting, blur, layout complexity).
2. OCR-derived features (token consistency, confidence scores).
3. LLM-output features (internal consistency of the transcription).

DoorDash's finding was counterintuitive: **LightGBM on these tabular
features beat ResNet, ViT, and DiT** — because labelled training data
was the bottleneck, not model capacity.

### What Mise has vs what Mise doesn't

| Part of DoorDash's system | Mise status |
|----------------------------|-------------|
| Vision + structured extraction | ✅ Covered in one Opus 4.7 call (no separate OCR stage). |
| Aliases / search terms / LTO separation | ✅ Mise adds these; DoorDash's public writeups don't mention them. |
| Adaptive effort on ambiguous cases | ✅ Mise uses Opus 4.7 adaptive thinking for this. |
| **Guardrail predicting own failure** | ✅ Mise ships a heuristic guardrail (`app/core/quality.py`). Every catalog export carries a `quality_signal` with `status`, `confidence`, and concrete reasons. DoorDash uses a trained LightGBM classifier; Mise uses hand-tuned heuristics because a hackathon MVP can't train on labeled data — same shape, different backend. |
| Human-in-the-loop moderation | ✅ The Cockpit view supports Approve/Edit/Reject on every dish; the guardrail verdict drives which runs should be routed to a reviewer before publication. |

**Honest take:** DoorDash's guardrail is trained on years of labeled
outcomes; Mise's is seven hand-written rules covering the failure modes
we actually hit in dev (low dish count, most prices missing, skeleton
ingredient lists, 3.5×MAD price outliers, near-duplicate canonicals that
escaped merge, partial source failure). When a run comes back with
`status: "likely_failure"`, downstream systems should route it to a
reviewer — exactly the escalation path DoorDash uses.

The upgrade path is straightforward: swap `evaluate_quality` for a
classifier's `predict_proba` once labeled transcription-quality data
exists. The rest of the pipeline doesn't change, because the guardrail
is contracted behind a single Pydantic model (`QualitySignal`).

---

## 3 · The reproducible harness

`evals/run_competitor_bench.py` lets anyone reproduce the
capability-grid claims on the landing page.

### What the script does

1. Picks the first menu file from a bundle
   (e.g. `evals/datasets/bundle_01_italian/evidence/menu_pdf_branch_a.pdf`).
2. Sends it through the Mise pipeline via `app.pipeline.run_pipeline`.
   This is the **same pipeline** `/api/process` uses.
3. Optionally sends the same file to Veryfi's
   `v8/partner/menus/` endpoint.
4. Times both calls end-to-end, counts dishes, and records which of
   five downstream-relevant fields are present.
5. Writes a Markdown + JSON report under `evals/reports/`.

### The five scored fields

| Field | Why it matters |
|-------|----------------|
| **Dishes returned** | Raw coverage. If an engine drops half the menu, everything downstream suffers. |
| **Aliases** | Whether each dish ships with synonyms / shorthand (`"margarita"`, `"mila napo"`). Without this, you build a hand-curated alias table per restaurant. |
| **Search terms** | Diner vernacular — `"breaded cutlet"`, `"ham cheese tomato"`. This is the bridge between an arbitrary query and the canonical name. |
| **Daily-specials lane** | Whether LTOs / chef suggestions / seasonal inserts are surfaced in a separate bucket. Without this, a Tuesday's special stays in the canonical menu forever. |
| **Latency** | Wall-clock from upload to structured JSON. |

Each claim on the landing page's **"How Mise compares"** section
traces back to a row in one of these reports.

### Running the harness

#### Mise only (no third-party accounts needed)

```bash
python evals/run_competitor_bench.py \
    --bundle bundle_01_italian \
    --mise-mode real
```

Requires `ANTHROPIC_API_KEY` in `.env`.

#### Mise + Veryfi

1. Sign up at <https://www.veryfi.com/signup/>.
2. Grab the four credentials from the Veryfi dashboard
   (`CLIENT_ID`, `CLIENT_SECRET`, `USERNAME`, `API_KEY`).
3. Export them as env vars and run with `--with-veryfi`:

   ```bash
   export VERYFI_CLIENT_ID=...
   export VERYFI_CLIENT_SECRET=...
   export VERYFI_USERNAME=...
   export VERYFI_API_KEY=...
   python evals/run_competitor_bench.py \
       --bundle bundle_01_italian \
       --mise-mode real \
       --with-veryfi
   ```

Veryfi's Menu Parser is priced per document; the free trial covers a
handful of requests — enough to reproduce any single bundle in this
repo.

### What the report proves (and what it doesn't)

- ✅ For the exact same input file, what each engine returns and how
  long it takes.
- ✅ Field-by-field, which downstream-relevant fields are populated
  on the **first call** versus requiring post-processing.
- ⚠️ It does not grade accuracy of individual dish transcriptions
  against a ground-truth set. That belongs in `evals/run_eval.py`,
  which has its own `expected.json` files.
- ⚠️ Latency is wall-clock, not p95. For production deployments,
  run the harness N times and aggregate.
- ⚠️ Klippa is not yet wired into the script — their API requires
  paid access. The claims about Klippa in the landing grid are sourced
  directly from their [public menu-OCR product page](https://klippa.com/en/ocr/data-fields/menu-cards)
  and their [how-to blog](https://klippa.com/en/blog/information/automatically-scan-menu-cards-with-ocr-ml-for-market-research-and-competitor-analyses).

### Extending to other engines

`_run_veryfi` is intentionally small. Copy it to add Klippa
(`api.klippa.com/.../parseDocument/financial`), a cloud-OCR vendor,
or your own stack. As long as the new function returns an
`EngineResult`, the report layout stays consistent.

## The tables on the landing page

The comparison grid in `frontend/src/views/Landing.tsx` reflects
**published capabilities** of each engine's public docs, not scored
benchmark outputs. The intent is to answer "what comes back on the
first call?" — which is the decision a platform integrator actually
makes. For latency / coverage comparisons, run this harness.
