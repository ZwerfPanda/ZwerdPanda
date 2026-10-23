import { useEffect, useRef, useState } from 'react';
import {
  Cloud,
  CloudOff,
  CloudUpload,
  KeyRound,
  LoaderCircle,
  LogOut,
  RefreshCw,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { Segmented, TextField } from '../../components/ui/Fields';
import { confirm, toast } from '../../components/ui/feedback';
import { useContent } from '../../data/store';
import { useRoute } from '../../lib/router';
import {
  connectThisDevice,
  forgetThisDevicesServer,
  getSyncConfig,
  getSyncEngine,
  useSyncState,
} from '../../sync/sync';
import { isValidConfig, looksLikeSecretKey } from '../../sync/config';
import { timeAgo } from '../../lib/dates';
import type { SyncState } from '../../sync/types';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Runs an async action with a busy flag and turns errors into a message. */
function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Er ging iets mis.');
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, run };
}

export function TogetherSection() {
  const sync = useSyncState();
  const { params } = useRoute();
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (params.get('section') === 'together') {
      ref.current?.scrollIntoView({ block: 'start' });
    }
  }, [params]);

  return (
    <section className="settings-card together" aria-labelledby="together-title" ref={ref}>
      <p className="settings-card__kicker hand">his phone, her phone, any laptop</p>
      <h2 id="together-title" className="settings-card__title">
        Samen op elk apparaat
      </h2>
      {sync.recovery ? (
        <NewPassword />
      ) : sync.phase === 'off' ? (
        <NotConfigured />
      ) : sync.phase === 'starting' ? (
        <p className="together__status">
          <LoaderCircle className="spin" aria-hidden="true" /> Verbinden…
        </p>
      ) : sync.phase === 'signed-out' || (!sync.account && sync.phase === 'error') ? (
        <SignIn error={sync.error} />
      ) : sync.phase === 'needs-space' ? (
        <CreateSpace sync={sync} />
      ) : (
        <Connected sync={sync} />
      )}
    </section>
  );
}

/* ----------------------------------------------------------- not set up */

