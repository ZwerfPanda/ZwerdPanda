import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  Eraser,
  HardDrive,
  Music,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Upload,
  Volume2,
} from 'lucide-react';
import {
  resetAllLocalData,
  storageAvailable,
  updatePrefs,
  useContent,
  usePrefs,
} from '../../data/store';
import { countSamples, removeSampleContent, updateProfile } from '../../data/actions';
import { applyBackup, createBackup, downloadBlob, readBackup } from '../../data/backup';
import type { Profile, ThemeName } from '../../data/types';
import { MAX_AUDIO_BYTES, clearMedia, deleteMedia, formatBytes, putMedia } from '../../lib/media';
import { todayIso } from '../../lib/dates';
import { PageHeader, Segmented, TextArea, TextField } from '../../components/ui/Fields';
import { confirm, toast } from '../../components/ui/feedback';
import { useMusic } from '../../components/music/MusicProvider';
import { SiteFooter } from '../../components/common/SiteFooter';
import { validateStartDate } from '../home/StartDateDialog';
import { TogetherSection } from './TogetherSection';
import { disconnectBeforeReset, isSharing } from '../../sync/sync';
import { useInstall } from '../../pwa/install';
import { openInstallSheet } from '../../pwa/InstallSheet';
import './settings.css';

const THEMES: { value: ThemeName; label: string; colors: [string, string, string] }[] = [
  { value: 'blush', label: 'Blush', colors: ['#fbf4ea', '#b9646f', '#3f2140'] },
  { value: 'lavender', label: 'Lavender dusk', colors: ['#fbf4ea', '#7f6bbb', '#3a2552'] },
  { value: 'matcha', label: 'Matcha', colors: ['#fbf4ea', '#6f9160', '#2f3a2a'] },
  { value: 'midnight', label: 'Midnight', colors: ['#1b1222', '#e3a0ac', '#f3d9c9'] },
];

export function SettingsPage() {
  return (
    <div className="page settings-page">
      <PageHeader
        eyebrow="behind the scenes"
        title={
          <>
            <em>Settings</em>
          </>
        }
        lede="Our names, our date, the words on the front page, how everything looks and sounds — and backups, so none of it gets lost."
      />
      <div className="settings-grid">
        <ProfileSection />
        <TogetherSection />
        <AppSection />
        <LookSection />
        <SoundSection />
        <DataSection />
        <PrivacySection />
      </div>
      <SiteFooter />
    </div>
  );
}

function Section({
  id,
  title,
  kicker,
  children,
}: {
  id: string;
  title: string;
  kicker: string;
  children: React.ReactNode;
}) {
  return (
    <section className="settings-card" aria-labelledby={`${id}-title`}>
      <p className="settings-card__kicker hand">{kicker}</p>
      <h2 id={`${id}-title`} className="settings-card__title">
        {title}
      </h2>
      {children}
    </section>
  );
}

/* ---------------------------------------------------------------- Profile */

type ProfileDraft = Pick<
  Profile,
  | 'yourName'
  | 'partnerName'
  | 'siteTitle'
  | 'subtitle'
  | 'homeGreeting'
  | 'homeMessage'
  | 'signature'
> & {
  startDate: string;
};

