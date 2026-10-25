import { useEffect, useState } from 'react';
import {
  Copy,
  Eye,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';
import { confirm, toast } from '../../components/ui/feedback';
import {
  enablePrivateMedia,
  joinPrivateMedia,
  privateMediaCode,
  privateMediaUsage,
  refreshPrivateMedia,
  testPrivateStorage,
  usePrivateMedia,
} from '../../sync/privateMedia';
import { formatCode, isCompleteCode } from '../../sync/sealed';
import { playSfx } from '../../lib/audio/sfx';
import { formatBytes } from '../../lib/media';

/**
 * Our photos and videos, sealed on our phones: switch it on (first phone),
 * type our code (the other phone), and see that it's working.
 */
export function PrivateStorage() {
  const { status, oldLeft, sealing, problem } = usePrivateMedia();
  const [testing, setTesting] = useState(false);
  const [tested, setTested] = useState<{ ok: boolean; carried?: boolean } | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [shown, setShown] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [wrong, setWrong] = useState(false);
  const [wroteDown, setWroteDown] = useState(false);

  useEffect(() => {
    void refreshPrivateMedia();
  }, []);

  const [usage, setUsage] = useState<Awaited<ReturnType<typeof privateMediaUsage>>>(null);
  useEffect(() => {
    if (status !== 'on' || sealing) return;
    let live = true;
    privateMediaUsage()
      .then((u) => live && setUsage(u))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [status, sealing, oldLeft, tested]);

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
              Nog {oldLeft} {oldLeft === 1 ? 'foto' : 'foto’s'} die nog versleuteld of naar de
              nieuwe opslag verplaatst moeten worden. Niets gaat verloren: het oude exemplaar blijft
              staan tot het nieuwe er veilig staat.
            </p>
          ) : (
            <p className="private-store__progress is-done">
              <ShieldCheck aria-hidden="true" /> Alles online is versleuteld.
            </p>
          )}
          {usage && <UsageMeter {...usage} />}
          {problem && !sealing && (
            <div className="private-store__problem" role="alert">
              <strong>Er gaat iets mis met de opslag</strong>
              <p>{problem}</p>
            </div>
          )}
          {tested && (
            <p className={`private-store__progress${tested.ok ? ' is-done' : ''}`} role="status">
              {tested.ok ? (
                <>
                  <ShieldCheck aria-hidden="true" /> De opslag werkt: versleuteld heen en terug
                  {tested.carried ? ' (via onze eigen functie).' : '.'}
                </>
              ) : (
                'De test lukte niet — zie hierboven waarom.'
              )}
            </p>
          )}
          <button
            type="button"
            className="btn btn--ghost btn--small"
            disabled={testing}
            onClick={async () => {
              setTesting(true);
              setTested(null);
              setTested(await testPrivateStorage());
              setTesting(false);
            }}
          >
            <Stethoscope aria-hidden="true" /> {testing ? 'Testen…' : 'Test de opslag'}
          </button>
          {shown ? (
            <CodeView code={shown} />
          ) : (
            <button
              type="button"
              className="btn btn--ghost btn--small"
              onClick={async () => {
                const ok = await confirm({
                  title: 'Onze code tonen?',
                  message:
                    'Met deze code kan iemand al jullie foto’s openen. Laat niemand meekijken, en maak er geen screenshot van.',
                  confirmLabel: 'Toon de code',
                });
                if (ok) setShown(await privateMediaCode());
              }}
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

const GB = 1024 ** 3;

/** How much we keep, what's free, and roughly what more would cost. */
function UsageMeter({
  bytes,
  files,
  where,
}: {
  bytes: number;
  files: number;
  where: 'r2' | 'supabase';
}) {
  const free = where === 'r2' ? 10 * GB : 1 * GB;
  const share = Math.min(100, Math.round((bytes / free) * 100));
  const over = Math.max(0, bytes - free) / GB;
  return (
    <div className="private-store__usage">
      <p>
        <strong>{formatBytes(bytes)}</strong> in {where === 'r2' ? 'Cloudflare R2' : 'Supabase'}
        {' · '}
        {files} {files === 1 ? 'bestand' : 'bestanden'}
      </p>
      <span
        className="private-store__bar"
        role="meter"
        aria-label="Gebruikte gratis ruimte"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={share}
      >
        <span style={{ width: `${Math.max(2, share)}%` }} />
      </span>
      <small>
        {where === 'r2'
          ? over > 0
            ? `${share}% van de gratis 10 GB vol — daarboven ongeveer $${(over * 0.015).toFixed(2)} per maand.`
            : `${share}% van de gratis 10 GB. Daarboven kost het ongeveer $0,015 per GB per maand.`
          : `${share}% van de ongeveer 1 GB die gratis is in Supabase.`}
      </small>
    </div>
  );
}