function NotConfigured() {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [key, setKey] = useState('');
  const action = useAction();

  return (
    <div className="together__body">
      <p className="settings-text">
        Op dit moment staat alles op <strong>alleen dit apparaat</strong>. Koppel ons eigen gratis,
        privé Supabase-project en jullie zien allebei dezelfde herinneringen, brieven en foto’s op
        elke telefoon en computer — live bijgewerkt.
      </p>
      <p className="settings-text">
        De stap-voor-stap handleiding staat in <code>docs/HANDLEIDING.md</code>. Zodra de site aan
        het project gekoppeld is, wordt dit gewoon een inlogscherm.
      </p>
      {!open ? (
        <button type="button" className="btn btn--ghost btn--small" onClick={() => setOpen(true)}>
          <Cloud aria-hidden="true" /> Koppel een project op dit apparaat
        </button>
      ) : (
        <form
          className="form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (looksLikeSecretKey(key)) {
              action.setError(
                'Dat is de geheime sleutel — zet die nooit in een website. Gebruik de publishable (of anon public) key.',
              );
              return;
            }
            if (!isValidConfig(url, key)) {
              action.setError('Plak de Project URL (https://….supabase.co) en de publishable key.');
              return;
            }
            void action.run(() => connectThisDevice(url, key));
          }}
        >
          <TextField
            label="Project URL"
            type="url"
            inputMode="url"
            value={url}
            onChange={setUrl}
            placeholder="https://abcd1234.supabase.co"
            autoComplete="off"
          />
          <TextField
            label="Publishable key"
            value={key}
            onChange={setKey}
            autoComplete="off"
            spellCheck={false}
            hint="Supabase → Project Settings → API Keys (sb_publishable_…, of de oude anon public key). Die mag openbaar zijn; de databaseregels houden alles privé."
          />
          {action.error && (
            <p className="field__error" role="alert">
              {action.error}
            </p>
          )}
          <div className="settings-actions">
            <button type="submit" className="btn btn--primary" disabled={action.busy}>
              {action.busy ? 'Verbinden…' : 'Koppelen'}
            </button>
            <button type="button" className="btn btn--quiet" onClick={() => setOpen(false)}>
              Annuleren
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- sign in */

function SignIn({ error }: { error: string | null }) {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const action = useAction();
  const engine = getSyncEngine();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setNotice(null);
    if (!EMAIL.test(email.trim())) return action.setError('Dat e-mailadres lijkt niet compleet.');
    if (password.length < 8)
      return action.setError('Gebruik een wachtwoord van minstens 8 tekens.');
    if (mode === 'up' && password !== repeat)
      return action.setError('De twee wachtwoorden zijn niet hetzelfde.');
    void action.run(async () => {
      if (!engine) throw new Error('Niet verbonden met een server.');
      if (mode === 'in') {
        await engine.signIn(email, password);
        toast('Ingelogd ♡');
      } else {
        const { needsConfirmation } = await engine.signUp(email, password);
        if (needsConfirmation) {
          setNotice(
            `Bijna: we hebben een bevestigingsmail gestuurd naar ${email.trim()}. Tik op de link erin (kijk ook bij spam), kom dan hier terug en log in.`,
          );
          setMode('in');
          setRepeat('');
        }
      }
    });
  };

  const forgot = () => {
    if (!EMAIL.test(email.trim()))
      return action.setError('Typ eerst je e-mail en tik dan op “Wachtwoord vergeten”.');
    void action.run(async () => {
      await engine?.requestPasswordReset(email);
      setNotice(
        'Als dat e-mailadres een account heeft, komt er een resetlink aan. Open hem op dit apparaat.',
      );
    });
  };

  return (
    <div className="together__body">
      <p className="settings-text">
        Log in om dit universe te delen. Jullie gebruiken allebei je eigen e-mail en wachtwoord —
        niemand anders komt erin.
      </p>
      <Segmented
        legend="Ik wil"
        value={mode}
        onChange={(m) => {
          setMode(m);
          action.setError(null);
        }}
        options={[
          { value: 'in', label: 'Inloggen' },
          { value: 'up', label: 'Een account maken' },
        ]}
      />
      <form className="form" onSubmit={submit} noValidate>
        <TextField
          label="E-mail"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={setEmail}
        />
        <TextField
          label="Wachtwoord"
          type="password"
          autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
          value={password}
          onChange={setPassword}
          hint={mode === 'up' ? 'Minstens 8 tekens. Het wordt nooit in de app bewaard.' : undefined}
        />
        {mode === 'up' && (
          <TextField
            label="Wachtwoord nog een keer"
            type="password"
            autoComplete="new-password"
            value={repeat}
            onChange={setRepeat}
          />
        )}
        {(action.error || error) && (
          <p className="field__error" role="alert">
            {action.error ?? error}
          </p>
        )}
        {notice && (
          <p className="notice" role="status">
            <ShieldCheck aria-hidden="true" />
            {notice}
          </p>
        )}
        <div className="settings-actions">
          <button type="submit" className="btn btn--primary" disabled={action.busy}>
            {action.busy ? 'Momentje…' : mode === 'in' ? 'Inloggen' : 'Account maken'}
          </button>
          {mode === 'in' && (
            <button
              type="button"
              className="btn btn--quiet"
              onClick={forgot}
              disabled={action.busy}
            >
              <KeyRound aria-hidden="true" /> Wachtwoord vergeten
            </button>
          )}
        </div>
      </form>
      <DeviceServerNote />
    </div>
  );
}

function NewPassword() {
  const [password, setPassword] = useState('');
  const action = useAction();
  return (
    <form
      className="form together__body"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (password.length < 8) return action.setError('Gebruik minstens 8 tekens.');
        void action.run(async () => {
          await getSyncEngine()?.updatePassword(password);
          toast('Nieuw wachtwoord opgeslagen');
        });
      }}
    >
      <p className="settings-text">Kies een nieuw wachtwoord voor je account.</p>
      <TextField
        label="Nieuw wachtwoord"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={setPassword}
      />
      {action.error && (
        <p className="field__error" role="alert">
          {action.error}
        </p>
      )}
      <button type="submit" className="btn btn--primary" disabled={action.busy}>
        Nieuw wachtwoord opslaan
      </button>
    </form>
  );
}

