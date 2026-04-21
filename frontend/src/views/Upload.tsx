import { useState } from 'react';
import { UploadCloud } from 'lucide-react';

interface Props {
  onStart: () => void;
}

export function Upload({ onStart }: Props) {
  const [files, setFiles] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);

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
          Upload · evidence bundle
        </span>
      </header>
      <main className="mx-auto flex w-full max-w-[800px] flex-col gap-8 px-10 py-16">
        <div className="flex flex-col gap-3">
          <h1
            className="font-display"
            style={{ fontWeight: 500, fontSize: 56, lineHeight: '60px', letterSpacing: '-0.01em' }}
          >
            Drop menu evidence
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
            PDFs, photos, chalkboards, social posts. Mise reads them natively.
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
            setFiles(Array.from(e.dataTransfer.files).map(f => f.name));
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
            Drag four files into the drop zone
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
            onChange={e =>
              setFiles(Array.from(e.target.files ?? []).map(f => f.name))
            }
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
                key={f}
                className="font-mono"
                style={{ fontSize: 13, lineHeight: '20px' }}
              >
                → {f}
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onStart}
            className="caption cursor-pointer"
            style={{
              background: 'var(--color-ink)',
              color: 'var(--color-paper)',
              border: '1px solid var(--color-ink)',
              borderRadius: 'var(--radius-chip)',
              padding: '12px 20px',
              letterSpacing: '0.04em',
            }}
          >
            Start reconciliation
          </button>
        </div>
      </main>
    </div>
  );
}
