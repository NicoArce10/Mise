import { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import type { ProcessingRun, SourceDocument } from '../domain/types';

interface Props {
  open: boolean;
  onClose: () => void;
  processing: ProcessingRun;
  sources: SourceDocument[];
}

function prettyBytes(sha: string): string {
  return sha.slice(0, 12) + '…';
}

export function ExtractionDetailDialog({ open, onClose, processing, sources }: Props) {
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
            aria-label="Extraction detail"
            style={{
              background: 'var(--color-paper)',
              border: '1px solid var(--color-hairline)',
              borderRadius: 'var(--radius-card)',
              boxShadow: 'var(--shadow-atmosphere)',
              width: 'min(620px, 92vw)',
              padding: 32,
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
          >
            <header className="flex items-start justify-between" style={{ marginBottom: 20 }}>
              <div className="flex flex-col gap-1">
                <span
                  className="caption"
                  style={{ color: 'var(--color-ink-subtle)', letterSpacing: '0.04em' }}
                >
                  EXTRACTION DETAIL
                </span>
                <h2
                  className="font-display"
                  style={{ fontWeight: 500, fontSize: 26, lineHeight: '30px' }}
                >
                  What Mise saw
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close detail"
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

            <dl className="flex flex-col gap-3" style={{ marginBottom: 24 }}>
              <div className="flex items-baseline justify-between gap-6">
                <dt
                  className="caption"
                  style={{ color: 'var(--color-ink-subtle)', letterSpacing: '0.04em' }}
                >
                  PIPELINE STATE
                </dt>
                <dd
                  className="font-mono"
                  style={{ fontSize: 13, color: 'var(--color-ink)' }}
                >
                  {processing.state}
                </dd>
              </div>
              {processing.state_detail && (
                <div className="flex items-baseline justify-between gap-6">
                  <dt
                    className="caption"
                    style={{ color: 'var(--color-ink-subtle)', letterSpacing: '0.04em' }}
                  >
                    DETAIL
                  </dt>
                  <dd
                    className="font-mono"
                    style={{ fontSize: 13, color: 'var(--color-ink)', textAlign: 'right', maxWidth: 360 }}
                  >
                    {processing.state_detail}
                  </dd>
                </div>
              )}
              <div className="flex items-baseline justify-between gap-6">
                <dt
                  className="caption"
                  style={{ color: 'var(--color-ink-subtle)', letterSpacing: '0.04em' }}
                >
                  PROCESSING ID
                </dt>
                <dd
                  className="font-mono"
                  style={{ fontSize: 12, color: 'var(--color-ink-muted)' }}
                >
                  {processing.id}
                </dd>
              </div>
            </dl>

            <section className="flex flex-col gap-3">
              <h3
                className="caption"
                style={{
                  color: 'var(--color-ink-subtle)',
                  letterSpacing: '0.04em',
                  borderBottom: '1px solid var(--color-hairline)',
                  paddingBottom: 6,
                }}
              >
                SOURCES SENT TO OPUS 4.7
              </h3>
              {sources.length === 0 ? (
                <p style={{ color: 'var(--color-ink-muted)', fontSize: 14 }}>
                  No sources recorded for this run.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {sources.map(src => (
                    <li
                      key={src.id}
                      className="flex items-baseline justify-between gap-4"
                      style={{
                        background: 'var(--color-paper-tint)',
                        border: '1px solid var(--color-hairline)',
                        borderRadius: 'var(--radius-chip)',
                        padding: '10px 14px',
                      }}
                    >
                      <div className="flex flex-col gap-1" style={{ minWidth: 0 }}>
                        <span
                          style={{
                            fontSize: 14,
                            lineHeight: '18px',
                            color: 'var(--color-ink)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {src.filename}
                        </span>
                        <span
                          className="font-mono"
                          style={{ fontSize: 12, color: 'var(--color-ink-subtle)' }}
                        >
                          {src.kind} · {src.content_type} · sha {prettyBytes(src.sha256)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <footer
              style={{ marginTop: 24, color: 'var(--color-ink-subtle)', fontSize: 13 }}
            >
              For deeper diagnosis, check the backend terminal for
              {' '}
              <span className="font-mono">[mise]</span> lines — the request
              shape and any zero-candidate warnings print there.
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
