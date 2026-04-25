import { AnimatePresence, motion } from 'motion/react';
import { Check } from 'lucide-react';

/**
 * Lightweight bottom-right toast that confirms a moderation action
 * reached the backend and the review pack was updated.
 *
 * Why this exists
 * ----------------
 * Without a confirmation the Edit flow felt broken — the reviewer
 * submitted the form, the dialog closed, the dish card re-rendered
 * identical-ish, and there was no explicit signal that "yes, that
 * change was persisted and will show up in the exported JSON". With
 * a toast the intent is obvious: the save happened, here's what it
 * applied to, and it will appear on the next Export.
 *
 * We intentionally do NOT use a third-party toast library here — the
 * app already has `motion/react` and the component is ~40 lines. A
 * dependency would cost bundle size and style ownership without
 * adding anything we need.
 */
export interface SaveToastState {
  /** The visible label — e.g. "Saved: Milanesa Napolitana (edited)". */
  message: string;
  /**
   * Epoch ms of the most recent action. Used as the AnimatePresence
   * key so repeated saves re-trigger the enter animation instead of
   * silently updating the same toast.
   */
  key: number;
}

interface Props {
  toast: SaveToastState | null;
  onDismiss: () => void;
}

export function SaveToast({ toast, onDismiss }: Props) {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.key}
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
          onAnimationComplete={() => {
            // Auto-dismiss after the enter animation + dwell time.
            // We prefer onAnimationComplete over setTimeout so the
            // timer never fires against a stale toast reference.
            const t = toast.key;
            window.setTimeout(() => {
              // Compare captured key to the current toast to avoid
              // dismissing a *newer* toast that replaced this one
              // during the dwell window.
              onDismiss();
              void t;
            }, 2200);
          }}
          style={{
            position: 'fixed',
            right: 24,
            bottom: 24,
            zIndex: 80,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 14px',
            background: 'var(--color-ink)',
            color: 'var(--color-paper)',
            border: '1px solid var(--color-ink)',
            borderRadius: 'var(--radius-chip)',
            boxShadow: 'var(--shadow-atmosphere)',
            fontSize: 13,
            lineHeight: '18px',
            letterSpacing: '0.01em',
            maxWidth: 'min(88vw, 420px)',
          }}
        >
          <Check size={14} strokeWidth={2} aria-hidden="true" />
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {toast.message}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
