import { useState } from 'react';
import { Copy, KeyRound } from 'lucide-react';
import { toast } from '../../components/ui/feedback';
import { getSyncConfig } from '../../sync/sync';

/*
 * For him only: what Supabase needs before notifications can reach a closed
 * app. The keys are made here, in this browser, and never stored by the app:
 * he copies them into Supabase's secrets once.
 */

const b64url = (bytes: ArrayBuffer | Uint8Array) => {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

interface Keys {
  publicKey: string;
  privateKey: string;
  cron: string;
}

async function makeKeys(): Promise<Keys> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ]);
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  return {
    publicKey: b64url(await crypto.subtle.exportKey('raw', pair.publicKey)),
    privateKey: jwk.d ?? '',
    cron: b64url(crypto.getRandomValues(new Uint8Array(24))),
  };
}

function Secret({ name, value }: { name: string; value: string }) {
  return (
    <div className="push-setup__secret">
      <code>{name}</code>
      <input
        className="input"
        readOnly
        value={value}
        aria-label={name}
        onFocus={(e) => e.target.select()}
      />
      <button
        type="button"
        className="btn btn--ghost btn--small"
        onClick={() => {
          void navigator.clipboard?.writeText(value).then(
            () => toast(`${name} gekopieerd`),
            () => toast('Kopiëren lukte niet: selecteer en kopieer zelf'),
          );
        }}
      >
        <Copy aria-hidden="true" /> Kopieer
      </button>
    </div>
  );
}

export function PushSetup() {
  const [keys, setKeys] = useState<Keys | null>(null);
  const url = getSyncConfig()?.url ?? 'https://JOUW-PROJECT.supabase.co';
  const cronSql = `select cron.schedule('gouden-woensdag', '0 7 * * 3', $$
  select net.http_post(
    url := '${url}/functions/v1/push',
    headers := '{"Content-Type": "application/json", "x-cron": "${keys?.cron ?? 'JOUW_CRON_SECRET'}"}'::jsonb,
    body := '{"op": "golden"}'::jsonb
  );
$$);`;
  return (
    <div className="push-setup">
      <p className="settings-text">
        Zodat een melding ook aankomt als de app dicht is (jouw beurt, ik denk aan je, Gouden
        Woensdag), moet Supabase één keer worden ingesteld. Dit zie alleen jij.
      </p>
      <ol className="push-setup__steps">
        <li>
          Supabase → <b>SQL Editor</b>: plak opnieuw de hele <code>supabase/schema.sql</code> en
          klik <b>Run</b> (er komt een tabel bij voor de telefoons).
        </li>
        <li>
          <b>Edge Functions → Deploy a new function → Via Editor</b>, naam <code>push</code>. Plak{' '}
          <code>supabase/functions/push/index.ts</code>, zet <b>Verify JWT uit</b> (de functie
          controleert zelf wie er belt) en klik <b>Deploy</b>.
        </li>
        <li>
          Maak hieronder de sleutels en zet ze bij <b>Edge Functions → Secrets</b>, samen met{' '}
          <code>VAPID_SUBJECT</code> = <code>mailto:</code> + je e-mailadres.
          {keys ? (
            <div className="push-setup__keys">
              <Secret name="VAPID_PUBLIC_KEY" value={keys.publicKey} />
              <Secret name="VAPID_PRIVATE_KEY" value={keys.privateKey} />
              <Secret name="CRON_SECRET" value={keys.cron} />
              <p className="field__hint">
                Deze sleutels worden nergens bewaard: kopieer ze nu. Maak je later nieuwe, dan
                moeten jullie allebei meldingen even uit en weer aan zetten.
              </p>
            </div>
          ) : (
            <p>
              <button
                type="button"
                className="btn btn--soft"
                onClick={async () => setKeys(await makeKeys())}
              >
                <KeyRound aria-hidden="true" /> Maak sleutels
              </button>
            </p>
          )}
        </li>
        <li>
          Voor het seintje op woensdagochtend: <b>Integrations → Cron</b> aanzetten (en{' '}
          <b>pg_net</b> bij Database → Extensions), dan in de SQL Editor:
          <pre className="push-setup__sql">{cronSql}</pre>
        </li>
        <li>
          Daarna zet ieder op de eigen telefoon <b>Meldingen</b> aan (bij App, hieronder). Op een
          iPhone eerst de app op het beginscherm zetten.
        </li>
      </ol>
    </div>
  );
}
