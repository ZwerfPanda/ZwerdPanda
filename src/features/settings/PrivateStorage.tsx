import { useEffect, useState } from 'react';
import { Copy, Eye, KeyRound, LoaderCircle, LockKeyhole, ShieldCheck } from 'lucide-react';
import { toast } from '../../components/ui/feedback';
import {
  enablePrivateMedia,
  joinPrivateMedia,
  privateMediaCode,
  refreshPrivateMedia,
  usePrivateMedia,
} from '../../sync/privateMedia';
import { formatCode, isCompleteCode } from '../../sync/sealed';
import { playSfx } from '../../lib/audio/sfx';

/**
 * Our photos and videos, sealed on our phones: switch it on (first phone),
 * type our code (the other phone), and see that it's working.
 */
export function PrivateStorage() {
  const { status, oldLeft, sealing } = usePrivateMedia();
  const [fresh, setFresh] = useState<string | null>(null);
  const [shown, setShown] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [wrong, setWrong] = useState(false);
  const [wroteDown, setWroteDown] = useState(false);

  useEffect(() => {
    void refreshPrivateMedia();
  }, []);

  const enable = async () => {
    setBusy(true);
    try {
      const code = await enablePrivateMedia();
      setFresh(code);
      playSfx('seal', true);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Aanzetten lukte niet.', { tone: 'error' });
      void refreshPrivateMedia();
    } finally {
      setBusy(false);
    }
  };

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCompleteCode(typed)) {
      setWrong(true);
      return;
    }
    setBusy(true);
    const ok = await joinPrivateMedia(typed).catch(() => false);
    setBusy(false);
    setWrong(!ok);
    if (ok) {
      setTyped('');
      playSfx('success', true);
      toast('Gekoppeld 🔒 Jullie foto’s komen nu binnen.');
    } else playSfx('error', true);
  };

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast('Gekopieerd — plak hem ergens veiligs, en wis hem daarna uit je klembord');
    } catch {
      toast('Kopiëren lukte niet — schrijf hem over', { tone: 'error' });
    }
  };

  return (
    <section className="private-store" aria-labelledby="private-store-title">
      <h3 id="private-store-title">
        <LockKeyhole aria-hidden="true" /> Privé-opslag
        {status === 'on' && <span className="private-store__on">aan</span>}
      </h3>

      {fresh ? (
        <div className="private-store__code-box" role="group" aria-label="Onze code">
          <p className="private-store__lead">
            Dit is jullie code. Schrijf hem op papier en bewaar hem goed.
          </p>
          <CodeView code={fresh} />
          <ul className="private-store__points">
            <li>Vul hem in op de telefoon van de ander, dan kunnen jullie allebei alles zien.</li>
            <li>
              Zijn jullie allebei je telefoon kwijt, dan is dit de enige manier om erbij te komen.
              Niemand anders kan dan helpen.
            </li>
            <li>Deel hem met niemand anders.</li>
          </ul>
          <div className="settings-actions">
            <button type="button" className="btn btn--ghost btn--small" onClick={() => copy(fresh)}>
              <Copy aria-hidden="true" /> Kopiëren
            </button>
          </div>
          <label className="private-store__check">
            <input
              type="checkbox"
              checked={wroteDown}
              onChange={(e) => setWroteDown(e.target.checked)}
            />
            Ik heb hem opgeschreven
          </label>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!wroteDown}
            onClick={() => setFresh(null)}
          >
            Klaar
          </button>
        </div>
      ) : status === null ? (
        <p className="field__hint">
          <LoaderCircle className="spin" aria-hidden="true" /> Even kijken…
        </p>
      ) : status === 'off' ? (
        <>
          <p className="field__hint">
            Zet dit aan en elke foto en video wordt op jullie telefoon versleuteld voordat hij
            vertrekt. De opslag ziet alleen onleesbare data: niemand behalve jullie twee kan erin
            kijken. Ook grote video’s passen dan (tot 2 GB).
          </p>
          <button type="button" className="btn btn--primary" onClick={enable} disabled={busy}>
            <ShieldCheck aria-hidden="true" /> {busy ? 'Sleutel maken…' : 'Zet privé-opslag aan'}
          </button>
        </>
      ) : status === 'needs-code' ? (
        <form className="private-store__join" onSubmit={join}>
          <p className="field__hint">
            Jullie foto’s zijn versleuteld. Vul jullie code in (staat op de andere telefoon onder
            Privé-opslag → “Toon onze code”), dan kan deze telefoon ze openen en meesturen.
          </p>
          <label className="field">
            <span className="field__label">Onze code</span>
            <input
              className="input private-store__input"
              value={typed}
              onChange={(e) => {
                setTyped(formatCode(e.target.value));
                setWrong(false);
              }}
              placeholder="XXXX-XXXX-XXXX-XXXX-XXXX"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              aria-invalid={wrong}
            />
          </label>
          {wrong && (
            <p className="private-store__wrong" role="alert">
              Die code klopt niet — check hem nog even.
            </p>
          )}
          <button type="submit" className="btn btn--primary" disabled={busy || !typed}>
            <KeyRound aria-hidden="true" /> {busy ? 'Openen…' : 'Koppelen'}
          </button>
        </form>
      ) : (
        <>
          <p className="field__hint">
            Aan op deze telefoon. Elke foto en video wordt hier versleuteld voordat hij vertrekt —
            alleen jullie twee kunnen ze zien.
          </p>
          {sealing ? (
            <p className="private-store__progress" role="status">
              <LoaderCircle className="spin" aria-hidden="true" /> Oude foto’s versleutelen…{' '}
              {sealing.done}/{sealing.of}
            </p>
          ) : oldLeft > 0 ? (
            <p className="private-store__progress" role="status">
              Nog {oldLeft} oude {oldLeft === 1 ? 'foto' : 'foto’s'} onversleuteld online — die
              worden versleuteld zodra ze op deze (of de andere) telefoon staan.
            </p>
          ) : (
            <p className="private-store__progress is-done">
              <ShieldCheck aria-hidden="true" /> Alles online is versleuteld.
            </p>
          )}
          {shown ? (
            <CodeView code={shown} />
          ) : (
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={async () => setShown(await privateMediaCode())}
            >
              <Eye aria-hidden="true" /> Toon onze code
            </button>
          )}
        </>
      )}
    </section>
  );
}

function CodeView({ code }: { code: string }) {
  return (
    <p className="private-store__code" aria-label={`Code: ${code.split('').join(' ')}`}>
      {code.split('-').map((part, i) => (
        <span key={i}>{part}</span>
      ))}
    </p>
  );
}
