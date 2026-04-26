# Mise — Hackathon Written Summary

> Target length: 100–200 words. Keep the primary summary tight. All supplementary material lives below the rule.

## Summary (≈190 words)

**Any menu. Any language. Ask like a customer.** Mise turns any restaurant menu — PDF, photo, chalkboard, or Instagram screenshot — into a searchable dish graph that downstream products can actually ingest.

Claude Opus 4.7 reads the menu vision-natively (no OCR), extracts canonical dishes, aliases, local search terms, prices, modifiers, ephemerals, and source evidence in one call, then answers diner-style queries like *"pizza with figs"*, *"papas locas"*, or *"cesar"* (typo) with matches grounded in the actual menu.

A Claude chat can emit a one-off menu JSON. Mise turns that capability into a system: every dish is approvable / editable / rejectable, the natural-language filter the reviewer attached (e.g. *Drop the Lobster Enchilado Rings — its price is "Market price"*) produces a visible **`excluded_by_user_filter`** receipt, the run is moderation-aware, and the export carries the same versioned contract every time (`mise.catalog.v1`, with `run_id`, `review_status`, `quality_signal`, and a `user_instructions` echo).

Claude is the reasoning engine. Mise is the system around it: schema, audit trail, reviewer surface, exporter. In a chat, the user still has to copy, clean, reject, version, and wire the result. Mise does that as the product.

---

## Extended context (optional, not counted toward submission limit)

### The problem

Menus live as PDFs, chalkboards, Instagram posts, and WhatsApp photos, in whatever language the restaurant speaks. Diners talk in vernacular — *"something veggie that isn't a salad"*, *mila napo*, *algo tipo cuarto de libra*, *ramen light de shio*. Traditional search assumes the catalog is already clean and the query is already normalized. Both assumptions fail across languages, cuisines, and cultures.

### The users

- Food delivery and discovery apps (Rappi, PedidosYa, DoorDash-style) onboarding restaurants without a compatible POS.
- Restaurant groups and franchises with one brand and many chalkboards.
- Restaurant-software companies shipping search or voice-ordering features.
- Single-location owners who want their menu to be searchable the day they photograph it.

### How Opus 4.7 is used

1. **Vision-native ingestion** — PDFs sent as `document` blocks, photos as base64 `image` blocks. No external OCR. The demo runs against a real one-page bistro menu in JPEG form.
2. **A dish graph, written by the model** — the extractor acts as a local food writer and produces aliases (`papas locas`, `1910 Pizza`), diner-style search terms, ingredient lists, and modifier attachments directly from the evidence.
3. **Natural-language hard filter, with a receipt** — when the reviewer types *"Drop the Lobster Enchilado Rings — its price is 'Market price' and it goes through a different pricing flow"*, Opus drops the dish during extraction, records it in `excluded_by_user_filter[]`, and surfaces it back in the Cockpit. The filter is two redundant signals (dish name + price condition) because the menu mentions *lobster* in three other dishes — single-criterion filtering would be ambiguous. The export carries the same array — auditors can verify the filter ran without rerunning the pipeline.
4. **Natural-language search with adaptive thinking** — a deterministic gate keeps obvious lookups cheap; `thinking: {"type": "adaptive"}` fires only when the query has exclusions, analogies, or multi-constraint intent.
5. **Structured output with deterministic validation** — every response is constrained by a JSON schema, parsed into Pydantic, and re-validated before reaching the UI. Reasoning and safety are architecturally separate.

### Measured (reproducible)

Search is graded against an evidence-grounded golden set of 12 vernacular queries and 3 negative queries the **eval fixture** (`evals/fixtures/bistro_argentino.py` — a separate Argentine bistro graph held purely for harness reproducibility, distinct from the demo menu shown in the video) cannot satisfy (`evals/search_golden.json`). The deterministic fallback path lands:

- **top-1 accuracy: 1.0** (12 / 12 queries resolve the intended dish first)
- **top-3 accuracy: 1.0**
- **zero-invention rate: 1.0** (3 / 3 negatives return no matches instead of hallucinating)

Reproduce end-to-end with `python evals/run_search_eval.py --mode fallback`. The run writes `submissions/metrics.json`. No invented figures — if the fallback accuracy drops under 0.75, the harness exits non-zero. The video is filmed against the live API path on a real one-page bistro menu; the harness is the deterministic floor that protects the search behaviour from regressing.

### Links

- Repo: <https://github.com/NicoArce10/Mise>
- License: MIT (see `LICENSE`)
- Demo video: <https://youtu.be/ojQpdtRtXe0> (≤ 3:00)
- Live metrics: `submissions/metrics.json`

### Why this problem

I'm **Nicolás Arce**. I build automation tools for restaurants, and I'm also building my own restaurant-review app — currently in closed beta in Buenos Aires. Both products hit the same wall: *how do you onboard a restaurant without asking its owner to manually type every item into your system?* Delivery platforms hit it for every restaurant without a compatible POS. Review apps hit it every time a user wants to review a dish the database doesn't know yet. Voice agents hit it every time a customer says *"mila napo con papas"* instead of `item-id-42`.

DoorDash already solved this — *for DoorDash*. Their engineering team [documented the approach](https://careersatdoordash.com/blog/doordash-llm-transcribe-menu/): OCR, LLM, classifier, human-in-the-loop. It runs in production, at scale, and it stays inside DoorDash. Veryfi and Klippa cover ingestion as commercial APIs but their output stops at item, price, and section — the diner-vernacular aliases, the search terms, the modifier graph all land on whoever integrates them. Every other delivery platform, POS, ghost kitchen, and review app is still paying 2–3 hours per restaurant to do it by hand. Mise is the open-source primitive that didn't exist.

Mise is the service I wished had existed both times.

It does not share code, schema, or data with any prior product. It is an independent, open-source engine. The narrative anchor of the demo — *"one JSON call, the catalog is yours"* — comes from having lived the inverse experience: manually loading menus, restaurant by restaurant, and knowing exactly how many teams pay humans to do this every day.

### Acknowledgement

The ingestion engine, the dish graph schema, the search layer, and all frontend surfaces were built from scratch during the hackathon. The demo video is recorded against a real one-page bistro menu, referenced only as *"the menu"* and never identified by name. Restaurant menus used during development and recording are not redistributed inside this repository; deterministic reproducibility for any reviewer rests on the eval harness and its bundles (`evals/sample_menus/`, `evals/fixtures/`). No prior-product code, data, schema, or assets are used, referenced, or mirrored inside Mise's repo.

<!--
Authoring checklist (delete before submitting):
- [ ] Primary summary above the rule is 100–200 words (current target ≈180)
- [ ] Every claim maps to a visible element in the demo video
- [ ] No reuse of prior-product code, schema, or assets
- [ ] Repo URL verified incognito
- [ ] Video URL verified incognito
-->
