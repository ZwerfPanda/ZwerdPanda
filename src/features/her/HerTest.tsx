import { useRef } from 'react';
import { FlaskConical, RotateCcw, X } from 'lucide-react';
import { confirm, toast } from '../../components/ui/feedback';
import { playSfx } from '../../lib/audio/sfx';
import { resetHerTest, startHerTest, stopHerTest, useHerTest } from './herStore';

const TAPS = 7;

/**
 * His hidden way in: seven quick taps on her sticker starts "try it as her"
 * on his phone. On her phone the sticker is just a sticker.
 */
export function useTestTaps(allowed: boolean): () => void {
  const taps = useRef<number[]>([]);
  const testing = useHerTest();
  return () => {
    if (!allowed || testing) return;
    const now = Date.now();
    taps.current = [...taps.current.filter((t) => now - t < 2500), now];
    if (taps.current.length < TAPS) return;
    taps.current = [];
    void confirm({
      title: 'Testen als haar?',
      message:
        'Je ziet en gebruikt haar plekje zoals zij het ziet — op een kopie die alleen op deze telefoon staat. Niets wordt gesynct en zij merkt er niets van.',
      confirmLabel: 'Start test',
    }).then((ok) => {
      if (!ok) return;
      playSfx('sparkle', true);
      startHerTest();
      toast('Testmodus aan — alleen op deze telefoon 🧪');
    });
  };
}

/** Shows only while testing, so he always knows he's in the copy. */
export function TestBanner() {
  const testing = useHerTest();
  if (!testing) return null;
  return (
    <div className="her-test" role="status">
      <FlaskConical aria-hidden="true" />
      <p>
        <strong>Testmodus</strong> — je ziet dit als haar. Alles hier is een kopie op deze
        telefoon: niets wordt gesynct of gedeeld.
      </p>
      <div className="her-test__actions">
        <button
          type="button"
          className="btn btn--ghost btn--small"
          onClick={() => {
            resetHerTest();
            toast('Kopie opnieuw begonnen');
          }}
        >
          <RotateCcw aria-hidden="true" /> Opnieuw
        </button>
        <button
          type="button"
          className="btn btn--primary btn--small"
          onClick={() => {
            stopHerTest();
            toast('Testmodus uit');
          }}
        >
          <X aria-hidden="true" /> Stoppen
        </button>
      </div>
    </div>
  );
}
