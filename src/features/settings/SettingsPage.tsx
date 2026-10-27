import { useEffect, useMemo, useRef, useState } from 'react';
import { enableNotifications, notificationPermission } from '../../lib/notify';
import {
  Download,
  Eraser,
  Eye,
  HardDrive,
  Music,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Upload,
  Volume2,
} from 'lucide-react';
import { openNews } from '../news/news';
import {
  resetAllLocalData,
  storageAvailable,
  updateContent,
  updatePrefs,
  useContent,
  usePrefs,
} from '../../data/store';
import { countSamples, removeSampleContent, updateProfile } from '../../data/actions';
import { applyBackup, createBackup, downloadBlob, readBackup } from '../../data/backup';
import type { Profile, ThemeName } from '../../data/types';
import { LAST_BACKUP_KEY, SafetySection } from './SafetySection';
import { MAX_AUDIO_BYTES, clearMedia, deleteMedia, formatBytes, putMedia } from '../../lib/media';
import { formatTimestamp, todayIso } from '../../lib/dates';
import { previewWelcome } from '../welcome/Welcome';
import { Checkbox, PageHeader, Segmented, TextArea, TextField } from '../../components/ui/Fields';
import { spotifyItem } from '../../lib/embeds';
import { confirm, toast } from '../../components/ui/feedback';
import { useMusic } from '../../components/music/MusicProvider';
import { SiteFooter } from '../../components/common/SiteFooter';
import { validateStartDate } from '../home/StartDateDialog';
import { TogetherSection } from './TogetherSection';
import { OwnTexts } from '../texts/OwnTexts';
import { useIsOwner } from '../texts/TextEditor';
import { TicketAdmin } from '../games/TicketAdmin';
import { PushSetup } from './PushSetup';
import { disablePush, enablePush, pushEnabled, pushSupport } from '../../lib/push';
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
            <em>Instellingen</em>
          </>
        }
        lede="Onze namen, onze datum, de woorden op de voorpagina, hoe alles eruitziet en klinkt — en backups, zodat er niets verloren gaat."
      />
      <SettingsNav />
      <div className="settings-grid">
        <ProfileSection />
        <TextsSection />
        <TicketsSection />
        <PushSection />
        <TogetherSection />
        <WelcomeSection />
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

