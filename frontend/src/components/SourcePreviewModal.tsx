import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  FileText,
  Image as ImageIcon,
  Instagram,
  NotebookPen,
  X,
} from 'lucide-react';
import { sourceContentUrl } from '../api/client';
import type { CanonicalDish, SourceDocument } from '../domain/types';
import { formatPrice } from '../lib/formatPrice';

/**
 * Modal that shows the menu the reviewer actually uploaded: original PDF
 * pages, photos, chalkboard snapshots, social screenshots. This is the
 * "closing the loop" step of the demo — the judge sees the source, the
 * extracted dish graph, and the natural-language answer all in the same
 * session.
 *
 * Sample mode (no real bytes on the backend) renders a typographic
 * preview built from the extracted dishes. It never pretends to be a real
 * PDF — the chrome says "Sample menu" explicitly.
 */
interface Props {
  open: boolean;
  onClose: () => void;
  sources: SourceDocument[];
  dishes: CanonicalDish[];
  isSample: boolean;
}

const KIND_META: Record<
  SourceDocument['kind'],
  { label: string; icon: React.ReactNode }
> = {
  pdf: { label: 'PDF', icon: <FileText size={18} strokeWidth={1.5} /> },
  photo: { label: 'Photo', icon: <ImageIcon size={18} strokeWidth={1.5} /> },
  board: {
    label: 'Chalkboard',
    icon: <NotebookPen size={18} strokeWidth={1.5} />,
  },
  post: {
    label: 'Social post',
    icon: <Instagram size={18} strokeWidth={1.5} />,
  },
};

