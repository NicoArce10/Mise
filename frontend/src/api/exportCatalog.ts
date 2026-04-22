// "Plug it into anything" — the dish graph leaves the product as a single
// JSON file. This helper is the only place in the frontend that builds that
// file, so the shape stays identical whether the user triggers the download
// from TryIt (Playground) or from the Catalog view.
//
// Live runs hit the backend endpoint so the server's `Content-Disposition`
// names the file and the bytes come straight from the persisted state.
// Sample runs replicate the backend shape client-side so the demo works
// offline.
//
// Moderation semantics (shipped in the product and honored server-side):
//   - REJECTED   → excluded from the exported JSON entirely.
//   - APPROVED   → `review_status: "approved"` on the dish.
//   - EDITED     → `review_status: "edited"`    on the dish.
//   - PENDING    → `review_status` omitted (reviewer hasn't touched it).
//
// Dropping rejected items from the export is the whole point of the Reject
// button: the catalog is the product surface, and a rejected dish should
// not reach downstream systems.

import type {
  CanonicalDish,
  CockpitState,
  EphemeralItem,
  Modifier,
  ModerationStatus,
  UUID,
} from '../domain/types';
import { catalogUrl } from './client';

function reviewStatusFor(m: ModerationStatus): 'approved' | 'edited' | undefined {
  if (m === 'approved') return 'approved';
  if (m === 'edited') return 'edited';
  return undefined;
}

interface SourceRef {
  source_id: UUID;
  filename?: string;
  kind?: string;
}

interface ExportedDish {
  id: UUID;
  canonical_name: string;
  aliases: string[];
  search_terms: string[];
  ingredients: string[];
  menu_category: string | null;
  price: { value: number; currency: string | null } | null;
  modifiers: ExportedModifier[];
  sources: SourceRef[];
  confidence: number;
  decision_summary: string;
  review_status?: 'approved' | 'edited';
}

interface ExportedModifier {
  id: UUID;
  text: string;
  price_delta: { value: number; currency: string | null } | null;
  parent_dish_id: UUID | null;
  sources: SourceRef[];
}

interface ExportedEphemeral {
  id: UUID;
  text: string;
  sources: SourceRef[];
  confidence: number;
  decision_summary: string;
  review_status?: 'approved' | 'edited';
}

export interface ExportedCatalog {
  run_id: UUID | 'sample';
  generated_at: string;
  model: string;
  sources: Array<{
    id: UUID;
    filename: string;
    kind: string;
    content_type: string;
    sha256: string;
  }>;
  dishes: ExportedDish[];
  unattached_modifiers: ExportedModifier[];
  ephemerals: ExportedEphemeral[];
  counts: {
    sources: number;
    dishes: number;
    modifiers_attached: number;
    modifiers_unattached: number;
    ephemerals: number;
    excluded_rejected: number;
  };
}

/**
 * Build the exported catalog JSON client-side. Mirrors backend/app/api/catalog.py
 * exactly so the downloaded file is shape-identical whichever path fired it.
 * Used for sample runs and as an offline fallback.
 */
