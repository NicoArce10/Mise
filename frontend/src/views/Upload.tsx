import { useState } from 'react';
import { UploadCloud, Sparkles } from 'lucide-react';
import { apiStartProcessing, apiUpload } from '../api/client';
import type { UUID } from '../domain/types';

interface Props {
  onStart: (processingId: UUID | null) => void;
}

const INSTRUCTION_MAX = 2000;
const INSTRUCTION_EXAMPLES = [
  'Exclude beverages and desserts',
  'Only extract pizzas and pastas',
  'Ignore the daily specials section',
] as const;

export function Upload({ onStart }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Optional per-run filter shipped as an extra message to Opus. Whitespace
  // is trimmed at the API boundary, so an untouched textarea behaves
  // exactly like the pre-feature upload flow.
  const [instructions, setInstructions] = useState('');

  const handleStart = async () => {
    setErrorMsg(null);

    if (files.length === 0) {
      setErrorMsg('Add at least one menu file, or use "Try the sample menu" on the home page.');
      return;
    }

    setSubmitting(true);
    try {
      const batch = await apiUpload(files);
      const start = await apiStartProcessing(batch.id, instructions);
      onStart(start.processing_id);
    } catch (err) {
      console.warn('[mise] upload path failed, falling back to sample', err);
      setErrorMsg(
        err instanceof Error
          ? `Backend unreachable (${err.message}). Showing the sample catalog so you can still see the output shape.`
          : 'Backend unreachable. Showing the sample catalog so you can still see the output shape.',
      );
      onStart(null);
    } finally {
      setSubmitting(false);
    }
  };

  const instructionLen = instructions.length;
  const instructionOver = instructionLen > INSTRUCTION_MAX;

  return (
    <div className="flex min-h-screen flex-col">
      <header
        className="flex items-baseline gap-6 px-10 py-5"
        style={{ borderBottom: '1px solid var(--color-hairline)' }}
      >
        <span
          className="font-display"
          style={{ fontWeight: 500, fontSize: 28, lineHeight: '32px' }}
        >
          Mise
        </span>
        <span
          className="caption"
          style={{ color: 'var(--color-ink-subtle)', letterSpacing: '0.04em' }}
        >
          Upload · your menu
        </span>
      </header>
      <main className="mx-auto flex w-full max-w-[800px] flex-col gap-8 px-10 py-16">
        <div className="flex flex-col gap-3">
          <h1
            className="font-display"
            style={{ fontWeight: 500, fontSize: 56, lineHeight: '60px', letterSpacing: '-0.01em' }}
          >
            Drop your menu.
          </h1>
          <p
            className="font-accent"
            style={{
              fontStyle: 'italic',
              fontSize: 22,
              lineHeight: '28px',
              color: 'var(--color-ink-muted)',
            }}
          >
            PDF, photo, screenshot, chalkboard. Any format, any language.
          </p>
        </div>
        <label
          htmlFor="file-input"
          onDragOver={e => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => {
            e.preventDefault();
            setDragOver(false);
            setFiles(Array.from(e.dataTransfer.files));
          }}
          className="flex cursor-pointer flex-col items-center justify-center gap-4 text-center"
          style={{
            border: `1px ${dragOver ? 'solid' : 'dashed'} ${dragOver ? 'var(--color-ink)' : 'var(--color-hairline)'}`,
            background: dragOver ? 'var(--color-paper-tint)' : 'transparent',
            borderRadius: 'var(--radius-card)',
            padding: 64,
            transition: 'border-color 180ms, background 180ms',
          }}
        >
          <UploadCloud size={36} strokeWidth={1.5} color="var(--color-ink-muted)" />
          <p style={{ color: 'var(--color-ink)' }}>
            Drag your menu files here, or click to select
          </p>
          <p
            className="caption"
            style={{ color: 'var(--color-ink-subtle)', letterSpacing: '0.04em' }}
          >
            PDF · JPG · PNG — up to 10 files, 10 MB each
          </p>
          <input
            id="file-input"
            type="file"
            multiple
            accept="application/pdf,image/*"
            className="hidden"
            onChange={e => setFiles(Array.from(e.target.files ?? []))}
          />
        </label>

        {files.length > 0 && (
          <ul
            className="flex flex-col gap-2"
            style={{
              background: 'var(--color-paper-tint)',
              border: '1px solid var(--color-hairline)',
              borderRadius: 'var(--radius-card)',
              padding: 16,
            }}
          >
            {files.map(f => (
              <li
                key={f.name}
                className="font-mono"
                style={{ fontSize: 13, lineHeight: '20px' }}
              >
                → {f.name}
              </li>
            ))}
          </ul>
        )}

        {/* Optional instructions — filter the extraction with natural
            language. The block sits between file selection and the
            submit button so it's impossible to miss, but collapsed
            visual weight (muted borders, small copy) keeps it clearly
            secondary for the 90%+ of users who won't need it. */}
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-4">
            <div className="flex items-center gap-2">
              <Sparkles
                size={14}
                strokeWidth={1.75}
                color="var(--color-ink-muted)"
              />
              <label
                htmlFor="user-instructions"
                className="caption"
                style={{
                  color: 'var(--color-ink)',
                  letterSpacing: '0.04em',
                }}
              >
                Optional · tell Opus what to skip
              </label>
            </div>
            <span
              className="font-mono"
              style={{
                fontSize: 11,
                color: instructionOver
                  ? 'var(--color-sienna)'
                  : 'var(--color-ink-subtle)',
                letterSpacing: '0.08em',
              }}
            >
              {instructionLen}/{INSTRUCTION_MAX}
            </span>
          </div>
          <textarea
            id="user-instructions"
            value={instructions}
            onChange={e => setInstructions(e.target.value.slice(0, INSTRUCTION_MAX + 200))}
            placeholder="e.g. Exclude beverages and desserts. Only extract pizzas and pastas. Ignore the daily specials section."
            rows={3}
            style={{
              width: '100%',
              resize: 'vertical',
              background: 'var(--color-paper)',
              border: `1px solid ${
                instructionOver ? 'var(--color-sienna)' : 'var(--color-hairline)'
              }`,
              borderRadius: 'var(--radius-card)',
              padding: '12px 14px',
              fontSize: 14,
              lineHeight: '22px',
              color: 'var(--color-ink)',
              fontFamily: 'inherit',
              outline: 'none',
              transition: 'border-color 180ms',
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            {INSTRUCTION_EXAMPLES.map(example => (
              <button
                key={example}
                type="button"
                onClick={() => setInstructions(example)}
                className="font-mono"
                style={{
                  fontSize: 11,
                  letterSpacing: '0.04em',
                  color: 'var(--color-ink-muted)',
                  background: 'transparent',
                  border: '1px solid var(--color-hairline)',
                  borderRadius: 'var(--radius-chip)',
                  padding: '4px 10px',
                  cursor: 'pointer',
                }}
              >
                {example}
              </button>
            ))}
          </div>
        </div>

        {errorMsg && (
          <p
            className="font-mono"
            style={{ fontSize: 13, color: 'var(--color-sienna)' }}
          >
            {errorMsg}
          </p>
        )}

        <div className="flex items-center justify-between gap-3">
          <p
            className="caption"
            style={{
              color: 'var(--color-ink-subtle)',
              letterSpacing: '0.04em',
              fontSize: 12,
            }}
          >
            Typical extraction · 15–45 s per menu page
          </p>
          <button
            type="button"
            onClick={handleStart}
            disabled={submitting || files.length === 0 || instructionOver}
            className="caption cursor-pointer"
            style={{
              background: 'var(--color-ink)',
              color: 'var(--color-paper)',
              border: '1px solid var(--color-ink)',
              borderRadius: 'var(--radius-chip)',
              padding: '12px 20px',
              letterSpacing: '0.04em',
              opacity:
                submitting || files.length === 0 || instructionOver ? 0.5 : 1,
              cursor:
                submitting || files.length === 0 || instructionOver
                  ? 'not-allowed'
                  : 'pointer',
            }}
          >
            {submitting ? 'Uploading…' : 'Build my dish graph'}
          </button>
        </div>
      </main>
    </div>
  );
}
