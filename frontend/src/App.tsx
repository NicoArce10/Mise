import { useState } from 'react';
import { Cockpit } from './views/Cockpit';
import { Upload } from './views/Upload';
import { Processing } from './views/Processing';
import { HeroFrame } from './components/HeroFrame';
import { useCockpitState } from './hooks/useCockpitState';

type View = 'upload' | 'processing' | 'cockpit';

export function App() {
  const [view, setView] = useState<View>('cockpit');
  const [heroOpen, setHeroOpen] = useState(false);
  const cockpit = useCockpitState();

  return (
    <div className="min-h-screen text-[color:var(--color-ink)]">
      {view === 'upload' && <Upload onStart={() => setView('processing')} />}
      {view === 'processing' && (
        <Processing
          adaptiveThinkingPairs={cockpit.state.processing.adaptive_thinking_pairs}
          onReady={() => setView('cockpit')}
        />
      )}
      {view === 'cockpit' && (
        <Cockpit
          state={cockpit.state}
          onModerate={cockpit.moderate}
          onPresent={() => setHeroOpen(true)}
          onRestart={() => setView('upload')}
        />
      )}
      {heroOpen && (
        <HeroFrame state={cockpit.state} onClose={() => setHeroOpen(false)} />
      )}
    </div>
  );
}
