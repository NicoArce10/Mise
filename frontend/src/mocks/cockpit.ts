import type { CockpitState } from '../domain/types';

// Stable UUIDs — intentionally reused by backend fixtures in Milestone 3.
export const IDS = {
  run: 'run-b0e2a1c3-1111-4aaa-8aaa-0000000000b1',
  batch: 'batch-a1c3-2222-4aaa-8aaa-0000000000b2',
  // sources
  src_pdf_a: 'src-pdf-branch-a',
  src_photo_b: 'src-photo-branch-b',
  src_chalk_c: 'src-chalkboard-branch-c',
  src_ig_post: 'src-ig-post-special',
  src_taq_chalk: 'src-taqueria-chalkboard',
  // canonicals
  dish_margherita: 'dish-margherita',
  dish_funghi_pizza: 'dish-pizza-funghi',
  dish_funghi_calzone: 'dish-calzone-funghi',
  // modifiers
  mod_burrata: 'mod-burrata-plus-3',
  mod_guac: 'mod-add-guacamole',
  // ephemerals
  eph_chef_special: 'eph-chef-special',
} as const;

export const mockCockpit: CockpitState = {
  processing: {
    id: IDS.run,
    batch_id: IDS.batch,
    state: 'ready',
    state_detail: 'Adaptive thinking engaged on 2 pairs',
    adaptive_thinking_pairs: 2,
    started_at: '2026-04-26T16:03:11Z',
    ready_at: '2026-04-26T16:03:47Z',
  },
  sources: [
    {
      id: IDS.src_pdf_a,
      filename: 'menu_pdf_branch_a.pdf',
      kind: 'pdf',
      content_type: 'application/pdf',
      sha256: '0a0a…a1',
      width_px: null,
      height_px: null,
    },
    {
      id: IDS.src_photo_b,
      filename: 'menu_photo_branch_b.jpg',
      kind: 'photo',
      content_type: 'image/jpeg',
      sha256: '0b0b…b2',
      width_px: 2000,
      height_px: 1400,
    },
    {
      id: IDS.src_chalk_c,
      filename: 'chalkboard_branch_c.jpg',
      kind: 'board',
      content_type: 'image/jpeg',
      sha256: '0c0c…c3',
      width_px: 1800,
      height_px: 1200,
    },
    {
      id: IDS.src_ig_post,
      filename: 'instagram_post_special.png',
      kind: 'post',
      content_type: 'image/png',
      sha256: '0d0d…d4',
      width_px: 1080,
      height_px: 1080,
    },
  ],
  canonical_dishes: [
    {
      id: IDS.dish_margherita,
      canonical_name: 'Margherita',
      aliases: ['Marghertia', 'Pizza Margherita'],
      ingredients: ['tomato', 'mozzarella', 'basil'],
      source_ids: [IDS.src_pdf_a, IDS.src_photo_b, IDS.src_chalk_c],
      modifier_ids: [IDS.mod_burrata],
      decision: {
        text: 'Merged because the name matched after typo normalization and ingredients matched across two branches.',
        lead_word: 'Merged',
        confidence: 0.94,
      },
      moderation: 'pending',
    },
    {
      id: IDS.dish_funghi_pizza,
      canonical_name: 'Pizza Funghi',
      aliases: [],
      ingredients: ['tomato', 'mozzarella', 'mushrooms'],
      source_ids: [IDS.src_pdf_a, IDS.src_photo_b],
      modifier_ids: [],
      decision: {
        text: 'Merged because name and ingredients matched exactly across two branches.',
        lead_word: 'Merged',
        confidence: 0.92,
      },
      moderation: 'pending',
    },
    {
      id: IDS.dish_funghi_calzone,
      canonical_name: 'Calzone Funghi',
      aliases: [],
      ingredients: ['mozzarella', 'mushrooms', 'ricotta'],
      source_ids: [IDS.src_pdf_a],
      modifier_ids: [],
      decision: {
        text: 'Not merged with Pizza Funghi because dish type differs despite ingredient overlap.',
        lead_word: 'Not merged',
        confidence: 0.91,
      },
      moderation: 'pending',
    },
  ],
  modifiers: [
    {
      id: IDS.mod_burrata,
      text: 'add burrata +3',
      price_delta_value: 3.0,
      price_delta_currency: 'EUR',
      parent_dish_id: IDS.dish_margherita,
      source_ids: [IDS.src_chalk_c],
    },
    {
      id: IDS.mod_guac,
      text: 'add guacamole +2',
      price_delta_value: 2.0,
      price_delta_currency: 'USD',
      parent_dish_id: null,
      source_ids: [IDS.src_taq_chalk],
    },
  ],
  ephemerals: [
    {
      id: IDS.eph_chef_special,
      text: "Chef's Special",
      source_ids: [IDS.src_ig_post],
      decision: {
        text: 'Routed as ephemeral because no stable name across sources and no fixed price.',
        lead_word: 'Routed',
        confidence: 0.88,
      },
      moderation: 'pending',
    },
  ],
  reconciliation_trace: [
    {
      left_id: IDS.dish_funghi_pizza,
      right_id: IDS.dish_funghi_calzone,
      gate_class: 'ambiguous',
      merged: false,
      canonical_name: null,
      confidence: 0.91,
      decision_summary:
        'Not merged with Pizza Funghi because dish type differs despite ingredient overlap.',
      used_adaptive_thinking: true,
    },
    {
      left_id: IDS.dish_margherita,
      right_id: IDS.dish_margherita,
      gate_class: 'ambiguous',
      merged: true,
      canonical_name: 'Margherita',
      confidence: 0.94,
      decision_summary:
        'Merged because the name matched after typo normalization and ingredients matched across two branches.',
      used_adaptive_thinking: true,
    },
  ],
  // Mock metrics — replaced by evals/run_eval.py output in Milestone 4.
  metrics_preview: {
    sources_ingested: 4,
    canonical_count: 3,
    modifier_count: 2,
    ephemeral_count: 1,
    merge_precision: 1.0,
    non_merge_accuracy: 1.0,
    time_to_review_pack_seconds: 36.4,
  },
};