/* ---------------------------------------------------------- create space */

function CreateSpace({ sync }: { sync: SyncState }) {
  const partnerName = useContent((c) => c.profile.partnerName);
  const [email, setEmail] = useState('');
  const action = useAction();
  const engine = getSyncEngine();

  return (
    <div className="together__body">
      <p className="settings-text">
        Ingelogd als <strong>{sync.account?.email}</strong>.
      </p>
      <div className="together__choice">
        <h3>Start ons gedeelde universe</h3>
        <p className="settings-text">
          Alles op dit apparaat wordt de gedeelde versie. {partnerName} doet mee door een account te
          maken met het e-mailadres dat je hier uitnodigt.
        </p>
        <form
          className="form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!EMAIL.test(email.trim()))
              return action.setError(`Typ het e-mailadres van ${partnerName}.`);
            void action.run(async () => {
              await engine?.createSpace(email);
              toast('Ons universe is nu gedeeld ♡');
            });
          }}
        >
          <TextField
            label={`E-mail van ${partnerName}`}
            type="email"
            inputMode="email"
            value={email}
            onChange={setEmail}
            autoComplete="off"
          />
          {action.error && (
            <p className="field__error" role="alert">
              {action.error}
            </p>
          )}
          <button type="submit" className="btn btn--primary" disabled={action.busy}>
            <UserPlus aria-hidden="true" /> {action.busy ? 'Aanmaken…' : 'Aanmaken & uitnodigen'}
          </button>
        </form>
      </div>
      <div className="together__choice">
        <h3>Ben je uitgenodigd?</h3>
        <p className="settings-text">
          Je doet automatisch mee als je inlogt met het uitgenodigde e-mailadres (na het
          bevestigen). Net je account gemaakt?
        </p>
        <button
          type="button"
          className="btn btn--ghost btn--small"
          onClick={() => void engine?.connect()}
        >
          <RefreshCw aria-hidden="true" /> Opnieuw checken
        </button>
      </div>
      <button
        type="button"
        className="btn btn--quiet btn--small"
        onClick={() => void engine?.signOut()}
      >
        <LogOut aria-hidden="true" /> Uitloggen
      </button>
    </div>
  );
}

/* -------------------------------------------------------------- connected */

