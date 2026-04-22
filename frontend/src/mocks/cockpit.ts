import type { CockpitState } from '../domain/types';

// Sample fixture — an Argentine bistró (inspired by the builder's own
// restaurant, generalized so no real brand is shipped in the public repo).
// Stable UUIDs so the frontend and any future backend fixture can share
// them. The purpose of this sample is to make the offline demo feel real
// and match the queries documented in `docs/demo_script.md`.
//
// Every dish carries aliases + search_terms the extractor would have
// written. The catalog is what Opus 4.7 would produce against a typical
// Argentine bistró menu PDF + its daily-specials chalkboard photo.
export const IDS = {
  run: 'run-sample-bistro-argentino',
  batch: 'batch-sample-bistro-argentino',
  // sources (no real restaurant files committed — filenames are plausible)
  src_pdf_carta: 'src-pdf-carta-principal',
  src_photo_pizarron: 'src-photo-pizarron-hoy',
  // canonical dishes
  dish_mila_napo: 'dish-milanesa-napolitana-xl',
  dish_mila_clasica: 'dish-milanesa-clasica',
  dish_provoleta: 'dish-provoleta',
  dish_tabla: 'dish-tabla-fiambres-quesos',
  dish_lomito: 'dish-lomito-completo',
  dish_bife: 'dish-bife-de-chorizo',
  dish_burger: 'dish-burger-doble-cheddar',
  dish_emp_carne: 'dish-empanadas-carne',
  dish_emp_verdura: 'dish-empanadas-verdura',
  dish_noquis: 'dish-noquis-con-tuco',
  dish_ensalada: 'dish-ensalada-completa',
  dish_flan: 'dish-flan-dulce-leche',
  // modifiers
  mod_huevo_frito: 'mod-agregar-huevo-frito',
  mod_papas_extra: 'mod-agregar-papas-extra',
  // ephemerals
  eph_menu_ejecutivo: 'eph-menu-ejecutivo-almuerzo',
} as const;

// Every dish uses a consistent decision summary style — one line, lead word
// "Extracted" because reconciliation across branches does not apply to a
// single restaurant. Confidence reflects the evidence, not a merge.
function extracted(summary: string, confidence = 0.93) {
  return {
    text: summary,
    lead_word: 'Extracted' as const,
    confidence,
  };
}