/** A row of chips to jump to each card: the page is long on a phone. */
function SettingsNav() {
  const [cards, setCards] = useState<{ id: string; label: string }[]>([]);
  useEffect(() => {
    const read = () =>
      setCards(
        [...document.querySelectorAll<HTMLElement>('.settings-grid > .settings-card')]
          .map((card) => {
            const title = card.querySelector('h2');
            return { id: title?.id ?? '', label: title?.textContent?.trim() ?? '' };
          })
          .filter((c) => c.id && c.label),
      );
    read();
    // Some cards only appear once the sync knows who's who.
    const grid = document.querySelector('.settings-grid');
    const watch = grid ? new MutationObserver(read) : null;
    if (grid) watch!.observe(grid, { childList: true });
    return () => watch?.disconnect();
  }, []);
  if (cards.length < 3) return null;
  return (
    <nav className="chip-row settings-nav" aria-label="Naar een onderdeel">
      {cards.map((c) => (
        <button
          key={c.id}
          type="button"
          className="chip"
          onClick={() =>
            document
              .getElementById(c.id)
              ?.closest('section')
              ?.scrollIntoView({ behavior: 'smooth' })
          }
        >
          {c.label}
        </button>
      ))}
    </nav>
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

/* ------------------------------------------------------------ His texts */

function TextsSection() {
  const owner = useIsOwner();
  if (!owner) return null;
  return (
    <Section id="texts" title="Jouw teksten" kicker="in your own words">
      <OwnTexts />
    </Section>
  );
}

function PushSection() {
  const owner = useIsOwner();
  if (!owner) return null;
  return (
    <Section id="push-setup" title="Meldingen instellen" kicker="only for you">
      <PushSetup />
    </Section>
  );
}

function TicketsSection() {
  const owner = useIsOwner();
  if (!owner) return null;
  return (
    <Section id="tickets" title="Tickets van de arcade" kicker="only for you">
      <TicketAdmin />
    </Section>
  );
}

/* ---------------------------------------------------------------- Welcome */

function WelcomeSection() {
  const welcome = useContent((c) => c.welcome);
  const profile = useContent((c) => c.profile);
  const [title, setTitle] = useState(welcome.title);
  const [message, setMessage] = useState(welcome.message);
  const [signature, setSignature] = useState(welcome.signature);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTitle(welcome.title);
    setMessage(welcome.message);
    setSignature(welcome.signature);
  }, [welcome.title, welcome.message, welcome.signature]);

  const dirty =
    title !== welcome.title || message !== welcome.message || signature !== welcome.signature;
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (!message.trim()) {
      setError('Schrijf een paar woorden — dit is het eerste wat ze leest.');
      return;
    }
    setError(null);
    updateContent((c) => ({
      ...c,
      welcome: {
        ...c.welcome,
        title: title.trim(),
        message: message.trim(),
        signature: signature.trim(),
      },
    }));
    toast('Welkom opgeslagen');
  };
  const setWelcome = (patch: Partial<typeof welcome>) =>
    updateContent((c) => ({ ...c, welcome: { ...c.welcome, ...patch } }));

  return (
    <Section
      id="welcome"
      title={`Een welkom voor ${profile.partnerName}`}
      kicker="the very first moment"
    >
      <p className="settings-text">
        De eerste keer dat {profile.partnerName} op haar telefoon inlogt, opent ons universe met dit
        bericht — één keer, schermvullend, met Coco die binnen komt huppen. Alleen zij ziet het.
      </p>
      <Checkbox
        label="Laat het welkom zien de eerste keer dat ze inlogt"
        checked={welcome.enabled}
        onChange={(on) => setWelcome({ enabled: on })}
      />
      <form className="form" onSubmit={save} noValidate>
        <TextField
          label="Titel"
          optional
          value={title}
          onChange={setTitle}
          placeholder={`Welcome home, ${profile.partnerName}`}
          maxLength={120}
        />
        <TextArea label="Bericht" value={message} onChange={setMessage} rows={6} error={error} />
        <TextField
          label="Ondertekend"
          optional
          value={signature}
          onChange={setSignature}
          placeholder={`— ${profile.yourName}`}
          maxLength={80}
        />
        <div className="settings-actions">
          <button type="submit" className="btn btn--primary" disabled={!dirty}>
            Welkom opslaan
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={previewWelcome}
            disabled={dirty}
          >
            <Eye aria-hidden="true" /> Preview
          </button>
        </div>
      </form>
      <p className="field__hint">
        {welcome.seenAt ? (
          <>
            {profile.partnerName} opende het op {formatTimestamp(welcome.seenAt)} ♡{' '}
            <button
              type="button"
              className="link-btn"
              onClick={() => setWelcome({ seenAt: undefined })}
            >
              Laat het volgende keer weer zien
            </button>
          </>
        ) : (
          'Nog niet gezien.'
        )}
      </p>
    </Section>
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
    if (!draft.yourName.trim()) problems.yourName = 'Je naam mag niet leeg zijn.';
    if (!draft.partnerName.trim()) problems.partnerName = 'Haar naam mag niet leeg zijn.';
    if (!draft.siteTitle.trim()) problems.siteTitle = 'Geef het universe een naam.';
    if (draft.startDate) {
      const dateProblem = validateStartDate(draft.startDate);
      if (dateProblem) problems.startDate = dateProblem;
    }
    setErrors(problems);
    if (Object.keys(problems).length) {
      toast('Een paar dingetjes kloppen nog niet.', { tone: 'error' });
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
    toast('Opgeslagen ♡');
  };

  return (
    <Section id="profile" title="Wij & onze woorden" kicker="the important bits">
      <form className="form" onSubmit={save} noValidate>
        <div className="form-row form-row--2">
          <TextField
            label="Jouw naam"
            value={draft.yourName}
            onChange={(v) => set('yourName', v)}
            error={errors.yourName}
            maxLength={60}
            autoComplete="off"
          />
          <TextField
            label="Haar naam"
            value={draft.partnerName}
            onChange={(v) => set('partnerName', v)}
            error={errors.partnerName}
            maxLength={60}
            autoComplete="off"
          />
        </div>
        <TextField
          label="Onze startdatum"
          type="date"
          optional
          max={todayIso()}
          value={draft.startDate}
          onChange={(v) => set('startDate', v)}
          error={errors.startDate}
          hint="Voor de “samen sinds”-teller en de aftelling naar ons jubileum. Nooit gegokt — alleen wat we hier invullen."
        />
        <div className="form-row form-row--2">
          <TextField
            label="Naam van ons universe"
            value={draft.siteTitle}
            onChange={(v) => set('siteTitle', v)}
            error={errors.siteTitle}
            maxLength={80}
          />
          <TextField
            label="Ondertitel"
            optional
            value={draft.subtitle}
            onChange={(v) => set('subtitle', v)}
            maxLength={160}
          />
        </div>
        <TextField
          label="Aanhef van het briefje op home"
          optional
          value={draft.homeGreeting}
          onChange={(v) => set('homeGreeting', v)}
          maxLength={80}
        />
        <TextArea
          label="Het briefje op de homepagina"
          optional
          value={draft.homeMessage}
          onChange={(v) => set('homeMessage', v)}
          rows={6}
          hint="Laat een lege regel tussen alinea’s. Laat het leeg om het briefje te verbergen."
        />
        <TextField
          label="Handtekening"
          optional
          value={draft.signature}
          onChange={(v) => set('signature', v)}
          maxLength={120}
          hint="Staat onderaan elke pagina."
        />
        <div className="settings-actions">
          <button type="submit" className="btn btn--primary" disabled={!dirty}>
            Wijzigingen opslaan
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
              Wijzigingen terugdraaien
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
  const { companion } = usePrefs();
  return (
    <Section id="app" title="De app" kicker="on any phone or computer">
      <p className="settings-text">
        {install.installed
          ? 'Je gebruikt de geïnstalleerde app op dit apparaat. ♡'
          : 'Installeer ons universe als een app: hij krijgt een eigen icoontje, opent schermvullend en werkt offline — op iPhone, Android, Windows en Mac. Geen app store nodig.'}
      </p>
      <div className="settings-actions">
        <button type="button" className="btn btn--primary" onClick={openInstallSheet}>
          <Smartphone aria-hidden="true" />{' '}
          {install.installed ? 'Installeren op een ander apparaat' : 'Installeer de app'}
        </button>
        <button type="button" className="btn btn--soft" onClick={openNews}>
          <Sparkles aria-hidden="true" /> Wat is er nieuw?
        </button>
      </div>
      <Checkbox
        label="Neem Coco mee — ze hupt mee in een hoekje van elke pagina"
        checked={companion}
        onChange={(on) => updatePrefs({ companion: on })}
      />
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
          Kleuren
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
          legend="Animatie"
          value={prefs.motion}
          onChange={(motion) => updatePrefs({ motion })}
          options={[
            { value: 'system', label: 'Zoals mijn telefoon' },
            { value: 'reduce', label: 'Rustig' },
            { value: 'full', label: 'All the sparkle' },
          ]}
          hint="“Rustig” houdt alles stil en simpel — fijn als beweging te veel voelt."
        />
        <Segmented
          legend="Openingsscène"
          value={prefs.intro}
          onChange={(intro) => updatePrefs({ intro })}
          options={[
            { value: 'session', label: 'Eén keer per bezoek' },
            { value: 'always', label: 'Elke keer' },
            { value: 'never', label: 'Overslaan' },
          ]}
        />
        <Segmented
          legend="Licht in Onze Kleine Wereld"
          value={prefs.worldLight}
          onChange={(worldLight) => updatePrefs({ worldLight })}
          options={[
            { value: 'auto', label: 'Volg de klok' },
            { value: 'day', label: 'Dag' },
            { value: 'dusk', label: 'Schemer' },
            { value: 'night', label: 'Nacht' },
          ]}
        />
      </div>
      <p className="field__hint" style={{ marginTop: 14 }}>
        Animatie, intro en licht worden alleen op dit apparaat onthouden.
      </p>
    </Section>
  );
}

/* ------------------------------------------------------------------ Sound */

function NotifyToggle() {
  const prefs = usePrefs();
  const [permission, setPermission] = useState(notificationPermission());
  const [pushOn, setPushOn] = useState(false);
  const [pushProblem, setPushProblem] = useState<string | null>(null);
  const sharing = isSharing();
  useEffect(() => {
    void pushEnabled().then(setPushOn);
  }, []);
  if (permission === 'unsupported') {
    return (
      <p className="field__hint">
        Meldingen: deze browser kan ze niet tonen. Zet de app op je beginscherm (op iPhone vanaf iOS
        16.4) en open hem van daaruit.
      </p>
    );
  }
  return (
    <>
      <Checkbox
        label="Meldingen: een seintje als de ander iets nieuws toevoegt, of als een brief opengaat"
        checked={prefs.notify && permission === 'granted'}
        onChange={async (on) => {
          if (on) {
            const ok = await enableNotifications();
            setPermission(notificationPermission());
            if (ok && sharing) {
              try {
                await enablePush();
                setPushOn(true);
                setPushProblem(null);
              } catch (error) {
                setPushProblem((error as Error).message);
              }
            }
            toast(ok ? 'Meldingen staan aan ♡' : 'Je telefoon staat meldingen nog niet toe.');
          } else {
            updatePrefs({ notify: false });
            await disablePush().catch(() => undefined);
            setPushOn(false);
          }
        }}
      />
      <p className="field__hint">
        {permission === 'denied'
          ? 'Meldingen zijn geblokkeerd in de instellingen van je telefoon of browser.'
          : pushOn
            ? 'Ook als de app helemaal dicht is: jouw beurt in een spelletje, een hartje of knuffel, en Gouden Woensdag.'
            : pushSupport() === 'install-first' && sharing
              ? 'Zet de app op je beginscherm en open hem daarvandaan, dan komen meldingen ook binnen als de app dicht is.'
              : 'Je krijgt ze terwijl de app open is of op de achtergrond draait.'}
      </p>
      {pushProblem && <p className="field__hint">Meldingen bij een dichte app: {pushProblem}</p>}
    </>
  );
}

function SoundSection() {
  const prefs = usePrefs();
  const music = useMusic();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith('audio/')) {
      setError('Dat bestand is geen audio. Probeer een MP3 of M4A.');
      return;
    }
    if (file.size > MAX_AUDIO_BYTES) {
      setError(
        `Dat liedje is ${formatBytes(file.size)} — er past hier maximaal ${formatBytes(MAX_AUDIO_BYTES)}.`,
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
      toast('Onze soundtrack staat klaar');
    } catch {
      setError('Deze browser kon het liedje niet bewaren.');
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
    <Section id="sound" title="Geluid" kicker="music on the first tap">
      <OpeningSong />
      <div className="form">
        <Segmented
          legend="Onze soundtrack"
          value={prefs.soundtrack}
          onChange={(soundtrack) => {
            if (soundtrack === 'custom' && !prefs.customSoundtrackId) {
              inputRef.current?.click();
              return;
            }
            updatePrefs({ soundtrack });
          }}
          options={[
            { value: 'musicbox', label: 'Klein muziekdoosje' },
            {
              value: 'custom',
              label: prefs.customSoundtrackName
                ? `“${prefs.customSoundtrackName}”`
                : 'Ons eigen liedje',
            },
          ]}
          hint="Het muziekdoosje is een origineel slaapliedje, gemaakt voor deze site. Jullie eigen liedje is een audiobestand dat op dit apparaat staat."
        />
        <div className="settings-actions">
          <button type="button" className="btn btn--soft" onClick={music.toggle}>
            {music.playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
            {music.playing ? 'Pauze' : 'Afspelen'}
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => inputRef.current?.click()}
          >
            <Music aria-hidden="true" />{' '}
            {prefs.customSoundtrackId ? 'Kies een ander liedje' : 'Upload ons liedje'}
          </button>
          {prefs.customSoundtrackId && (
            <button type="button" className="btn btn--quiet" onClick={removeSong}>
              Liedje weghalen
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
        <Checkbox
          label="Little sounds: zachte geluidjes als je ergens op tikt"
          checked={prefs.sfx}
          onChange={(on) => updatePrefs({ sfx: on })}
        />
        <Checkbox
          label="Sfeergeluiden: bubbels in de spa, wind op het perron, een uil bij de pompoenen…"
          checked={prefs.ambience}
          onChange={(on) => updatePrefs({ ambience: on })}
        />
        <NotifyToggle />
      </div>
    </Section>
  );
}

/** The song that starts with our opening, on the first tap. */
function OpeningSong() {
  const saved = useContent((c) => c.profile.openingSong);
  const [value, setValue] = useState(saved);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setValue(saved), [saved]);
  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (value.trim() && !spotifyItem(value)) {
      setError('Plak een Spotify-link van een nummer, album of playlist.');
      return;
    }
    updateProfile({ openingSong: value.trim() ? spotifyItem(value)!.url : '' });
    toast(value.trim() ? 'Openingsliedje opgeslagen ♪' : 'Geen openingsliedje meer');
  };
  return (
    <form className="form settings-opening" onSubmit={save} noValidate>
      <TextField
        label="Openingsliedje"
        value={value}
        onChange={(v) => {
          setValue(v);
          setError(null);
        }}
        inputMode="url"
        autoComplete="off"
        placeholder="https://open.spotify.com/track/…"
        error={error}
        hint="Begint zodra je op “Start ons verhaal” tikt, via Spotify. Wie in deze browser bij Spotify is ingelogd hoort het hele nummer, anders een fragment van 30 seconden. Hebben jullie het nummer zelf als bestand? Upload het hieronder als ‘ons eigen liedje’ — dan speelt dat bij de opening."
      />
      <div className="settings-actions">
        <button type="submit" className="btn btn--soft">
          Opslaan
        </button>
      </div>
    </form>
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
          setUsage(`${formatBytes(used)} gebruikt van ongeveer ${formatBytes(quota)}`);
      })
      .catch(() => undefined);
  }, [content]);

  const exportBackup = async (withMedia: boolean) => {
    setBusy(withMedia ? 'export-media' : 'export');
    try {
      const { blob, filename, mediaCount } = await createBackup(withMedia);
      downloadBlob(blob, filename);
      if (withMedia) {
        try {
          localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
        } catch {
          // Only used to remind us.
        }
      }
      toast(
        withMedia
          ? `Backup opgeslagen met ${mediaCount} foto’s/clips (${formatBytes(blob.size)})`
          : 'Backup opgeslagen',
      );
    } catch {
      toast('De backup kon niet gemaakt worden.', { tone: 'error' });
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
        title: 'Deze backup terugzetten?',
        message: `Er zit in: ${preview.summary} Alles wat nu op dit apparaat staat wordt hierdoor vervangen.${isSharing() ? ' Omdat ons universe gedeeld is, krijgt de andere telefoon deze versie ook.' : ''}`,
        confirmLabel: 'Vervangen & terugzetten',
        tone: 'danger',
      });
      if (ok) {
        await applyBackup(preview);
        toast('Backup teruggezet ♡');
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Die backup kon niet gelezen worden.', {
        tone: 'error',
      });
    } finally {
      setBusy(null);
    }
  };

  const removeSamples = async () => {
    const ok = await confirm({
      title: `${samples} voorbeelditems weghalen?`,
      message:
        'Dit wist de voorbeeldhoofdstukken, -herinneringen, starterbrieven en -dromen, zodat alleen overblijft wat we zelf geschreven hebben. Wat je hebt aangepast blijft staan.',
      confirmLabel: 'Voorbeelden weghalen',
      tone: 'danger',
    });
    if (!ok) return;
    removeSampleContent();
    toast('Voorbeelden weggehaald — it’s all ours now');
  };

  const resetEverything = async () => {
    const ok = await confirm({
      title: 'Alles op dit apparaat wissen?',
      message: isSharing()
        ? 'Dit apparaat logt uit van ons gedeelde universe en vergeet alles wat erop staat. Het gedeelde universe online — en de andere telefoon — blijven precies zoals ze zijn.'
        : 'Alle hoofdstukken, foto’s, brieven, dromen en instellingen in deze browser worden verwijderd en de startinhoud komt terug. Dit kan niet ongedaan worden — maak eerst een backup als je iets wilt bewaren.',
      confirmLabel: 'Alles wissen',
      tone: 'danger',
    });
    if (!ok) return;
    await disconnectBeforeReset();
    await clearMedia().catch(() => undefined);
    resetAllLocalData();
    toast('Alles is gereset');
  };

  return (
    <Section id="data" title="Onze data & backups" kicker="keep it safe">
      <SafetySection />
      {!storageAvailable && (
        <p className="notice" role="alert">
          <HardDrive aria-hidden="true" />
          Deze browser blokkeert opslag (privé browsen?), dus wijzigingen blijven niet bewaard na
          het sluiten.
        </p>
      )}
      <p className="settings-text">
        Alles staat in deze browser op dit apparaat. Maak af en toe een backup — zo zet je voorlopig
        ook alles over naar een andere telefoon.
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
          {busy === 'export-media' ? 'Foto’s inpakken…' : 'Exporteren met foto’s'}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => exportBackup(false)}
          disabled={busy !== null}
        >
          <Download aria-hidden="true" /> Alleen tekst
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => importRef.current?.click()}
          disabled={busy !== null}
        >
          <Upload aria-hidden="true" /> {busy === 'import' ? 'Lezen…' : 'Backup terugzetten'}
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
          <h3>Voorbeeldinhoud</h3>
          <p className="settings-text">
            {samples > 0
              ? `Er staan nog ${samples} voorbeelditems (gemarkeerd met “Voorbeeld” of “Starter”).`
              : 'Geen voorbeelden meer — alles hier is van ons.'}
          </p>
        </div>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={removeSamples}
          disabled={samples === 0}
        >
          <Eraser aria-hidden="true" /> Voorbeelden weghalen
        </button>
      </div>
      <div className="settings-danger">
        <div>
          <h3>Opnieuw beginnen</h3>
          <p className="settings-text">Wis alles wat op dit apparaat staat.</p>
        </div>
        <button type="button" className="btn btn--danger" onClick={resetEverything}>
          <RotateCcw aria-hidden="true" /> Alles wissen
        </button>
      </div>
      <p className="field__hint">
        Nu: {content.memories.length} herinneringen, {content.letters.length} brieven en{' '}
        {content.milestones.length} hoofdstukken.
      </p>
    </Section>
  );
}