function SamplePreview({
  dishes,
  source,
}: {
  dishes: CanonicalDish[];
  source: SourceDocument;
}) {
  // Only show the dishes that were actually attributed to this source, so
  // if we ever ship more sample sources the preview stays truthful.
  const mine = dishes.filter(d => d.source_ids.includes(source.id));
  const byCategory = useMemo(() => {
    const groups = new Map<string, CanonicalDish[]>();
    for (const d of mine) {
      const key = d.menu_category ?? 'other';
      const list = groups.get(key) ?? [];
      list.push(d);
      groups.set(key, list);
    }
    return groups;
  }, [mine]);

  return (
    <div
      style={{
        background: 'var(--color-paper)',
        border: '1px solid var(--color-hairline)',
        borderRadius: 'var(--radius-card)',
        padding: '48px 56px',
        maxWidth: 720,
        margin: '0 auto',
        boxShadow: 'var(--shadow-atmosphere)',
      }}
    >
      <div
        className="mb-6 flex flex-col items-center gap-2"
        style={{ textAlign: 'center' }}
      >
        <span
          className="font-mono"
          style={{
            fontSize: 10,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--color-ink-subtle)',
          }}
        >
          Sample menu · typographic preview
        </span>
        <h3
          className="font-display"
          style={{
            fontWeight: 500,
            fontSize: 38,
            lineHeight: '44px',
            letterSpacing: '-0.02em',
            color: 'var(--color-ink)',
          }}
        >
          {source.filename}
        </h3>
        <span
          className="font-accent"
          style={{
            fontStyle: 'italic',
            fontSize: 15,
            color: 'var(--color-ink-muted)',
          }}
        >
          This is the menu Mise loaded for you — the same one the demo searches
          against.
        </span>
      </div>
      {[...byCategory.entries()].map(([category, list]) => (
        <div
          key={category}
          className="mb-6 flex flex-col gap-2"
          style={{ borderTop: '1px solid var(--color-hairline)', paddingTop: 16 }}
        >
          <span
            className="font-mono"
            style={{
              fontSize: 11,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--color-ink-subtle)',
            }}
          >
            {category}
          </span>
          {list.map(d => (
            <div
              key={d.id}
              className="flex items-start justify-between gap-4"
              style={{ paddingTop: 2, paddingBottom: 2 }}
            >
              <div className="flex min-w-0 flex-col">
                <span
                  className="font-display"
                  style={{
                    fontWeight: 500,
                    fontSize: 19,
                    lineHeight: '26px',
                    letterSpacing: '-0.005em',
                    color: 'var(--color-ink)',
                  }}
                >
                  {d.canonical_name}
                </span>
                {d.ingredients.length > 0 && (
                  <span
                    className="font-accent"
                    style={{
                      fontStyle: 'italic',
                      fontSize: 14,
                      lineHeight: '20px',
                      color: 'var(--color-ink-muted)',
                    }}
                  >
                    {d.ingredients.join(', ')}
                  </span>
                )}
              </div>
              <span
                className="font-mono"
                style={{
                  fontSize: 14,
                  lineHeight: '22px',
                  color: 'var(--color-ink-muted)',
                  fontVariantNumeric: 'tabular-nums',
                  flexShrink: 0,
                  paddingTop: 2,
                }}
              >
                {formatPrice(d.price_value, d.price_currency)}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function RealPreview({ source }: { source: SourceDocument }) {
  const url = sourceContentUrl(source.id);
  const isPdf = source.content_type === 'application/pdf';
  const isImage = source.content_type.startsWith('image/');
  const [errored, setErrored] = useState(false);

  if (isPdf) {
    return (
      <iframe
        title={source.filename}
        src={url}
        style={{
          width: '100%',
          height: '100%',
          minHeight: 640,
          border: '1px solid var(--color-hairline)',
          borderRadius: 'var(--radius-card)',
          background: 'var(--color-paper)',
        }}
      />
    );
  }
  if (isImage && !errored) {
    return (
      <div className="flex justify-center">
        <img
          src={url}
          alt={source.filename}
          onError={() => setErrored(true)}
          style={{
            maxWidth: '100%',
            maxHeight: '72vh',
            objectFit: 'contain',
            border: '1px solid var(--color-hairline)',
            borderRadius: 'var(--radius-card)',
            background: 'var(--color-paper-tint)',
          }}
        />
      </div>
    );
  }
  return (
    <div
      className="flex flex-col items-center justify-center gap-2"
      style={{
        border: '1px dashed var(--color-hairline)',
        borderRadius: 'var(--radius-card)',
        padding: 48,
        minHeight: 320,
        color: 'var(--color-ink-muted)',
      }}
    >
      <span className="font-mono" style={{ fontSize: 12 }}>
        No inline preview available for this upload.
      </span>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        style={{
          fontSize: 14,
          color: 'var(--color-ink)',
          borderBottom: '1px solid var(--color-hairline)',
        }}
      >
        Open raw file ↗
      </a>
    </div>
  );
}

export function SourcePreviewModal({
  open,
  onClose,
  sources,
  dishes,
  isSample,
}: Props) {
  const [activeId, setActiveId] = useState<string | null>(
    sources[0]?.id ?? null,
  );

  useEffect(() => {
    if (open && activeId === null && sources[0]) {
      setActiveId(sources[0].id);
    }
  }, [open, activeId, sources]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const active = sources.find(s => s.id === activeId) ?? sources[0] ?? null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="dialog"
          aria-modal="true"
          aria-label="Uploaded menu preview"
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            background: 'rgba(18, 18, 22, 0.55)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'stretch',
            justifyContent: 'center',
            padding: '4vh 4vw',
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 1100,
              background: 'var(--color-paper-tint)',
              borderRadius: 'var(--radius-card)',
              boxShadow: 'var(--shadow-atmosphere)',
              display: 'grid',
              gridTemplateRows: 'auto 1fr',
              maxHeight: '92vh',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <header
              className="flex items-center justify-between gap-4"
              style={{
                padding: '18px 24px',
                borderBottom: '1px solid var(--color-hairline)',
                background: 'var(--color-paper)',
              }}
            >
              <div className="flex items-baseline gap-3">
                <span
                  className="font-display"
                  style={{
                    fontWeight: 500,
                    fontSize: 20,
                    lineHeight: '26px',
                    letterSpacing: '-0.01em',
                  }}
                >
                  Uploaded menu
                </span>
                <span
                  className="font-mono"
                  style={{
                    fontSize: 11,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: 'var(--color-ink-subtle)',
                  }}
                >
                  {isSample
                    ? 'Sample · typographic preview'
                    : `${sources.length} ${sources.length === 1 ? 'source' : 'sources'}`}
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close preview"
                className="cursor-pointer inline-flex items-center gap-2"
                style={{
                  background: 'transparent',
                  color: 'var(--color-ink-muted)',
                  border: '1px solid var(--color-hairline)',
                  borderRadius: 'var(--radius-chip)',
                  padding: '8px 12px',
                  fontSize: 13,
                }}
              >
                <X size={14} strokeWidth={1.7} />
                Close
              </button>
            </header>

            {/* Body: tabs on the left, preview on the right */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '260px 1fr',
                minHeight: 0,
              }}
            >
              <aside
                className="flex flex-col gap-2 overflow-auto"
                style={{
                  padding: 16,
                  borderRight: '1px solid var(--color-hairline)',
                  background: 'var(--color-paper)',
                }}
              >
                {sources.map(s => {
                  const meta = KIND_META[s.kind];
                  const selected = s.id === (active?.id ?? null);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setActiveId(s.id)}
                      className="cursor-pointer text-left flex items-start gap-3"
                      style={{
                        background: selected
                          ? 'var(--color-paper-tint)'
                          : 'transparent',
                        border: '1px solid var(--color-hairline)',
                        borderLeft: selected
                          ? '3px solid var(--color-ink)'
                          : '1px solid var(--color-hairline)',
                        borderRadius: 'var(--radius-input)',
                        padding: '10px 12px',
                      }}
                    >
                      <span
                        style={{
                          width: 32,
                          height: 32,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'var(--color-paper)',
                          border: '1px solid var(--color-hairline)',
                          borderRadius: 'var(--radius-chip)',
                          flexShrink: 0,
                          color: 'var(--color-ink-muted)',
                        }}
                      >
                        {meta.icon}
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span
                          className="font-mono"
                          style={{
                            fontSize: 10,
                            letterSpacing: '0.16em',
                            textTransform: 'uppercase',
                            color: 'var(--color-ink-subtle)',
                          }}
                        >
                          {meta.label}
                        </span>
                        <span
                          className="truncate"
                          style={{
                            fontSize: 13,
                            lineHeight: '18px',
                            color: 'var(--color-ink)',
                          }}
                        >
                          {s.filename}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </aside>

              <main
                className="overflow-auto"
                style={{
                  padding: 24,
                  background: 'var(--color-paper-tint)',
                }}
              >
                {active ? (
                  isSample ? (
                    <SamplePreview dishes={dishes} source={active} />
                  ) : (
                    <RealPreview source={active} />
                  )
                ) : (
                  <div
                    className="flex items-center justify-center"
                    style={{
                      height: '100%',
                      minHeight: 320,
                      color: 'var(--color-ink-muted)',
                    }}
                  >
                    <span className="font-mono" style={{ fontSize: 12 }}>
                      No sources to preview.
                    </span>
                  </div>
                )}
              </main>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