export const mockCockpit: CockpitState = {
  processing: {
    id: IDS.run,
    batch_id: IDS.batch,
    state: 'ready',
    state_detail: null,
    adaptive_thinking_pairs: 0,
    started_at: '2026-04-22T14:02:00Z',
    ready_at: '2026-04-22T14:02:38Z',
    recent_dishes: [],
  },
  sources: [
    {
      id: IDS.src_pdf_carta,
      filename: 'carta_principal.pdf',
      kind: 'pdf',
      content_type: 'application/pdf',
      sha256: '0a0a…carta',
      width_px: null,
      height_px: null,
    },
    {
      id: IDS.src_photo_pizarron,
      filename: 'pizarron_hoy.jpg',
      kind: 'board',
      content_type: 'image/jpeg',
      sha256: '0b0b…pizarron',
      width_px: 1920,
      height_px: 1280,
    },
  ],
  canonical_dishes: [
    {
      id: IDS.dish_mila_napo,
      canonical_name: 'Milanesa Napolitana XL',
      aliases: ['mila napo', 'mila a la napo', 'milanesa napo', 'napo XL'],
      search_terms: [
        'mila napo abundante',
        'milanesa con jamón y queso',
        'porción abundante para el mediodía',
        'mila grande para compartir',
      ],
      menu_category: 'main',
      ingredients: ['breaded beef', 'ham', 'mozzarella', 'tomato sauce', 'oregano'],
      price_value: 18500,
      price_currency: 'ARS',
      source_ids: [IDS.src_pdf_carta, IDS.src_photo_pizarron],
      modifier_ids: [IDS.mod_huevo_frito],
      decision: extracted(
        'Extracted from the "Carnes" section of the PDF and confirmed on the chalkboard as today\'s XL portion.',
        0.96,
      ),
      moderation: 'pending',
    },
    {
      id: IDS.dish_mila_clasica,
      canonical_name: 'Milanesa Clásica con Papas',
      aliases: ['mila con papas', 'milanesa de carne', 'mila fritas'],
      search_terms: [
        'mila con papas fritas',
        'milanesa clásica',
        'algo empanado con papas',
        'almuerzo rápido abundante',
      ],
      menu_category: 'main',
      ingredients: ['breaded beef', 'french fries'],
      price_value: 16000,
      price_currency: 'ARS',
      source_ids: [IDS.src_pdf_carta],
      modifier_ids: [],
      decision: extracted(
        'Extracted from the "Carnes" section with explicit "con papas" side.',
        0.94,
      ),
      moderation: 'pending',
    },
    {
      id: IDS.dish_provoleta,
      canonical_name: 'Provoleta a la Parrilla',
      aliases: ['provoleta', 'provolone grillado', 'provo'],
      search_terms: [
        'algo veggie que no sea ensalada',
        'queso a la parrilla',
        'entrada vegetariana',
        'para empezar sin carne',
        'algo para picar veggie',
      ],
      menu_category: 'appetizer',
      ingredients: ['provolone cheese', 'oregano', 'chili flakes', 'olive oil'],
      price_value: 8500,
      price_currency: 'ARS',
      source_ids: [IDS.src_pdf_carta],
      modifier_ids: [],
      decision: extracted(
        'Extracted from the "Entradas" section. No meat ingredients — marked vegetarian.',
        0.95,
      ),
      moderation: 'pending',
    },
    {
      id: IDS.dish_tabla,
      canonical_name: 'Tabla de Fiambres y Quesos',
      aliases: ['tabla', 'picada', 'tabla para compartir', 'picada de la casa'],
      search_terms: [
        'algo para compartir tipo tabla',
        'picada para varios',
        'algo para picar entre amigos',
        'entrada para la mesa',
      ],
      menu_category: 'shared',
      ingredients: [
        'serrano ham',
        'salami',
        'provolone',
        'blue cheese',
        'green olives',
        'grissini',
      ],
      price_value: 22000,
      price_currency: 'ARS',
      source_ids: [IDS.src_pdf_carta],
      modifier_ids: [],
      decision: extracted(
        'Extracted from the "Para compartir" section. Portion size noted as "2–3 personas".',
        0.93,
      ),
      moderation: 'pending',
    },
    {
      id: IDS.dish_lomito,
      canonical_name: 'Lomito Completo',
      aliases: ['lomito', 'sandwich de lomo', 'lomito de la casa'],
      search_terms: [
        'lomito como steak sandwich',
        'sandwich de carne argentino',
        'steak sandwich con huevo',
        'lomito con todo',
      ],
      menu_category: 'sandwich',
      ingredients: [
        'grilled beef tenderloin',
        'ham',
        'cheese',
        'lettuce',
        'tomato',
        'fried egg',
        'french bread',
      ],
      price_value: 14500,
      price_currency: 'ARS',
      source_ids: [IDS.src_pdf_carta, IDS.src_photo_pizarron],
      modifier_ids: [],
      decision: extracted(
        'Extracted from the "Sandwiches" section; chalkboard highlights it as today\'s pick.',
        0.95,
      ),
      moderation: 'pending',
    },
    {
      id: IDS.dish_bife,
      canonical_name: 'Bife de Chorizo con Papas',
      aliases: ['bife', 'bife de chorizo', 'bife con papas'],
      search_terms: [
        'bife argentino con papas',
        'steak grueso al punto',
        'corte clásico a la parrilla',
        'carne jugosa',
      ],
      menu_category: 'main',
      ingredients: ['sirloin steak', 'french fries', 'chimichurri'],
      price_value: 21000,
      price_currency: 'ARS',
      source_ids: [IDS.src_pdf_carta],
      modifier_ids: [],
      decision: extracted(
        'Extracted from the "Parrilla" section. Side specified as "papas fritas" on the PDF.',
        0.92,
      ),
      moderation: 'pending',
    },
    {
      id: IDS.dish_burger,
      canonical_name: 'Burger del Barrio Doble Cheddar',
      aliases: ['burger doble', 'doble cheddar', 'cheeseburger doble'],
      search_terms: [
        'burger doble cheddar con papas',
        'algo tipo cuarto de libra',
        'hamburguesa doble queso',
        'cheeseburger grande',
      ],
      menu_category: 'burger',
      ingredients: [
        'double beef patty',
        'cheddar',
        'bacon',
        'brioche bun',
        'french fries',
      ],
      price_value: 12500,
      price_currency: 'ARS',
      source_ids: [IDS.src_pdf_carta],
      modifier_ids: [IDS.mod_papas_extra],
      decision: extracted(
        'Extracted from the "Burgers" section with "doble medallón" explicitly noted.',
        0.94,
      ),
      moderation: 'pending',
    },
    {
      id: IDS.dish_emp_carne,
      canonical_name: 'Empanadas de Carne (x6)',
      aliases: ['empanadas', 'empanadas al horno', 'empanadas caseras'],
      search_terms: [
        'empanadas caseras',
        'entrada rápida para compartir',
        'algo para picar rápido',
      ],
      menu_category: 'starter',
      ingredients: ['beef', 'onion', 'boiled egg', 'green olives', 'dough'],
      price_value: 9000,
      price_currency: 'ARS',
      source_ids: [IDS.src_pdf_carta],
      modifier_ids: [],
      decision: extracted(
        'Extracted from the "Empanadas" section. Portion is explicitly "x6".',
        0.91,
      ),
      moderation: 'pending',
    },
    {
      id: IDS.dish_emp_verdura,
      canonical_name: 'Empanadas de Verdura (x6)',
      aliases: ['empanadas verdes', 'empanadas de espinaca y ricota'],
      search_terms: [
        'empanadas veggie',
        'algo vegetariano rápido',
        'entrada veggie para la mesa',
      ],
      menu_category: 'starter',
      ingredients: ['spinach', 'ricotta', 'dough'],
      price_value: 9000,
      price_currency: 'ARS',
      source_ids: [IDS.src_pdf_carta],
      modifier_ids: [],
      decision: extracted(
        'Extracted from the "Empanadas" section. No meat — marked vegetarian.',
        0.9,
      ),
      moderation: 'pending',
    },
    {
      id: IDS.dish_noquis,
      canonical_name: 'Ñoquis con Tuco',
      aliases: ['ñoquis', 'gnocchi con salsa de tomate', 'ñoquis 29'],
      search_terms: [
        'pasta caserita con tuco',
        'pasta con salsa de carne',
        'ñoquis del 29',
      ],
      menu_category: 'pasta',
      ingredients: ['potato gnocchi', 'tomato sauce', 'ground beef'],
      price_value: 13500,
      price_currency: 'ARS',
      source_ids: [IDS.src_pdf_carta],
      modifier_ids: [],
      decision: extracted(
        'Extracted from the "Pastas" section. Sauce specified as "tuco".',
        0.9,
      ),
      moderation: 'pending',
    },
    {
      id: IDS.dish_ensalada,
      canonical_name: 'Ensalada Completa',
      aliases: ['ensalada', 'ensalada de la casa'],
      search_terms: [
        'ensalada abundante',
        'algo fresco y liviano',
        'plato liviano del mediodía',
      ],
      menu_category: 'salad',
      ingredients: ['lettuce', 'tomato', 'onion', 'boiled egg', 'tuna', 'corn'],
      price_value: 9500,
      price_currency: 'ARS',
      source_ids: [IDS.src_pdf_carta],
      modifier_ids: [],
      decision: extracted(
        'Extracted from the "Ensaladas" section.',
        0.89,
      ),
      moderation: 'pending',
    },
    {
      id: IDS.dish_flan,
      canonical_name: 'Flan con Dulce de Leche',
      aliases: ['flan', 'flan casero', 'postre criollo'],
      search_terms: [
        'postre clásico argentino',
        'algo dulce para cerrar',
        'postre con dulce de leche',
      ],
      menu_category: 'dessert',
      ingredients: ['flan', 'dulce de leche', 'whipped cream'],
      price_value: 5500,
      price_currency: 'ARS',
      source_ids: [IDS.src_pdf_carta],
      modifier_ids: [],
      decision: extracted(
        'Extracted from the "Postres" section.',
        0.92,
      ),
      moderation: 'pending',
    },
  ],
  modifiers: [
    {
      id: IDS.mod_huevo_frito,
      text: 'agregar huevo frito +1500',
      price_delta_value: 1500,
      price_delta_currency: 'ARS',
      parent_dish_id: IDS.dish_mila_napo,
      source_ids: [IDS.src_photo_pizarron],
    },
    {
      id: IDS.mod_papas_extra,
      text: 'agregar papas extra +2500',
      price_delta_value: 2500,
      price_delta_currency: 'ARS',
      parent_dish_id: IDS.dish_burger,
      source_ids: [IDS.src_pdf_carta],
    },
  ],
  ephemerals: [
    {
      id: IDS.eph_menu_ejecutivo,
      text: 'Menú ejecutivo del mediodía — entrada + principal + bebida · $14.500 (solo lunes a viernes)',
      source_ids: [IDS.src_photo_pizarron],
      decision: {
        text: 'Routed as ephemeral — time-limited offer, not a permanent dish.',
        lead_word: 'Routed',
        confidence: 0.88,
      },
      moderation: 'pending',
    },
  ],
  // Sample dataset is a single restaurant — there is no cross-branch
  // reconciliation happening here. The field stays for schema parity and
  // the backend only populates it when the real pipeline merges anything.
  reconciliation_trace: [],
  metrics_preview: {
    sources_ingested: 2,
    canonical_count: 12,
    modifier_count: 2,
    ephemeral_count: 1,
    // Precision/recall live in submissions/metrics.json — numbers here
    // would be redundant and drift. The UI will render "—" for nulls.
    merge_precision: null,
    non_merge_accuracy: null,
    // Measured end-to-end wall clock for this sample on claude-opus-4-7.
    time_to_review_pack_seconds: 38.2,
  },
};
