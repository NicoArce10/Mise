import { useState } from 'react';
import { UploadCloud, Sparkles } from 'lucide-react';
import { apiStartProcessing, apiUpload, ApiError } from '../api/client';
import type { UUID } from '../domain/types';

interface Props {
  onStart: (processingId: UUID | null) => void;
  /**
   * Called when the user clicks the "Mise" word-mark. Conventionally
   * goes back to landing. The word-mark is interactive only when this
   * is provided; without it the brand reads as a static label, which
   * was the subtle bug the reviewer caught — the same word-mark was
   * clickable on /processing and /tryit but not on /upload, so the
   * logo silently changed behavior depending on where you stood.
   */
  onGoHome?: () => void;
}

const INSTRUCTION_MAX = 2000;
const INSTRUCTION_EXAMPLES = [
  'Exclude beverages and desserts',
  'Only extract pizzas and pastas',
  'Ignore the daily specials section',
] as const;

// Mirror of the backend limits in `backend/app/api/upload.py`. Kept here
// so we can give the user a fast, friendly error before the request
// even leaves the browser. If the backend's limits change, update both.
const MAX_FILES = 10;
const MAX_BYTES_PER_FILE = 25 * 1024 * 1024; // 25 MB
const MAX_MB_PER_FILE = MAX_BYTES_PER_FILE / (1024 * 1024);
const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
]);
// Some browsers / drag-and-drop sources omit content_type. We accept
// these extensions as a best-effort fallback so a "menu.pdf" with no
// MIME doesn't bounce.
const ALLOWED_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png']);

function fileExt(name: string): string {
  const i = name.lastIndexOf('.');
  return i === -1 ? '' : name.slice(i + 1).toLowerCase();
}

function isAllowedFile(f: File): boolean {
  if (f.type && ALLOWED_MIME.has(f.type.toLowerCase())) return true;
  return ALLOWED_EXTENSIONS.has(fileExt(f.name));
}

function validateFiles(files: File[]): {
  ok: File[];
  error: string | null;
} {
  if (files.length === 0) {
    return { ok: [], error: null };
  }
  if (files.length > MAX_FILES) {
    return {
      ok: [],
      error: `Mise accepts up to ${MAX_FILES} files per upload — you selected ${files.length}.`,
    };
  }
  const tooBig = files.find(f => f.size > MAX_BYTES_PER_FILE);
  if (tooBig) {
    const mb = (tooBig.size / (1024 * 1024)).toFixed(1);
    return {
      ok: [],
      error: `${tooBig.name} is ${mb} MB — above the ${MAX_MB_PER_FILE} MB per-file limit. Try exporting at a lower resolution or splitting into single-page uploads.`,
    };
  }
  const wrongType = files.find(f => !isAllowedFile(f));
  if (wrongType) {
    return {
      ok: [],
      error: `${wrongType.name} (${wrongType.type || 'unknown type'}) is not supported. We only accept PDF, JPG, or PNG.`,
    };
  }
  const empty = files.find(f => f.size === 0);
  if (empty) {
    return {
      ok: [],
      error: `${empty.name} is empty (0 bytes). Try a different file.`,
    };
  }
  return { ok: files, error: null };
}

