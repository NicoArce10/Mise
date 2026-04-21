"""AI integration for Mise — Anthropic Messages API with claude-opus-4-7.

Call sites (architecture §1):
- `extraction.extract_from_source` — vision-native, one call per SourceDocument
- `reconciliation.reconcile_pair` — gate-filtered; adaptive thinking on AMBIGUOUS
- `routing.route_candidate` — deterministic regex; LLM fallback is stubbed
"""
