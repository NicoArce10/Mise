import { useState } from 'react';
import { Landing } from './views/Landing';
import { Cockpit } from './views/Cockpit';
import { Upload } from './views/Upload';
import { Processing } from './views/Processing';
import { HeroFrame } from './components/HeroFrame';
import { SampleBanner } from './components/SampleBanner';
import { useCockpitState, type CockpitMode } from './hooks/useCockpitState';
import type { UUID } from './domain/types';

type View = 'landing' | 'upload' | 'processing' | 'cockpit';

export function App() {
  const [view, setView] = useState<View>('landing');
  const [heroOpen, setHeroOpen] = useState(false);
  const [processingId, setProcessingId] = useState<UUID | null>(null);
  const [sampleMode, setSampleMode] = useState(false);

  const mode: CockpitMode = sampleMode
    ? { kind: 'sample' }
    : processingId !== null
      ? { kind: 'live', processingId }
      : { kind: 'empty' };

  const cockpit = useCockpitState(mode);

  const goToLanding = () => {
    setProcessingId(null);
    setSampleMode(false);
    setView('landing');
  };

  const goToUpload = () => {
    setProcessingId(null);
    setSampleMode(false);
    setView('upload');
  };

  const loadSample = () => {
    setProcessingId(null);
    setSampleMode(true);
    setView('cockpit');
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
            setView('processing');
          }}
        />
      )}

      {view === 'processing' && (
        <Processing
          processingId={processingId}
          adaptiveThinkingPairs={cockpit.state.processing.adaptive_thinking_pairs}
          onReady={() => setView('cockpit')}
        />
      )}

      {view === 'cockpit' && (
        <>
          {sampleMode && <SampleBanner onClear={goToUpload} />}
          <Cockpit
            state={cockpit.state}
            onModerate={cockpit.moderate}
            onPresent={() => setHeroOpen(true)}
            onRestart={goToLanding}
            onUpload={goToUpload}
            onLoadSample={loadSample}
          />
        </>
      )}

      {heroOpen && (
        <HeroFrame state={cockpit.state} onClose={() => setHeroOpen(false)} />
      )}
    </div>
  );
}
