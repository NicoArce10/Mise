# Mise Product Brief

## Hero line
Any menu. Any language. Ask like a customer.

## One sentence
Mise is a dish understanding engine: it turns any restaurant menu — PDF, photo, chalkboard, social post — into a searchable dish graph you can query in natural language.

## Problem
Menus live as PDFs, chalkboards, Instagram screenshots, and WhatsApp photos.
Even a beautifully laid-out PDF is useless for search: the dishes are printed, not indexed.
And diners don't ask for food the way catalogs are organized.

Once this mismatch exists:
- traditional search misses real intent (*algo veggie que no sea ensalada*)
- vernacular aliases (*mila napo*, *lomito completo*, *provo*) never make it into the index
- analogies (*lomito como steak sandwich*) are impossible to resolve
- dishes stay trapped in the file format they were saved in

## What Mise does
1. **Ingests** any menu — PDFs, photos, chalkboards, social posts — vision-natively through Opus 4.7.
2. **Extracts** dish candidates plus aliases and diner-style search terms written by the model as it reads the evidence.
3. **Builds** a dish graph with canonical names, categories, prices, modifiers, ingredients, and source provenance.
4. **Answers** natural-language queries against that graph — honoring exclusions, analogies, and multi-constraint intent — with one-line reasons for every match.

## Why this matters
This is not OCR. This is not keyword search.
Mise writes how a diner would ask for each dish, and then answers those questions against grounded evidence. Nothing is invented.

## Users
- Food delivery & discovery platforms onboarding restaurants without a POS
- Restaurant groups and franchises with many branches, one brand
- Restaurant-software companies shipping search or voice-ordering features
- Single-location owners who want their menu searchable the day they photograph it
- Catalog operations teams replacing spreadsheet-based menu ingestion

## Core workflow
1. Drop one or more files (PDF, image, post, chalkboard).
2. Opus 4.7 reads them vision-natively and emits candidates with aliases, search terms, ingredients, category, price, and source evidence.
3. A deterministic gate resolves obvious duplicates; adaptive thinking handles the ambiguous pairs.
4. The dish graph is ready. Ask it anything a diner would ask.
5. A lightweight review surface flags any dish with confidence below threshold for a human to approve, edit, or reject.

## Demo-critical queries (vernacular · evidence-grounded)
- `mila napo abundante` → alias match, XL portion
- `algo veggie que no sea ensalada` → intent + exclusion, adaptive thinking
- `lomito como steak sandwich` → cross-cultural analogy
- `algo para compartir tipo tabla` → size/group constraint

## What Mise is not
- Not OCR
- Not a menu-management tool
- Not a POS
- Not a delivery marketplace
- Not a chat UI on top of a static PDF
- Not a feature of any prior product
