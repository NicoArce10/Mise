"""Deterministic reconciliation helpers.

`gate.classify_pair` is the §2.1 prefilter — pure Python, no LLM.
"""
from .gate import classify_pair, dish_type, jaccard, lev_ratio, normalize, tokens

__all__ = [
    "classify_pair",
    "dish_type",
    "jaccard",
    "lev_ratio",
    "normalize",
    "tokens",
]