/* ---------------------------------------------------------------- Privacy */

function PrivacySection() {
  return (
    <Section id="privacy" title="Privacy & delen" kicker="being honest">
      <ul className="settings-list">
        <li>
          <strong>Zonder delen:</strong> er verlaat niets dit apparaat. Foto’s, brieven en al het
          andere blijven in deze browser.
        </li>
        <li>
          <strong>Met delen:</strong> ons universe woont in ons eigen Supabase-project. Alleen de
          twee ingelogde accounts kunnen het lezen — de database zelf dwingt dat af, en foto’s staan
          in een privémap die alleen wij kunnen openen.
        </li>
        <li>
          <strong>Wachtwoorden</strong> worden nooit in de app bewaard. Een apparaat blijft ingelogd
          met een sessie die je altijd kunt beëindigen met “Uitloggen”.
        </li>
        <li>
          <strong>Zonder account</strong> is er geen wachtwoordscherm: een slot zonder echte server
          zou alleen veilig lijken. Wie deze ontgrendelde telefoon vasthoudt, kan de site openen.
        </li>
      </ul>
      <p className="notice notice--plain" style={{ marginTop: 16 }}>
        <ShieldCheck aria-hidden="true" />
        Browsers kunnen websitedata wissen als een telefoon bijna vol zit. De site op je beginscherm
        zetten en een recente backup bewaren maakt dat een stuk minder erg.
      </p>
    </Section>
  );
}
