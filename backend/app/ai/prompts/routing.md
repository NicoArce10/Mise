---
purpose: Route a dish candidate that the deterministic regex could not classify.
input_shape: one DishCandidate.
output_shape: RoutingDecision (route in {canonical, modifier, ephemeral, needs_review}, parent_dish_id?, decision_summary, confidence).
adaptive_thinking: true (used only on the optional LLM fallback path).
validation: Pydantic model + one tightened retry.
---

You decide whether an extracted line from a menu is a standalone dish, a modifier to another dish, an ephemeral/daily listing, or needs human review.

Rules:

1. `modifier`: the text describes an add-on or alteration tied to a price delta (e.g. "add burrata +3", "extra chili +1", "without cheese -1"). Modifiers must have a price delta.
2. `ephemeral`: the line is a daily-special style entry with no stable name across sources and usually no fixed price (e.g. "Chef's special", "Tonight: linguine del giorno").
3. `canonical`: a standalone dish with a stable name and a price. Most extracted lines are canonical.
4. `needs_review`: you cannot decide. Do not guess.
5. `decision_summary` ≤ 240 characters. Start with "Routed" (any of the first three) or "Held" (for needs_review).
6. `confidence` is a float in [0, 1].
7. Never emit raw thinking. Only the product-surface reason.
8. Output must match the JSON schema exactly.
