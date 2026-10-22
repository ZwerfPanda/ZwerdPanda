import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LayoutGrid, Pause, Play, Settings2, X } from 'lucide-react';
import { href, useRoute, type RoutePath } from '../lib/router';
import { DESKTOP_PATHS, SECTIONS, TAB_PATHS, sectionFor } from './sections';
import { LogoMark } from '../components/art/LogoMark';
import { Dialog } from '../components/ui/Dialog';
import { useMusic } from '../components/music/MusicProvider';
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
          <nav className="topnav" aria-label="Main">
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
          {desktop && (
            <a
              className="icon-btn"
              href={href('/settings')}
              aria-label="Settings"
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
            <span>{desktop ? 'Everything' : 'Menu'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}

export function TabBar() {
  const { path } = useRoute();
  return (
    <nav className="tabbar" aria-label="Main">
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

export function MenuSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { path } = useRoute();
  // Close the menu as soon as a destination is chosen.
  useEffect(() => {
    onClose();
    // Only the route matters here; onClose is a stable setter wrapper.
  }, [path]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Everything in our universe"
      eyebrow="a little map"
      size="md"
    >
      <nav aria-label="All sections">
        <ul className="menu-grid">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            return (
              <li key={s.path}>
                <a
                  className="menu-tile"
                  href={href(s.path)}
                  aria-current={path === s.path ? 'page' : undefined}
                >
                  <span
                    className="menu-tile__icon"
                    style={{ background: s.tint }}
                    aria-hidden="true"
                  >
                    <Icon />
                  </span>
                  <span className="menu-tile__text">
                    <span className="menu-tile__label">{s.label}</span>
                    <span className="menu-tile__blurb">{s.blurb}</span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </nav>
    </Dialog>
  );
}

export function MiniPlayer() {
  const music = useMusic();
  // Appears when music starts and stays (so it can be resumed) until closed.
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (music.playing) setVisible(true);
  }, [music.playing]);

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
          <span className="miniplayer__bars" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="miniplayer__label">{music.label}</span>
          <button
            type="button"
            className="miniplayer__btn"
            onClick={music.toggle}
            aria-label={music.playing ? 'Pause music' : 'Play music'}
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
            aria-label="Stop music and close player"
          >
            <X />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
