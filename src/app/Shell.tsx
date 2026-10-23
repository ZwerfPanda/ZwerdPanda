import { useEffect, useState } from 'react';
import { SearchButton } from '../features/search/Search';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown,
  ChevronUp,
  Cloud,
  CloudOff,
  LayoutGrid,
  LoaderCircle,
  Pause,
  Play,
  Settings2,
  Smartphone,
  X,
} from 'lucide-react';
import { openInstallSheet } from '../pwa/InstallSheet';
import { useSyncState } from '../sync/sync';
import { href, useRoute, type RoutePath } from '../lib/router';
import { DESKTOP_PATHS, GROUPS, TAB_PATHS, sectionFor, sectionsIn, type Section } from './sections';
import { LogoMark } from '../components/art/LogoMark';
import { Dialog } from '../components/ui/Dialog';
import { useMusic } from '../components/music/MusicProvider';
import { useSpotify } from '../components/music/SpotifyProvider';
import { useContent } from '../data/store';
import { useIsDesktop } from '../hooks/useMediaQuery';
import './shell.css';

/** Pages whose top area is a night sky, so the bar switches to light text. */
const DARK_TOP: RoutePath[] = ['/', '/world'];

export function TopBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { path } = useRoute();
  const title = useContent((c) => c.profile.siteTitle);
  const desktop = useIsDesktop();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [path]);

  const dark = DARK_TOP.includes(path) && !scrolled;

  return (
    <header className={`topbar ${scrolled ? 'is-scrolled' : ''} ${dark ? 'is-dark' : ''}`}>
      <div className="topbar__inner">
        <a className="topbar__brand" href={href('/')} aria-label={`${title} — home`}>
          <LogoMark size={desktop ? 38 : 32} />
          <span className="topbar__title">{title}</span>
        </a>

        {desktop && (
          <nav className="topnav" aria-label="Hoofdmenu">
            {DESKTOP_PATHS.map((p) => {
              const s = sectionFor(p);
              const active = path === p;
              return (
                <a
                  key={p}
                  href={href(p)}
                  className="topnav__link"
                  aria-current={active ? 'page' : undefined}
                >
                  {s.short}
                  {active && (
                    <motion.span layoutId="topnav-dot" className="topnav__dot" aria-hidden="true" />
                  )}
                </a>
              );
            })}
          </nav>
        )}

        <div className="topbar__actions">
          <SyncBadge />
          <SearchButton />
          {desktop && (
            <a
              className="icon-btn"
              href={href('/settings')}
              aria-label="Instellingen"
              aria-current={path === '/settings' ? 'page' : undefined}
            >
              <Settings2 />
            </a>
          )}
          <button
            type="button"
            className="topbar__menu"
            onClick={onOpenMenu}
            aria-haspopup="dialog"
          >
            <LayoutGrid aria-hidden="true" />
            <span>{desktop ? 'Alles' : 'Menu'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}

/** A small cloud in the top bar while our universe is shared: synced, syncing or offline. */
function SyncBadge() {
  const sync = useSyncState();
  if (!sync.spaceId && sync.phase !== 'error') return null;
  if (sync.phase === 'off' || sync.phase === 'signed-out') return null;
  const label =
    sync.phase === 'syncing'
      ? 'Bezig met syncen'
      : sync.phase === 'offline'
        ? 'Offline — synct straks vanzelf'
        : sync.phase === 'error'
          ? 'Probleem met syncen'
          : 'Gesynct';
  const Icon =
    sync.phase === 'syncing'
      ? LoaderCircle
      : sync.phase === 'offline' || sync.phase === 'error'
        ? CloudOff
        : Cloud;
  return (
    <a
      className={`sync-badge sync-badge--${sync.phase}`}
      href={href('/settings', { section: 'together' })}
      aria-label={`${label}. Open de deel-instellingen`}
      title={label}
    >
      <Icon aria-hidden="true" className={sync.phase === 'syncing' ? 'spin' : undefined} />
    </a>
  );
}

export function TabBar() {
  const { path } = useRoute();
  return (
    <nav className="tabbar" aria-label="Hoofdmenu">
      {TAB_PATHS.map((p) => {
        const s = sectionFor(p);
        const Icon = s.icon;
        const active = path === p;
        if (p === '/world') {
          return (
            <a
              key={p}
              href={href(p)}
              className={`tabbar__world ${active ? 'is-active' : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <span className="tabbar__orb" aria-hidden="true">
                <WorldOrb />
              </span>
              <span className="tabbar__label">{s.short}</span>
            </a>
          );
        }
        return (
          <a
            key={p}
            href={href(p)}
            className="tabbar__item"
            aria-current={active ? 'page' : undefined}
          >
            <Icon aria-hidden="true" />
            <span className="tabbar__label">{s.short}</span>
            {active && (
              <motion.span layoutId="tab-dot" className="tabbar__dot" aria-hidden="true" />
            )}
          </a>
        );
      })}
    </nav>
  );
}

function WorldOrb() {
  return (
    <svg viewBox="0 0 56 56" width="56" height="56">
      <defs>
        <radialGradient id="orb-fill" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#fbe0cd" />
          <stop offset="0.45" stopColor="#d48d96" />
          <stop offset="1" stopColor="#6a3a63" />
        </radialGradient>
      </defs>
      <circle cx="28" cy="28" r="20" fill="url(#orb-fill)" />
      <path
        d="M12 33c4 3 14 5 22 2 4-1 8-4 10-7"
        fill="none"
        stroke="#a7c191"
        strokeWidth="5"
        strokeLinecap="round"
        opacity="0.9"
      />
      <circle cx="21" cy="20" r="3" fill="#fffcf6" opacity="0.7" />
      <ellipse
        cx="28"
        cy="30"
        rx="26"
        ry="7.5"
        fill="none"
        stroke="#e8bd6a"
        strokeWidth="2"
        transform="rotate(-16 28 30)"
        strokeDasharray="60 12"
      />
    </svg>
  );
}

function MenuTile({ section: s, current }: { section: Section; current: boolean }) {
  const Icon = s.icon;
  return (
    <a className="menu-tile" href={href(s.path)} aria-current={current ? 'page' : undefined}>
      <span className="menu-tile__icon" style={{ background: s.tint }} aria-hidden="true">
        <Icon />
      </span>
      <span className="menu-tile__text">
        <span className="menu-tile__label">{s.label}</span>
        <span className="menu-tile__blurb">{s.blurb}</span>
      </span>
    </a>
  );
}

export function MenuSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { path } = useRoute();
  const museumFound = useContent((c) => Boolean(c.museum.foundAt));
  // Close the menu as soon as a destination is chosen.
  useEffect(() => {
    onClose();
    // Only the route matters here; onClose is a stable setter wrapper.
  }, [path]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Alles in ons universe"
      eyebrow="a little map"
      size="md"
    >
      <nav aria-label="Alle onderdelen" className="menu-planets">
        <ul className="menu-quick">
          {[sectionFor('/'), sectionFor('/settings')].map((s) => (
            <li key={s.path}>
              <MenuTile section={s} current={path === s.path} />
            </li>
          ))}
        </ul>
        {GROUPS.map((g) => {
          const items = sectionsIn(g.id).filter((s) => !s.secret || museumFound);
          return (
            <section
              key={g.id}
              className="menu-planet"
              aria-labelledby={`planet-${g.id}`}
              style={{ '--planet': g.color, '--ring': g.ring } as React.CSSProperties}
            >
              <h3 id={`planet-${g.id}`} className="menu-planet__head">
                <span className="menu-planet__orb" aria-hidden="true">
                  {g.emoji}
                </span>
                <span>
                  <strong>{g.label}</strong>
                  <small>{g.blurb}</small>
                </span>
              </h3>
              <ul className="menu-grid">
                {items.map((s) => (
                  <li key={s.path}>
                    <MenuTile section={s} current={path === s.path} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </nav>
      <div className="menu-app">
        <button
          type="button"
          className="menu-app__btn"
          onClick={() => {
            onClose();
            openInstallSheet();
          }}
        >
          <Smartphone aria-hidden="true" />
          <span>
            <strong>Zet de app op je telefoon</strong>
            <span>Op iPhone, Android of je computer</span>
          </span>
        </button>
        <a className="menu-app__btn" href={href('/settings', { section: 'together' })}>
          <Cloud aria-hidden="true" />
          <span>
            <strong>Samen op elk apparaat</strong>
            <span>Eén universe op jullie allebei je telefoon</span>
          </span>
        </a>
      </div>
    </Dialog>
  );
}

export function MiniPlayer() {
  const music = useMusic();
  const spotify = useSpotify();
  // Appears when music starts and stays (so it can be resumed) until closed.
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (music.playing) setVisible(true);
  }, [music.playing]);

  // Spotify gets the same bar while one of our playlists is on.
  if (spotify.current) {
    const playing = spotify.paused === false;
    return (
      <AnimatePresence>
        <motion.div
          key="spotify"
          className="miniplayer miniplayer--spotify"
          role="region"
          aria-label="Nu op Spotify"
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: 'spring', damping: 24, stiffness: 300 }}
        >
          <span className={`miniplayer__bars ${playing ? '' : 'is-still'}`} aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <button
            type="button"
            className="miniplayer__label miniplayer__label--btn"
            onClick={() => spotify.setExpanded(!spotify.expanded)}
            aria-expanded={spotify.expanded}
            aria-label={`${spotify.current.title} op Spotify — speler ${spotify.expanded ? 'verbergen' : 'tonen'}`}
          >
            {spotify.current.title}
          </button>
          {spotify.controllable ? (
            <button
              type="button"
              className="miniplayer__btn"
              onClick={spotify.togglePlay}
              aria-label={playing ? 'Spotify pauzeren' : 'Spotify afspelen'}
            >
              {playing ? <Pause /> : <Play />}
            </button>
          ) : (
            <button
              type="button"
              className="miniplayer__btn"
              onClick={() => spotify.setExpanded(!spotify.expanded)}
              aria-label={spotify.expanded ? 'Spotify-speler verbergen' : 'Spotify-speler tonen'}
            >
              {spotify.expanded ? <ChevronDown /> : <ChevronUp />}
            </button>
          )}
          <button
            type="button"
            className="miniplayer__btn"
            onClick={spotify.close}
            aria-label="Spotify stoppen en speler sluiten"
          >
            <X />
          </button>
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="miniplayer"
          role="region"
          aria-label="Now playing"
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: 'spring', damping: 24, stiffness: 300 }}
        >
          <span
            className={`miniplayer__bars ${music.playing ? '' : 'is-still'}`}
            aria-hidden="true"
          >
            <i />
            <i />
            <i />
          </span>
          <span className="miniplayer__label">{music.label}</span>
          <button
            type="button"
            className="miniplayer__btn"
            onClick={music.toggle}
            aria-label={music.playing ? 'Muziek pauzeren' : 'Muziek afspelen'}
          >
            {music.playing ? <Pause /> : <Play />}
          </button>
          <button
            type="button"
            className="miniplayer__btn"
            onClick={() => {
              music.pause();
              setVisible(false);
            }}
            aria-label="Muziek stoppen en speler sluiten"
          >
            <X />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
