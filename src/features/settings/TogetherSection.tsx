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
import type { SyncState } from '../../sync/types';

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const seconds = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (seconds < 45) return 'just now';
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)} h ago`;
  return new Date(iso).toLocaleDateString();
}

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
      setError(e instanceof Error ? e.message : 'Something went wrong.');
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
        Together on every device
      </h2>
      {sync.recovery ? (
        <NewPassword />
      ) : sync.phase === 'off' ? (
        <NotConfigured />
      ) : sync.phase === 'starting' ? (
        <p className="together__status">
          <LoaderCircle className="spin" aria-hidden="true" /> Connecting…
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
        Right now everything lives on <strong>this device only</strong>. Connect our own free,
        private Supabase project and you’ll both see the same memories, letters and photos on every
        phone and computer — updated live.
      </p>
      <p className="settings-text">
        The step-by-step guide (in Dutch) is in <code>docs/HANDLEIDING.md</code>. Once the site is
        set up with the project, this section turns into a simple sign-in.
      </p>
      {!open ? (
        <button type="button" className="btn btn--ghost btn--small" onClick={() => setOpen(true)}>
          <Cloud aria-hidden="true" /> Connect a project on this device
        </button>
      ) : (
        <form
          className="form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (looksLikeSecretKey(key)) {
              action.setError(
                'That’s the secret key — never put it in a website. Use the publishable (or anon public) key.',
              );
              return;
            }
            if (!isValidConfig(url, key)) {
              action.setError(
                'Paste the Project URL (https://….supabase.co) and the publishable key.',
              );
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
            hint="Supabase → Project Settings → API Keys (sb_publishable_…, or the legacy anon public key). It’s meant to be public; the database rules keep everything private."
          />
          {action.error && (
            <p className="field__error" role="alert">
              {action.error}
            </p>
          )}
          <div className="settings-actions">
            <button type="submit" className="btn btn--primary" disabled={action.busy}>
              {action.busy ? 'Connecting…' : 'Connect'}
            </button>
            <button type="button" className="btn btn--quiet" onClick={() => setOpen(false)}>
              Cancel
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
    if (!EMAIL.test(email.trim())) return action.setError('That email address looks incomplete.');
    if (password.length < 8) return action.setError('Use a password of at least 8 characters.');
    if (mode === 'up' && password !== repeat)
      return action.setError('The two passwords aren’t the same.');
    void action.run(async () => {
      if (!engine) throw new Error('Not connected to a server.');
      if (mode === 'in') {
        await engine.signIn(email, password);
        toast('Signed in ♡');
      } else {
        const { needsConfirmation } = await engine.signUp(email, password);
        if (needsConfirmation) {
          setNotice(
            `Almost there: we sent a confirmation email to ${email.trim()}. Tap the link in it (check spam too), then come back here and sign in.`,
          );
          setMode('in');
          setRepeat('');
        }
      }
    });
  };

  const forgot = () => {
    if (!EMAIL.test(email.trim()))
      return action.setError('Type your email first, then tap “Forgot password”.');
    void action.run(async () => {
      await engine?.requestPasswordReset(email);
      setNotice(
        'If that email has an account, a reset link is on its way. Open it on this device.',
      );
    });
  };

  return (
    <div className="together__body">
      <p className="settings-text">
        Sign in to share this universe. Each of you uses your own email and password — nobody else
        can get in.
      </p>
      <Segmented
        legend="I want to"
        value={mode}
        onChange={(m) => {
          setMode(m);
          action.setError(null);
        }}
        options={[
          { value: 'in', label: 'Sign in' },
          { value: 'up', label: 'Create an account' },
        ]}
      />
      <form className="form" onSubmit={submit} noValidate>
        <TextField
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={setEmail}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
          value={password}
          onChange={setPassword}
          hint={mode === 'up' ? 'At least 8 characters. It’s never stored in the app.' : undefined}
        />
        {mode === 'up' && (
          <TextField
            label="Password again"
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
            {action.busy ? 'One moment…' : mode === 'in' ? 'Sign in' : 'Create account'}
          </button>
          {mode === 'in' && (
            <button
              type="button"
              className="btn btn--quiet"
              onClick={forgot}
              disabled={action.busy}
            >
              <KeyRound aria-hidden="true" /> Forgot password
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
        if (password.length < 8) return action.setError('Use at least 8 characters.');
        void action.run(async () => {
          await getSyncEngine()?.updatePassword(password);
          toast('New password saved');
        });
      }}
    >
      <p className="settings-text">Choose a new password for your account.</p>
      <TextField
        label="New password"
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
        Save new password
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
        Signed in as <strong>{sync.account?.email}</strong>.
      </p>
      <div className="together__choice">
        <h3>Start our shared universe</h3>
        <p className="settings-text">
          Everything on this device becomes the shared copy. {partnerName} joins by creating an
          account with the email you invite here.
        </p>
        <form
          className="form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!EMAIL.test(email.trim()))
              return action.setError(`Type ${partnerName}’s email address.`);
            void action.run(async () => {
              await engine?.createSpace(email);
              toast('Our universe is shared now ♡');
            });
          }}
        >
          <TextField
            label={`${partnerName}’s email`}
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
            <UserPlus aria-hidden="true" /> {action.busy ? 'Creating…' : 'Create & invite'}
          </button>
        </form>
      </div>
      <div className="together__choice">
        <h3>Were you invited?</h3>
        <p className="settings-text">
          You join automatically when you sign in with the invited email address (after confirming
          it). Created the account just now?
        </p>
        <button
          type="button"
          className="btn btn--ghost btn--small"
          onClick={() => void engine?.connect()}
        >
          <RefreshCw aria-hidden="true" /> Check again
        </button>
      </div>
      <button
        type="button"
        className="btn btn--quiet btn--small"
        onClick={() => void engine?.signOut()}
      >
        <LogOut aria-hidden="true" /> Sign out
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
      ? { icon: <LoaderCircle className="spin" />, text: 'Syncing…', tone: 'busy' }
      : sync.phase === 'offline'
        ? {
            icon: <CloudOff />,
            text: sync.pendingChanges
              ? 'Offline — your changes will sync when you’re back online'
              : 'Offline right now',
            tone: 'offline',
          }
        : sync.phase === 'error'
          ? { icon: <CloudOff />, text: sync.error ?? 'Something went wrong', tone: 'error' }
          : { icon: <Cloud />, text: `Synced ${timeAgo(sync.lastSyncedAt)}`, tone: 'ok' };

  const signOut = async () => {
    const ok = await confirm({
      title: 'Sign out on this device?',
      message:
        'This device keeps its own copy, but stops receiving new memories until you sign in again. The shared universe stays safe online.',
      confirmLabel: 'Sign out',
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
          <CloudUpload aria-hidden="true" /> Uploading {sync.uploading} photo
          {sync.uploading === 1 ? '' : 's'}…
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
              {m} <span className="tag tag--sample">invited · waiting to join</span>
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
              {sync.invites.length ? 'Change the invited email' : 'Invite the other person'}
            </button>
          ) : (
            <form
              className="form"
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                if (!EMAIL.test(email.trim()))
                  return action.setError('That email address looks incomplete.');
                void action.run(async () => {
                  await engine?.invite(email);
                  setInviteOpen(false);
                  setEmail('');
                  toast('Invite updated');
                });
              }}
            >
              <TextField
                label="Email to invite"
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
                  Save invite
                </button>
                <button
                  type="button"
                  className="btn btn--quiet btn--small"
                  onClick={() => setInviteOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
          <p className="field__hint">
            They open the site, install it, and create an account with exactly this email — they’re
            in automatically.
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
          <RefreshCw aria-hidden="true" /> Sync now
        </button>
        <button type="button" className="btn btn--quiet btn--small" onClick={signOut}>
          <LogOut aria-hidden="true" /> Sign out
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
        <KeyRound aria-hidden="true" /> Change my password
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
        if (password.length < 8) return action.setError('Use at least 8 characters.');
        if (password !== repeat) return action.setError('The two passwords aren’t the same.');
        void action.run(async () => {
          await getSyncEngine()?.updatePassword(password);
          toast('New password saved');
          close();
        });
      }}
    >
      <TextField
        label="New password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={setPassword}
      />
      <TextField
        label="New password again"
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
          Save new password
        </button>
        <button type="button" className="btn btn--quiet btn--small" onClick={close}>
          Cancel
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
      This device was connected by hand.{' '}
      <button type="button" className="link-btn" onClick={() => void forgetThisDevicesServer()}>
        Disconnect this device from the project
      </button>
    </p>
  );
}