function ProfileSection() {
  const profile = useContent((c) => c.profile);
  const toDraft = (p: Profile): ProfileDraft => ({
    yourName: p.yourName,
    partnerName: p.partnerName,
    siteTitle: p.siteTitle,
    subtitle: p.subtitle,
    homeGreeting: p.homeGreeting,
    homeMessage: p.homeMessage,
    signature: p.signature,
    startDate: p.startDate ?? '',
  });
  const [draft, setDraft] = useState<ProfileDraft>(() => toDraft(profile));
  const [errors, setErrors] = useState<Partial<Record<keyof ProfileDraft, string>>>({});
  const saved = useMemo(() => toDraft(profile), [profile]);
  const dirty = JSON.stringify(saved) !== JSON.stringify(draft);

  // Pick up outside changes (e.g. the date set from the home page) when not mid-edit.
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useEffect(() => {
    if (!dirtyRef.current) setDraft(saved);
  }, [saved]);

  const set = (key: keyof ProfileDraft, value: string) => setDraft((d) => ({ ...d, [key]: value }));

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    const problems: typeof errors = {};
    if (!draft.yourName.trim()) problems.yourName = 'Your name can’t be empty.';
    if (!draft.partnerName.trim()) problems.partnerName = 'Her name can’t be empty.';
    if (!draft.siteTitle.trim()) problems.siteTitle = 'Give the universe a name.';
    if (draft.startDate) {
      const dateProblem = validateStartDate(draft.startDate);
      if (dateProblem) problems.startDate = dateProblem;
    }
    setErrors(problems);
    if (Object.keys(problems).length) {
      toast('A few things need a look before saving.', { tone: 'error' });
      return;
    }
    updateProfile({
      yourName: draft.yourName.trim(),
      partnerName: draft.partnerName.trim(),
      siteTitle: draft.siteTitle.trim(),
      subtitle: draft.subtitle.trim(),
      homeGreeting: draft.homeGreeting.trim(),
      homeMessage: draft.homeMessage.trim(),
      signature: draft.signature.trim(),
      startDate: draft.startDate || null,
    });
    toast('Saved ♡');
  };

  return (
    <Section id="profile" title="Us & our words" kicker="the important bits">
      <form className="form" onSubmit={save} noValidate>
        <div className="form-row form-row--2">
          <TextField
            label="Your name"
            value={draft.yourName}
            onChange={(v) => set('yourName', v)}
            error={errors.yourName}
            maxLength={60}
            autoComplete="off"
          />
          <TextField
            label="Her name"
            value={draft.partnerName}
            onChange={(v) => set('partnerName', v)}
            error={errors.partnerName}
            maxLength={60}
            autoComplete="off"
          />
        </div>
        <TextField
          label="Our start date"
          type="date"
          optional
          max={todayIso()}
          value={draft.startDate}
          onChange={(v) => set('startDate', v)}
          error={errors.startDate}
          hint="Used for the “together for” counter and anniversary countdown. Never guessed — only what we enter here."
        />
        <div className="form-row form-row--2">
          <TextField
            label="Name of our universe"
            value={draft.siteTitle}
            onChange={(v) => set('siteTitle', v)}
            error={errors.siteTitle}
            maxLength={80}
          />
          <TextField
            label="Subtitle"
            optional
            value={draft.subtitle}
            onChange={(v) => set('subtitle', v)}
            maxLength={160}
          />
        </div>
        <TextField
          label="Greeting on the home note"
          optional
          value={draft.homeGreeting}
          onChange={(v) => set('homeGreeting', v)}
          maxLength={80}
        />
        <TextArea
          label="The note on the home page"
          optional
          value={draft.homeMessage}
          onChange={(v) => set('homeMessage', v)}
          rows={6}
          hint="Leave an empty line between paragraphs. Leave it blank to hide the note."
        />
        <TextField
          label="Signature"
          optional
          value={draft.signature}
          onChange={(v) => set('signature', v)}
          maxLength={120}
          hint="Shown at the bottom of every page."
        />
        <div className="settings-actions">
          <button type="submit" className="btn btn--primary" disabled={!dirty}>
            Save changes
          </button>
          {dirty && (
            <button
              type="button"
              className="btn btn--quiet"
              onClick={() => {
                setDraft(saved);
                setErrors({});
              }}
            >
              Undo edits
            </button>
          )}
        </div>
      </form>
    </Section>
  );
}

/* -------------------------------------------------------------------- App */