export function Upload({ onStart, onGoHome }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Optional per-run filter shipped as an extra message to Opus. Whitespace
  // is trimmed at the API boundary, so an untouched textarea behaves
  // exactly like the pre-feature upload flow.
  const [instructions, setInstructions] = useState('');

  // Centralized "user picked files" handler — used by both the file input
  // and the drag-and-drop branch so validation messages are identical
  // regardless of the entry path. Without this, dragging a 50 MB PDF only
  // failed at submit time (no inline feedback), while clicking to select
  // didn't provide any feedback either.
  const acceptFiles = (incoming: File[]) => {
    const { ok, error } = validateFiles(incoming);
    if (error) {
      setErrorMsg(error);
      setFiles([]);
      return;
    }
    setErrorMsg(null);
    setFiles(ok);
  };

  const handleStart = async () => {
    setErrorMsg(null);

    if (files.length === 0) {
      setErrorMsg('Add at least one menu file, or use "Try the sample menu" on the home page.');
      return;
    }

    // Re-validate at submit time too — a user could in theory drop more
    // files in a way that bypassed `acceptFiles` (e.g. via a custom
    // browser extension); this is the belt-and-suspenders check.
    const { error: revalErr } = validateFiles(files);
    if (revalErr) {
      setErrorMsg(revalErr);
      return;
    }

    setSubmitting(true);
    try {
      const batch = await apiUpload(files);
      const start = await apiStartProcessing(batch.id, instructions);
      onStart(start.processing_id);
    } catch (err) {
      // Two distinct failure classes, handled differently:
      //
      // 1. The backend answered with a 4xx we can read (413 too big,
      //    415 wrong type, 400 too many files). That's user-fixable —
      //    show the real message and STAY on the upload screen so the
      //    user can retry with a smaller/correct file. Previously we
      //    routed every failure to sample mode, which made a rejected
      //    upload look like "Opus scanned my menu and found zero
      //    dishes" — the bug the user hit with a 23 MB PDF.
      //
      // 2. Network error, 5xx, or anything we can't parse. That's not
      //    user-fixable in the moment — fall back to sample mode so
      //    the judge/demo still has something coherent to look at,
      //    but label it honestly as "couldn't reach the backend".
      console.warn('[mise] upload failed', err);
      if (err instanceof ApiError && err.detail) {
        setErrorMsg(err.detail);
      } else if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
        setErrorMsg(
          `Upload rejected (${err.status}). Check your file and try again.`,
        );
      } else {
        setErrorMsg(
          err instanceof Error
            ? `Couldn't reach the backend (${err.message}). Loading the sample catalog so you can still see the output shape.`
            : "Couldn't reach the backend. Loading the sample catalog so you can still see the output shape.",
        );
        onStart(null);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const instructionLen = instructions.length;
  const instructionOver = instructionLen > INSTRUCTION_MAX;

  return (
    <div className="flex min-h-screen flex-col">
      <header
        className="flex items-baseline gap-6 px-10 py-4"
        style={{ borderBottom: '1px solid var(--color-hairline)' }}
      >
        {onGoHome ? (
          <button
            type="button"
            onClick={onGoHome}
            aria-label="Mise — back to home"
            title="Back to home"
            className="font-display cursor-pointer"
            style={{
              fontWeight: 500,
              fontSize: 28,
              lineHeight: '32px',
              background: 'transparent',
              border: 'none',
              padding: 0,
              color: 'var(--color-ink)',
              letterSpacing: '-0.01em',
            }}
          >
            Mise
          </button>
        ) : (
          <span
            className="font-display"
            style={{ fontWeight: 500, fontSize: 28, lineHeight: '32px' }}
          >
            Mise
          </span>
        )}
        <span
          className="caption"
          style={{ color: 'var(--color-ink-subtle)', letterSpacing: '0.04em' }}
        >
          Upload · your menu
        </span>
      </header>
      <main className="mx-auto flex w-full max-w-[800px] flex-col gap-6 px-10 pt-8 pb-10">
        <div className="flex flex-col gap-3">
          <h1
            className="font-display"
            style={{ fontWeight: 500, fontSize: 48, lineHeight: '52px', letterSpacing: '-0.01em' }}
          >
            Drop your menu.
          </h1>
          <p
            className="font-accent"
            style={{
              fontStyle: 'italic',
              fontSize: 20,
              lineHeight: '26px',
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
            acceptFiles(Array.from(e.dataTransfer.files));
          }}
          className="flex cursor-pointer flex-col items-center justify-center gap-4 text-center"
          style={{
            border: `1px ${dragOver ? 'solid' : 'dashed'} ${dragOver ? 'var(--color-ink)' : 'var(--color-hairline)'}`,
            background: dragOver ? 'var(--color-paper-tint)' : 'transparent',
            borderRadius: 'var(--radius-card)',
            padding: 40,
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
            PDF · JPG · PNG — up to 10 files, 25 MB each
          </p>
          <input
            id="file-input"
            type="file"
            multiple
            accept="application/pdf,image/*"
            className="hidden"
            onChange={e => acceptFiles(Array.from(e.target.files ?? []))}
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

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p
            className="caption"
            style={{
              color: 'var(--color-ink-subtle)',
              letterSpacing: '0.04em',
              fontSize: 12,
              flex: '1 1 auto',
              minWidth: 0,
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
              whiteSpace: 'nowrap',
              flexShrink: 0,
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
