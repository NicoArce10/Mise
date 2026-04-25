import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, X } from 'lucide-react';
import type { CanonicalDish } from '../domain/types';
import type { DishEditPatch } from '../hooks/useCockpitState';

interface Props {
  dish: CanonicalDish | null;
  open: boolean;
  onClose: () => void;
  onSave: (patch: DishEditPatch) => void;
}

const EASE = [0.22, 0.61, 0.36, 1] as const;

/**
 * Inline editor for a canonical dish. Only surfaces the four fields a
 * reviewer realistically needs to correct post-extraction:
 *
 *   - canonical_name (typos, mis-reads)
 *   - menu_category (Opus guesses; reviewer overrides)
 *   - price_value / price_currency (missing prices, wrong currency)
 *   - aliases (comma-separated; useful when the reviewer knows a local
 *     name the model missed)
 *
 * Saving marks the dish `edited`. The backend whitelists these exact
 * fields — see `store.apply_decision`.
 */
export function DishEditDialog({ dish, open, onClose, onSave }: Props) {
  // Initialize form state from dish. We don't use `key={dish.id}` here
  // because the AnimatePresence wrapper already remounts per dish.id, so
  // `useState(initial)` suffices and we mirror the pattern used by the
  // existing HelpDialog / ExtractionDetailDialog.
  const [name, setName] = useState(dish?.canonical_name ?? '');
  const [category, setCategory] = useState(dish?.menu_category ?? '');
  const [price, setPrice] = useState(
    dish?.price_value == null ? '' : String(dish.price_value),
  );
  const [currency, setCurrency] = useState(dish?.price_currency ?? '');
  const [aliases, setAliases] = useState((dish?.aliases ?? []).join(', '));

  useEffect(() => {
    if (!dish) return;
    setName(dish.canonical_name);
    setCategory(dish.menu_category ?? '');
    setPrice(dish.price_value == null ? '' : String(dish.price_value));
    setCurrency(dish.price_currency ?? '');
    setAliases(dish.aliases.join(', '));
  }, [dish?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const priceValid = useMemo(() => {
    if (price.trim() === '') return true;
    const n = Number(price.replace(',', '.'));
    return Number.isFinite(n) && n >= 0;
  }, [price]);

  const nameValid = name.trim().length >= 1 && name.trim().length <= 120;
  const canSave = open && dish !== null && nameValid && priceValid;

  if (!dish) return null;

  function buildPatch(): DishEditPatch {
    const patch: DishEditPatch = {};
    const trimmedName = name.trim();
    if (trimmedName && trimmedName !== dish!.canonical_name) {
      patch.canonical_name = trimmedName;
    }
    const trimmedCat = category.trim();
    const origCat = dish!.menu_category ?? '';
    if (trimmedCat !== origCat) {
      patch.menu_category = trimmedCat === '' ? null : trimmedCat;
    }
    const priceStr = price.trim().replace(',', '.');
    const origPrice = dish!.price_value;
    if (priceStr === '' && origPrice != null) {
      patch.price_value = null;
      patch.price_currency = null;
    } else if (priceStr !== '') {
      const n = Number(priceStr);
      if (Number.isFinite(n) && n !== origPrice) {
        patch.price_value = n;
      }
      const trimmedCurrency = currency.trim().toUpperCase();
      if (trimmedCurrency && trimmedCurrency !== (dish!.price_currency ?? '')) {
        patch.price_currency = trimmedCurrency;
      } else if (patch.price_value !== undefined && !dish!.price_currency) {
        patch.price_currency = trimmedCurrency || null;
      }
    }
    const aliasList = aliases
      .split(',')
      .map(a => a.trim())
      .filter(Boolean)
      .slice(0, 8);
    const origAliases = dish!.aliases;
    const aliasesChanged =
      aliasList.length !== origAliases.length ||
      aliasList.some((a, i) => a !== origAliases[i]);
    if (aliasesChanged) patch.aliases = aliasList;
    return patch;
  }

  function handleSave() {
    if (!canSave) return;
    const patch = buildPatch();
    if (Object.keys(patch).length === 0) {
      // Nothing changed — still mark as edited so the reviewer's intent is
      // recorded (they reviewed it and decided the extraction was fine as
      // written). Treat this exactly like "Approve" from a data
      // perspective; but we honor the caller's choice to route through
      // Edit because that's what they clicked.
      onSave({});
    } else {
      onSave(patch);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="scrim"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dish-edit-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: EASE }}
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(18, 18, 20, 0.55)',
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            // Pad the scrim so the modal can never touch the viewport
            // edges even on short windows — looks cleaner and gives the
            // internal scroll something to breathe under.
            padding: 24,
            // Allow the scrim itself to scroll on REALLY short screens
            // (e.g. devtools open, Windows 125% scaling at 1080p height),
            // so the user can always reach the Save button.
            overflowY: 'auto',
          }}
        >
          <motion.div
            key="dialog"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.22, ease: EASE }}
            onClick={e => e.stopPropagation()}
            style={{
              width: 'min(92vw, 520px)',
              maxHeight: 'calc(100vh - 48px)',
              background: 'var(--color-paper)',
              border: '1px solid var(--color-hairline)',
              borderRadius: 'var(--radius-card)',
              boxShadow: 'var(--shadow-atmosphere)',
              display: 'flex',
              flexDirection: 'column',
              // Body scrolls internally; header + footer stay fixed.
              overflow: 'hidden',
            }}
          >
            {/* ---------- Header ---------- */}
            <div
              className="flex items-start justify-between gap-3"
              style={{
                padding: '24px 28px 12px 28px',
                borderBottom: '1px solid var(--color-hairline)',
              }}
            >
              <div className="flex flex-col gap-1 min-w-0">
                <span
                  className="font-mono"
                  style={{
                    fontSize: 10,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: 'var(--color-ink-subtle)',
                  }}
                >
                  Edit dish
                </span>
                <h2
                  id="dish-edit-title"
                  className="font-display"
                  style={{
                    fontWeight: 500,
                    fontSize: 22,
                    lineHeight: '26px',
                    color: 'var(--color-ink)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {dish.canonical_name}
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close editor"
                className="cursor-pointer"
                style={{
                  flex: '0 0 auto',
                  background: 'transparent',
                  border: '1px solid var(--color-hairline)',
                  borderRadius: 'var(--radius-chip)',
                  padding: 6,
                  color: 'var(--color-ink-muted)',
                }}
              >
                <X size={14} strokeWidth={1.6} />
              </button>
            </div>

            {/* ---------- Scrollable body ---------- */}
            <div
              style={{
                padding: '16px 28px 20px 28px',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                overflowY: 'auto',
                flex: '1 1 auto',
                minHeight: 0,
              }}
            >
              <Field label="Name" required>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  maxLength={120}
                  aria-invalid={!nameValid}
                  style={inputStyle(!nameValid)}
                />
              </Field>

              <Field label="Category">
                <input
                  type="text"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  maxLength={60}
                  placeholder="e.g. mains, pasta, drinks"
                  style={inputStyle(false)}
                />
              </Field>

              <div className="grid grid-cols-[1fr_100px] gap-3">
                <Field
                  label="Price"
                  hint={!priceValid ? 'Must be a positive number' : undefined}
                >
                  <input
                    type="text"
                    inputMode="decimal"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    placeholder="blank to clear"
                    aria-invalid={!priceValid}
                    style={inputStyle(!priceValid)}
                  />
                </Field>
                <Field label="Currency">
                  <input
                    type="text"
                    value={currency}
                    onChange={e => setCurrency(e.target.value.toUpperCase())}
                    maxLength={3}
                    placeholder="USD"
                    style={{ ...inputStyle(false), textTransform: 'uppercase' }}
                  />
                </Field>
              </div>

              <Field
                label="Aliases"
                hint="Comma-separated. Max 8. These become search handles in the exported JSON."
              >
                <input
                  type="text"
                  value={aliases}
                  onChange={e => setAliases(e.target.value)}
                  placeholder="alias one, alias two, alias three"
                  style={inputStyle(false)}
                />
              </Field>
            </div>

            {/* ---------- Sticky footer ---------- */}
            <div
              className="flex flex-wrap items-center justify-between gap-3"
              style={{
                padding: '14px 28px 18px 28px',
                borderTop: '1px solid var(--color-hairline)',
                background: 'var(--color-paper)',
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--color-ink-subtle)',
                  lineHeight: '16px',
                  maxWidth: 260,
                }}
              >
                Saving marks this dish <strong>edited</strong> in the review pack
                and updates the exported JSON.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="cursor-pointer"
                  style={{
                    background: 'transparent',
                    color: 'var(--color-ink-muted)',
                    border: '1px solid var(--color-hairline)',
                    borderRadius: 'var(--radius-chip)',
                    padding: '8px 14px',
                    fontSize: 13,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!canSave}
                  className="cursor-pointer inline-flex items-center gap-1.5"
                  style={{
                    background: canSave ? 'var(--color-ink)' : 'var(--color-paper-tint)',
                    color: canSave ? 'var(--color-paper)' : 'var(--color-ink-subtle)',
                    border: '1px solid var(--color-ink)',
                    borderRadius: 'var(--radius-chip)',
                    padding: '8px 14px',
                    fontSize: 13,
                    fontWeight: 500,
                    opacity: canSave ? 1 : 0.55,
                  }}
                >
                  <Check size={13} strokeWidth={1.8} />
                  Save edits
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span
        className="font-mono"
        style={{
          fontSize: 10,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: 'var(--color-ink-subtle)',
        }}
      >
        {label}
        {required && <span style={{ color: 'var(--color-sienna, var(--color-ink))' }}> *</span>}
      </span>
      {children}
      {hint && (
        <span style={{ fontSize: 11, color: 'var(--color-ink-subtle)', lineHeight: '15px' }}>
          {hint}
        </span>
      )}
    </label>
  );
}

function inputStyle(invalid: boolean): React.CSSProperties {
  return {
    background: 'var(--color-paper-tint)',
    border: `1px solid ${invalid ? 'var(--color-sienna, var(--color-hairline))' : 'var(--color-hairline)'}`,
    borderRadius: 'var(--radius-chip)',
    padding: '8px 12px',
    fontSize: 14,
    lineHeight: '20px',
    color: 'var(--color-ink)',
    outline: 'none',
  };
}