export function buildCatalogPayload(
  state: CockpitState,
  runId: UUID | 'sample',
): ExportedCatalog {
  const sourcesById = new Map(state.sources.map(s => [s.id, s]));
  const sourceRef = (sid: UUID): SourceRef => {
    const src = sourcesById.get(sid);
    return src
      ? { source_id: sid, filename: src.filename, kind: src.kind }
      : { source_id: sid };
  };

  const includedDishes = state.canonical_dishes.filter(
    d => d.moderation !== 'rejected',
  );
  const excludedDishCount =
    state.canonical_dishes.length - includedDishes.length;

  const includedDishIds = new Set(includedDishes.map(d => d.id));
  const attachedByParent = new Map<UUID, Modifier[]>();
  const unattached: Modifier[] = [];
  for (const m of state.modifiers) {
    if (m.parent_dish_id === null || m.parent_dish_id === undefined) {
      unattached.push(m);
    } else if (includedDishIds.has(m.parent_dish_id)) {
      const list = attachedByParent.get(m.parent_dish_id) ?? [];
      list.push(m);
      attachedByParent.set(m.parent_dish_id, list);
    }
  }

  const includedEphemerals = state.ephemerals.filter(
    e => e.moderation !== 'rejected',
  );

  const toDish = (d: CanonicalDish): ExportedDish => {
    const dish: ExportedDish = {
      id: d.id,
      canonical_name: d.canonical_name,
      aliases: d.aliases,
      search_terms: d.search_terms,
      ingredients: d.ingredients,
      menu_category: d.menu_category,
      price:
        d.price_value !== null && d.price_value !== undefined
          ? { value: d.price_value, currency: d.price_currency }
          : null,
      modifiers: (attachedByParent.get(d.id) ?? []).map(toModifier),
      sources: d.source_ids.map(sourceRef),
      confidence: d.decision.confidence,
      decision_summary: d.decision.text,
    };
    const status = reviewStatusFor(d.moderation);
    if (status) dish.review_status = status;
    return dish;
  };

  function toModifier(m: Modifier): ExportedModifier {
    return {
      id: m.id,
      text: m.text,
      price_delta:
        m.price_delta_value !== null && m.price_delta_value !== undefined
          ? { value: m.price_delta_value, currency: m.price_delta_currency }
          : null,
      parent_dish_id: m.parent_dish_id,
      sources: m.source_ids.map(sourceRef),
    };
  }

  const toEphemeral = (e: EphemeralItem): ExportedEphemeral => {
    const eph: ExportedEphemeral = {
      id: e.id,
      text: e.text,
      sources: e.source_ids.map(sourceRef),
      confidence: e.decision.confidence,
      decision_summary: e.decision.text,
    };
    const status = reviewStatusFor(e.moderation);
    if (status) eph.review_status = status;
    return eph;
  };

  const unattachedPayload = unattached.map(toModifier);
  const dishesPayload = includedDishes.map(toDish);
  const attachedCount = dishesPayload.reduce(
    (acc, d) => acc + d.modifiers.length,
    0,
  );

  return {
    run_id: runId,
    generated_at: state.processing.ready_at ?? state.processing.started_at,
    model: 'claude-opus-4-7',
    sources: state.sources.map(s => ({
      id: s.id,
      filename: s.filename,
      kind: s.kind,
      content_type: s.content_type,
      sha256: s.sha256,
    })),
    dishes: dishesPayload,
    unattached_modifiers: unattachedPayload,
    ephemerals: includedEphemerals.map(toEphemeral),
    counts: {
      sources: state.sources.length,
      dishes: dishesPayload.length,
      modifiers_attached: attachedCount,
      modifiers_unattached: unattachedPayload.length,
      ephemerals: includedEphemerals.length,
      excluded_rejected: excludedDishCount,
    },
  };
}

/**
 * Download the exported catalog. For live runs (`processingId` is a UUID)
 * this hits the backend endpoint so the server fully owns the shape —
 * including the rejected-filter semantics enforced server-side. For sample
 * mode or when the backend is unreachable we build the payload locally.
 *
 * `preferServer` lets callers force the client-side path even for live
 * runs (useful for offline demos). Default is to trust the server.
 */
export function downloadCatalog(
  state: CockpitState,
  processingId: UUID | 'sample' | null,
  opts: { preferServer?: boolean } = {},
): void {
  const preferServer = opts.preferServer ?? true;
  const isLive =
    processingId !== null &&
    processingId !== 'sample' &&
    !processingId.startsWith('run-sample');

  if (isLive && preferServer) {
    const a = document.createElement('a');
    a.href = catalogUrl(processingId);
    a.rel = 'noopener';
    a.click();
    return;
  }

  const runId = processingId ?? 'sample';
  const payload = buildCatalogPayload(state, runId);
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mise-catalog-${runId}.json`;
  a.rel = 'noopener';
  a.click();
  URL.revokeObjectURL(url);
}