function AppSection() {
  const install = useInstall();
  return (
    <Section id="app" title="The app" kicker="on any phone or computer">
      <p className="settings-text">
        {install.installed
          ? 'You’re using the installed app on this device. ♡'
          : 'Install our universe like an app: it gets its own icon, opens full-screen and works offline — on iPhone, Android, Windows and Mac. No app store needed.'}
      </p>
      <div className="settings-actions">
        <button type="button" className="btn btn--primary" onClick={openInstallSheet}>
          <Smartphone aria-hidden="true" />{' '}
          {install.installed ? 'Install on another device' : 'Install the app'}
        </button>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------- Look */

function LookSection() {
  const theme = useContent((c) => c.profile.theme);
  const prefs = usePrefs();
  return (
    <Section id="look" title="Look & feel" kicker="make it ours">
      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="field__label" style={{ marginBottom: 10 }}>
          Colours
        </legend>
        <div className="theme-cards">
          {THEMES.map((t) => (
            <label key={t.value} className="theme-card">
              <input
                type="radio"
                name="theme"
                checked={theme === t.value}
                onChange={() => updateProfile({ theme: t.value })}
              />
              <span className="theme-card__face">
                <span className="theme-card__swatch" style={{ background: t.colors[0] }}>
                  <i style={{ background: t.colors[1] }} />
                  <i style={{ background: t.colors[2] }} />
                </span>
                <span className="theme-card__label">{t.label}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="form" style={{ marginTop: 22 }}>
        <Segmented
          legend="Animation"
          value={prefs.motion}
          onChange={(motion) => updatePrefs({ motion })}
          options={[
            { value: 'system', label: 'Follow my phone' },
            { value: 'reduce', label: 'Calm' },
            { value: 'full', label: 'All the sparkle' },
          ]}
          hint="“Calm” keeps everything still and simple — handy if movement feels like too much."
        />
        <Segmented
          legend="Opening scene"
          value={prefs.intro}
          onChange={(intro) => updatePrefs({ intro })}
          options={[
            { value: 'session', label: 'Once per visit' },
            { value: 'always', label: 'Every time' },
            { value: 'never', label: 'Skip it' },
          ]}
        />
        <Segmented
          legend="Light in Our Little World"
          value={prefs.worldLight}
          onChange={(worldLight) => updatePrefs({ worldLight })}
          options={[
            { value: 'auto', label: 'Follow the clock' },
            { value: 'day', label: 'Day' },
            { value: 'dusk', label: 'Dusk' },
            { value: 'night', label: 'Night' },
          ]}
        />
      </div>
      <p className="field__hint" style={{ marginTop: 14 }}>
        Animation, intro and lighting are remembered on this device only.
      </p>
    </Section>
  );
}

/* ------------------------------------------------------------------ Sound */

function SoundSection() {
  const prefs = usePrefs();
  const music = useMusic();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith('audio/')) {
      setError('That file isn’t audio. Try an MP3 or M4A.');
      return;
    }
    if (file.size > MAX_AUDIO_BYTES) {
      setError(
        `That song is ${formatBytes(file.size)} — up to ${formatBytes(MAX_AUDIO_BYTES)} fits here.`,
      );
      return;
    }
    try {
      const old = prefs.customSoundtrackId;
      const id = await putMedia(file, file.name);
      updatePrefs({
        customSoundtrackId: id,
        customSoundtrackName: file.name.replace(/\.[^.]+$/, ''),
        soundtrack: 'custom',
      });
      if (old) await deleteMedia(old);
      toast('Our soundtrack is set');
    } catch {
      setError('This browser couldn’t store the song.');
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const removeSong = async () => {
    const id = prefs.customSoundtrackId;
    updatePrefs({
      customSoundtrackId: undefined,
      customSoundtrackName: undefined,
      soundtrack: 'musicbox',
    });
    if (id) await deleteMedia(id).catch(() => undefined);
  };

  return (
    <Section id="sound" title="Sound" kicker="nothing ever autoplays">
      <div className="form">
        <Segmented
          legend="Our soundtrack"
          value={prefs.soundtrack}
          onChange={(soundtrack) => {
            if (soundtrack === 'custom' && !prefs.customSoundtrackId) {
              inputRef.current?.click();
              return;
            }
            updatePrefs({ soundtrack });
          }}
          options={[
            { value: 'musicbox', label: 'Little music box' },
            {
              value: 'custom',
              label: prefs.customSoundtrackName
                ? `“${prefs.customSoundtrackName}”`
                : 'Our own song',
            },
          ]}
          hint="The music box is an original lullaby made for this site. Your own song is an audio file stored on this device."
        />
        <div className="settings-actions">
          <button type="button" className="btn btn--soft" onClick={music.toggle}>
            {music.playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
            {music.playing ? 'Pause' : 'Play it'}
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => inputRef.current?.click()}
          >
            <Music aria-hidden="true" />{' '}
            {prefs.customSoundtrackId ? 'Choose a different song' : 'Upload our song'}
          </button>
          {prefs.customSoundtrackId && (
            <button type="button" className="btn btn--quiet" onClick={removeSong}>
              Remove song
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          hidden
          onChange={(e) => upload(e.target.files?.[0])}
        />
        {error && (
          <p className="field__error" role="alert">
            {error}
          </p>
        )}
        <div className="field">
          <label className="field__label" htmlFor="volume">
            <Volume2
              aria-hidden="true"
              style={{
                display: 'inline-block',
                width: 16,
                height: 16,
                verticalAlign: '-3px',
                marginRight: 6,
              }}
            />
            Volume
          </label>
          <input
            id="volume"
            className="range"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={prefs.volume}
            onChange={(e) => updatePrefs({ volume: Number(e.target.value) })}
            aria-valuetext={`${Math.round(prefs.volume * 100)}%`}
          />
        </div>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------- Data */

function DataSection() {
  const content = useContent((c) => c);
  const samples = countSamples(content);
  const importRef = useRef<HTMLInputElement>(null);
  const [usage, setUsage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    navigator.storage
      ?.estimate?.()
      .then(({ usage: used, quota }) => {
        if (used !== undefined && quota)
          setUsage(`${formatBytes(used)} used of about ${formatBytes(quota)} available`);
      })
      .catch(() => undefined);
  }, [content]);

  const exportBackup = async (withMedia: boolean) => {
    setBusy(withMedia ? 'export-media' : 'export');
    try {
      const { blob, filename, mediaCount } = await createBackup(withMedia);
      downloadBlob(blob, filename);
      toast(
        withMedia
          ? `Backup saved with ${mediaCount} photos/clips (${formatBytes(blob.size)})`
          : 'Backup saved',
      );
    } catch {
      toast('The backup couldn’t be created.', { tone: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const importBackup = async (file: File | undefined) => {
    if (importRef.current) importRef.current.value = '';
    if (!file) return;
    setBusy('import');
    try {
      const preview = await readBackup(file);
      const ok = await confirm({
        title: 'Restore this backup?',
        message: `It contains ${preview.summary} Everything currently on this device will be replaced by it.${
          isSharing()
            ? ' Because our universe is shared, the other phone gets this version too.'
            : ''
        }`,
        confirmLabel: 'Replace & restore',
        tone: 'danger',
      });
      if (ok) {
        await applyBackup(preview);
        toast('Backup restored ♡');
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : 'That backup couldn’t be read.', {
        tone: 'error',
      });
    } finally {
      setBusy(null);
    }
  };

  const removeSamples = async () => {
    const ok = await confirm({
      title: `Remove ${samples} sample items?`,
      message:
        'This clears the placeholder chapters, memories, starter letters and dreams, so only what we’ve written ourselves remains. Things you’ve edited are kept.',
      confirmLabel: 'Remove samples',
      tone: 'danger',
    });
    if (!ok) return;
    removeSampleContent();
    toast('Sample content removed — it’s all ours now');
  };

  const resetEverything = async () => {
    const ok = await confirm({
      title: 'Erase everything on this device?',
      message: isSharing()
        ? 'This device signs out of our shared universe and forgets everything stored on it. The shared universe online — and the other phone — stay exactly as they are.'
        : 'All chapters, photos, letters, dreams and settings stored in this browser will be deleted and the starter content comes back. This cannot be undone — export a backup first if you want to keep anything.',
      confirmLabel: 'Erase everything',
      tone: 'danger',
    });
    if (!ok) return;
    await disconnectBeforeReset();
    await clearMedia().catch(() => undefined);
    resetAllLocalData();
    toast('Everything was reset');
  };

  return (
    <Section id="data" title="Our data & backups" kicker="keep it safe">
      {!storageAvailable && (
        <p className="notice" role="alert">
          <HardDrive aria-hidden="true" />
          This browser is blocking storage (private browsing?), so changes won’t be kept after
          closing the page.
        </p>
      )}
      <p className="settings-text">
        Everything lives in this browser on this device. Export a backup now and then — it’s also
        how content moves to another phone for now.
      </p>
      {usage && <p className="field__hint">{usage}</p>}
      <div className="settings-actions">
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => exportBackup(true)}
          disabled={busy !== null}
        >
          <Download aria-hidden="true" />{' '}
          {busy === 'export-media' ? 'Packing photos…' : 'Export with photos'}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => exportBackup(false)}
          disabled={busy !== null}
        >
          <Download aria-hidden="true" /> Text only
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => importRef.current?.click()}
          disabled={busy !== null}
        >
          <Upload aria-hidden="true" /> {busy === 'import' ? 'Reading…' : 'Restore a backup'}
        </button>
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => importBackup(e.target.files?.[0])}
        />
      </div>

      <div className="settings-danger">
        <div>
          <h3>Sample content</h3>
          <p className="settings-text">
            {samples > 0
              ? `${samples} placeholder items are still here (marked “Sample” or “Starter”).`
              : 'No sample content left — everything here is ours.'}
          </p>
        </div>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={removeSamples}
          disabled={samples === 0}
        >
          <Eraser aria-hidden="true" /> Remove samples
        </button>
      </div>
      <div className="settings-danger">
        <div>
          <h3>Start over</h3>
          <p className="settings-text">Erase everything stored on this device.</p>
        </div>
        <button type="button" className="btn btn--danger" onClick={resetEverything}>
          <RotateCcw aria-hidden="true" /> Erase everything
        </button>
      </div>
      <p className="field__hint">
        Currently {content.memories.length} memories, {content.letters.length} letters and{' '}
        {content.milestones.length} chapters.
      </p>
    </Section>
  );
}

/* ---------------------------------------------------------------- Privacy */

function PrivacySection() {
  return (
    <Section id="privacy" title="Privacy & sharing" kicker="being honest">
      <ul className="settings-list">
        <li>
          <strong>Without sharing:</strong> nothing leaves this device. Photos, letters and
          everything else stay in this browser.
        </li>
        <li>
          <strong>With sharing:</strong> our universe lives in our own Supabase project. Only the
          two signed-in accounts can read it — the database itself enforces that, and photos sit in
          a private folder only we can open.
        </li>
        <li>
          <strong>Passwords</strong> are never stored in the app. A device stays signed in with a
          session that can be ended any time with “Sign out”.
        </li>
        <li>
          <strong>Without an account</strong>, there’s no password screen: a lock without a real
          server would only look secure. Anyone holding this unlocked phone can open the site.
        </li>
      </ul>
      <p className="notice notice--plain" style={{ marginTop: 16 }}>
        <ShieldCheck aria-hidden="true" />
        Browsers can clear website data when a phone runs low on space. Adding the site to the Home
        Screen and keeping a recent backup makes that much less likely to hurt.
      </p>
    </Section>
  );
}
