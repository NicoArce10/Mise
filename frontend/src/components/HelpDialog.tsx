import { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface Shortcut {
  keys: string[];
  label: string;
}

const SHORTCUTS: { group: string; items: Shortcut[] }[] = [
  {
    group: 'Navigation',
    items: [
      { keys: ['/'], label: 'Focus the dish filter' },
      { keys: ['j'], label: 'Select next dish' },
      { keys: ['k'], label: 'Select previous dish' },
      { keys: ['Enter'], label: 'Open the detail rail for the selected dish' },
      { keys: ['Esc'], label: 'Clear selection or close overlays' },
    ],
  },
  {
    group: 'Review',
    items: [
      { keys: ['a'], label: 'Approve the selected dish' },
      { keys: ['e'], label: 'Mark the selected dish as edited' },
      { keys: ['r'], label: 'Reject the selected dish' },
    ],
  },
  {
    group: 'View',
    items: [
      { keys: ['c'], label: 'Toggle Card / Compact density' },
      { keys: ['?'], label: 'Open this help dialog' },
    ],
  },
];

export function HelpDialog({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(28, 25, 23, 0.32)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Keyboard shortcuts"
            style={{
              background: 'var(--color-paper)',
              border: '1px solid var(--color-hairline)',
              borderRadius: 'var(--radius-card)',
              boxShadow: 'var(--shadow-atmosphere)',
              width: 'min(560px, 92vw)',
              padding: 32,
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
          >
            <header className="flex items-start justify-between" style={{ marginBottom: 24 }}>
              <div className="flex flex-col gap-1">
                <span
                  className="caption"
                  style={{ color: 'var(--color-ink-subtle)', letterSpacing: '0.04em' }}
                >
                  HELP
                </span>
                <h2
                  className="font-display"
                  style={{ fontWeight: 500, fontSize: 28, lineHeight: '32px' }}
                >
                  Keyboard shortcuts
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close help"
                className="cursor-pointer"
                style={{
                  border: '1px solid var(--color-hairline)',
                  borderRadius: 'var(--radius-chip)',
                  padding: 6,
                  background: 'transparent',
                  color: 'var(--color-ink-muted)',
                }}
              >
                <X size={14} strokeWidth={1.5} />
              </button>
            </header>
            <div className="grid gap-6" style={{ gridTemplateColumns: '1fr 1fr' }}>
              {SHORTCUTS.map(section => (
                <section key={section.group} className="flex flex-col gap-3">
                  <h3
                    className="caption"
                    style={{
                      color: 'var(--color-ink-subtle)',
                      letterSpacing: '0.04em',
                      borderBottom: '1px solid var(--color-hairline)',
                      paddingBottom: 6,
                    }}
                  >
                    {section.group}
                  </h3>
                  <ul className="flex flex-col gap-2">
                    {section.items.map(({ keys, label }) => (
                      <li key={label} className="flex items-center justify-between gap-4">
                        <span
                          style={{ fontSize: 14, lineHeight: '20px', color: 'var(--color-ink)' }}
                        >
                          {label}
                        </span>
                        <span className="flex items-center gap-1">
                          {keys.map(k => (
                            <kbd
                              key={k}
                              className="font-mono"
                              style={{
                                background: 'var(--color-paper-tint)',
                                border: '1px solid var(--color-hairline)',
                                borderRadius: 'var(--radius-chip)',
                                padding: '2px 6px',
                                fontSize: 12,
                                color: 'var(--color-ink)',
                              }}
                            >
                              {k}
                            </kbd>
                          ))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
            <footer
              style={{ marginTop: 24, color: 'var(--color-ink-subtle)', fontSize: 13 }}
            >
              Shortcuts are disabled while a text field is focused.
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