function Connected({ sync }: { sync: SyncState }) {
  const engine = getSyncEngine();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const action = useAction();
  const [, tick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => tick((n) => n + 1), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const status =
    sync.phase === 'syncing'
      ? { icon: <LoaderCircle className="spin" />, text: 'Synchroniseren…', tone: 'busy' }
      : sync.phase === 'offline'
        ? {
            icon: <CloudOff />,
            text: sync.pendingChanges
              ? 'Offline — je wijzigingen worden gesynct zodra je weer online bent'
              : 'Nu even offline',
            tone: 'offline',
          }
        : sync.phase === 'error'
          ? { icon: <CloudOff />, text: sync.error ?? 'Er ging iets mis', tone: 'error' }
          : { icon: <Cloud />, text: `Gesynct ${timeAgo(sync.lastSyncedAt)}`, tone: 'ok' };

  const signOut = async () => {
    const ok = await confirm({
      title: 'Uitloggen op dit apparaat?',
      message:
        'Dit apparaat houdt zijn eigen kopie, maar krijgt geen nieuwe herinneringen meer tot je weer inlogt. Het gedeelde universe blijft veilig online.',
      confirmLabel: 'Uitloggen',
    });
    if (ok) await engine?.signOut();
  };

  return (
    <div className="together__body">
      <p className={`together__status together__status--${status.tone}`} role="status">
        <span aria-hidden="true">{status.icon}</span>
        {status.text}
      </p>
      {sync.uploading > 0 && (
        <p className="together__upload">
          <CloudUpload aria-hidden="true" /> {sync.uploading}{' '}
          {sync.uploading === 1 ? 'foto' : 'foto’s'} uploaden…
        </p>
      )}

      <ul className="together__people">
        {sync.members.map((m) => (
          <li key={m}>
            <span className="together__dot is-in" aria-hidden="true" />
            <span className="together__who">
              {m} {m === sync.account?.email && <span className="tag">you</span>}
            </span>
          </li>
        ))}
        {sync.invites.map((m) => (
          <li key={m}>
            <span className="together__dot" aria-hidden="true" />
            <span className="together__who">
              {m} <span className="tag tag--sample">uitgenodigd · wacht om mee te doen</span>
            </span>
          </li>
        ))}
      </ul>

      {sync.members.length < 2 && (
        <>
          {!inviteOpen ? (
            <button
              type="button"
              className="btn btn--quiet btn--small"
              onClick={() => setInviteOpen(true)}
            >
              <UserPlus aria-hidden="true" />{' '}
              {sync.invites.length ? 'Uitgenodigd e-mailadres wijzigen' : 'Nodig de ander uit'}
            </button>
          ) : (
            <form
              className="form"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                if (!EMAIL.test(email.trim()))
                  return action.setError('Dat e-mailadres lijkt niet compleet.');
                void action.run(async () => {
                  await engine?.invite(email);
                  setInviteOpen(false);
                  setEmail('');
                  toast('Uitnodiging bijgewerkt');
                });
              }}
            >
              <TextField
                label="E-mail om uit te nodigen"
                type="email"
                inputMode="email"
                value={email}
                onChange={setEmail}
              />
              {action.error && (
                <p className="field__error" role="alert">
                  {action.error}
                </p>
              )}
              <div className="settings-actions">
                <button
                  type="submit"
                  className="btn btn--primary btn--small"
                  disabled={action.busy}
                >
                  Uitnodiging opslaan
                </button>
                <button
                  type="button"
                  className="btn btn--quiet btn--small"
                  onClick={() => setInviteOpen(false)}
                >
                  Annuleren
                </button>
              </div>
            </form>
          )}
          <p className="field__hint">
            Diegene opent de site, installeert hem en maakt een account met precies dit e-mailadres
            — dan zit diegene er automatisch in.
          </p>
        </>
      )}

      <div className="settings-actions">
        <button
          type="button"
          className="btn btn--ghost btn--small"
          onClick={() => void engine?.syncNow()}
          disabled={sync.phase === 'syncing'}
        >
          <RefreshCw aria-hidden="true" /> Nu syncen
        </button>
        <button type="button" className="btn btn--quiet btn--small" onClick={signOut}>
          <LogOut aria-hidden="true" /> Uitloggen
        </button>
      </div>
      <ChangePassword />
      <DeviceServerNote />
    </div>
  );
}

function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const action = useAction();

  if (!open) {
    return (
      <button type="button" className="link-btn together__password" onClick={() => setOpen(true)}>
        <KeyRound aria-hidden="true" /> Mijn wachtwoord wijzigen
      </button>
    );
  }
  const close = () => {
    setOpen(false);
    setPassword('');
    setRepeat('');
    action.setError(null);
  };
  return (
    <form
      className="form together__choice"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (password.length < 8) return action.setError('Gebruik minstens 8 tekens.');
        if (password !== repeat)
          return action.setError('De twee wachtwoorden zijn niet hetzelfde.');
        void action.run(async () => {
          await getSyncEngine()?.updatePassword(password);
          toast('Nieuw wachtwoord opgeslagen');
          close();
        });
      }}
    >
      <TextField
        label="Nieuw wachtwoord"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={setPassword}
      />
      <TextField
        label="Nieuw wachtwoord nog een keer"
        type="password"
        autoComplete="new-password"
        value={repeat}
        onChange={setRepeat}
      />
      {action.error && (
        <p className="field__error" role="alert">
          {action.error}
        </p>
      )}
      <div className="settings-actions">
        <button type="submit" className="btn btn--primary btn--small" disabled={action.busy}>
          Nieuw wachtwoord opslaan
        </button>
        <button type="button" className="btn btn--quiet btn--small" onClick={close}>
          Annuleren
        </button>
      </div>
    </form>
  );
}

function DeviceServerNote() {
  const config = getSyncConfig();
  if (config?.source !== 'device') return null;
  return (
    <p className="field__hint">
      Dit apparaat is handmatig gekoppeld.{' '}
      <button type="button" className="link-btn" onClick={() => void forgetThisDevicesServer()}>
        Dit apparaat loskoppelen van het project
      </button>
    </p>
  );
}
