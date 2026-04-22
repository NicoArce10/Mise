# Mise — Hackathon Written Summary

> Target length: 100–200 words. Keep the primary summary tight. All supplementary material lives below the rule.

## Summary (≈180 words)

**Any menu. Any language. Ask like a customer.** Mise takes any restaurant menu — a PDF, a photo, a chalkboard, an Instagram screenshot — and turns it into a searchable dish graph you can query in natural language, in whatever language the market speaks.

Upload the menu and Claude Opus 4.7 reads it vision-natively (no OCR), extracting every dish with canonical names, aliases, local vernacular search terms, categories, prices, modifiers, and source evidence. Then the real demo begins: you ask the menu the way a customer would — *"something veggie that isn't a salad"*, *"a burger like a quarter-pounder"*, *"mila napo abundante"*, *"ramen light de shio"*. Opus 4.7 interprets the intent, honors exclusions, and returns only dishes actually on the menu — each match explained in one line, never invented.

Four pillars of Opus 4.7 are visible in the product: **vision-native ingestion** (no external OCR), a **dish graph written by the model** with aliases and diner-style search terms, **natural-language search with adaptive thinking** only when the query is ambiguous, and **structured outputs** validated by Pydantic before anything reaches the UI.

Not a menu parser. A menu you can talk to.

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

1. **Vision-native ingestion** — PDFs sent as `document` blocks, photos as base64 `image` blocks. No external OCR.
2. **A dish graph, written by the model** — the extractor acts as a local food writer and produces aliases (`mila napo`, `Marga`, `Funghi`) and diner-style search terms (`algo veggie que no sea ensalada`) directly from the evidence.
3. **Natural-language search with adaptive thinking** — a deterministic gate keeps obvious lookups cheap; `thinking: {"type": "adaptive"}` fires only when the query has exclusions, analogies, or multi-constraint intent.
4. **Structured output with deterministic validation** — every response is constrained by a JSON schema, parsed into Pydantic, and re-validated before reaching the UI. Reasoning and safety are architecturally separate.

### Measured (reproducible)

Search is graded against an evidence-grounded golden set of 12 vernacular queries and 3 negative queries the menu cannot satisfy (`evals/search_golden.json`). The deterministic fallback path lands:

- **top-1 accuracy: 1.0** (12 / 12 queries resolve the intended dish first)
- **top-3 accuracy: 1.0**
- **zero-invention rate: 1.0** (3 / 3 negatives return no matches instead of hallucinating)

Reproduce end-to-end with `python evals/run_search_eval.py --mode fallback`. The run writes `submissions/metrics.json`. No invented figures — if the fallback accuracy drops under 0.75, the harness exits non-zero.

### Links

- Repo: <https://github.com/NicoArce10/Mise>
- License: MIT (see `LICENSE`)
- Demo video: `<YouTube unlisted URL — filled on submission day>` (≤ 3:00)
- Live metrics: `submissions/metrics.json`

### Why this problem — and the Dishy tie-in

The builder applied to Y Combinator with **Dishy**, a personal-project review app where you rate individual dishes (not restaurants). Dishy is in closed beta. The single hardest problem in Dishy's roadmap was always the same one: *how do you onboard a restaurant without asking its owner to manually type every item into your system?* Delivery platforms face the same wall for every restaurant that isn't on a compatible POS. Review apps face it every time a user wants to review a dish that isn't in the database. Voice agents face it every time a customer says *"mila napo con papas"* instead of `item-id-42`.

Mise is the service the builder wished had existed.

It does not share code, schema, or data with Dishy. It is an independent, open-source engine. But the narrative anchor of the demo — *"one JSON call, the catalog is yours"* — comes from having lived the inverse experience: manually loading menus, restaurant by restaurant, and knowing exactly how many teams pay humans to do this every day.

### Acknowledgement

The ingestion engine, the dish graph schema, the search layer, and all frontend surfaces were built from scratch during the hackathon. Personal restaurant menus used in the demo are the builder's own (or used with explicit written permission) and are not committed to the public repository. No Dishy code, data, schema, or assets are used, referenced, or mirrored inside Mise's repo.

<!--
Authoring checklist (delete before submitting):
- [ ] Primary summary above the rule is 100–200 words (current target ≈180)
- [ ] Every claim maps to a visible element in the demo video
- [ ] No reuse of prior-product code, schema, or assets
- [ ] If a real menu is shown, written permission is on file
- [ ] Repo URL verified incognito
- [ ] Video URL verified incognito
-->
