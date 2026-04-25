import { useEffect, useState } from 'react';
import { Landing } from './views/Landing';
import { Cockpit } from './views/Cockpit';
import { Upload } from './views/Upload';
import { Processing } from './views/Processing';
import { TryIt } from './views/TryIt';
import { SampleBanner } from './components/SampleBanner';
import { useCockpitState, type CockpitMode } from './hooks/useCockpitState';
import { useBrowserNav } from './hooks/useBrowserNav';
import type { UUID } from './domain/types';

type View = 'landing' | 'upload' | 'processing' | 'tryit' | 'catalog';

export function App() {
  // URL-backed view state. Back/forward buttons of the browser now work
  // as expected across Landing → Upload → Processing → TryIt → Catalog,
  // without a router dependency. See `hooks/useBrowserNav.ts`.
  const nav = useBrowserNav<View>('landing');
  const view = nav.view;

  const [processingId, setProcessingId] = useState<UUID | null>(null);
  const [sampleMode, setSampleMode] = useState(false);

  const mode: CockpitMode = sampleMode
    ? { kind: 'sample' }
    : processingId !== null
      ? { kind: 'live', processingId }
      : { kind: 'empty' };

  const cockpit = useCockpitState(mode);

  // Hard-reload safety net: if the URL lands on a view that needs a
  // processing run (tryit/catalog) but we have neither a live run nor
  // sample mode, flip to sample so the reviewer never sees an empty
  // cockpit. The navigation history stays untouched — this is purely a
  // state hydration step.
  useEffect(() => {
    const needsRun = view === 'tryit' || view === 'catalog';
    if (needsRun && processingId === null && !sampleMode) {
      setSampleMode(true);
    }
    // The 'processing' URL without a live id cannot proceed — bounce back
    // to Landing so the user can start the flow fresh instead of seeing
    // an infinite spinner.
    if (view === 'processing' && processingId === null) {
      nav.replace('landing');
    }
    // Intentionally runs once per mount; internal transitions already
    // manage processingId/sampleMode explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goToLanding = () => {
    setProcessingId(null);
    setSampleMode(false);
    nav.push('landing');
  };

  const goToUpload = () => {
    setProcessingId(null);
    setSampleMode(false);
    nav.push('upload');
  };

  const loadSample = () => {
    setProcessingId(null);
    setSampleMode(true);
    nav.push('tryit');
  };

  return (
    <div className="min-h-screen text-[color:var(--color-ink)]">
      {view === 'landing' && (
        <Landing onUpload={goToUpload} onSample={loadSample} />
      )}

      {view === 'upload' && (
        <Upload
          onStart={pid => {
            setSampleMode(false);
            setProcessingId(pid);
            nav.push('processing');
          }}
          // "Mise" word-mark is a back-to-landing affordance on every
          // chrome surface (Processing, TryIt, Cockpit). It used to be
          // a static span here, which made the logo silently change
          // behavior depending on which view you were on. Now it's
          // consistent across the entire flow.
          onGoHome={goToLanding}
        />
      )}

      {view === 'processing' && (
        <Processing
          processingId={processingId}
          adaptiveThinkingPairs={cockpit.state.processing.adaptive_thinking_pairs}
          onReady={() => {
            // Pipeline finished — refetch the review endpoint before swapping
            // to Try It so the first search runs against the real graph. Try
            // It is the demo hero; the catalog view is one click away.
            // `replace` (not `push`) so the back button from Try It lands on
            // Upload, not on the mid-processing screen the user already left.
            void cockpit.reload().finally(() => nav.replace('tryit'));
          }}
          // Rescue ramp for slow live extractions. The upload keeps processing
          // in the background; the reviewer sees the sample dish graph so the
          // demo momentum doesn't die.
          onSkipToSample={loadSample}
          // Recovery ramp when the pipeline outright failed (e.g. Anthropic
          // 500 on every retry). Takes the user back to Upload fresh.
          onRetryUpload={goToUpload}
          // Click on "Mise" logo mid-processing → bail back to landing.
          onGoHome={goToLanding}
        />
      )}

      {view === 'tryit' && (
        <>
          {sampleMode && <SampleBanner onClear={goToUpload} />}
          <TryIt
            state={cockpit.state}
            processingId={sampleMode ? 'sample' : processingId}
            onOpenCatalog={() => nav.push('catalog')}
            // Logo → landing. "new menu" / "Upload again" buttons →
            // the uploader. Two callbacks because the two roles USED to
            // collide on a single prop and the "new menu" button was
            // silently going to the landing page instead.
            onRestart={goToLanding}
            onUploadNew={goToUpload}
          />
        </>
      )}

      {view === 'catalog' && (
        <>
          {sampleMode && <SampleBanner onClear={goToUpload} />}
          <Cockpit
            state={cockpit.state}
            onModerate={cockpit.moderate}
            onRestart={goToLanding}
            onUpload={goToUpload}
            onLoadSample={loadSample}
            onOpenTryIt={() => nav.push('tryit')}
          />
        </>
      )}
    </div>
  );
}
