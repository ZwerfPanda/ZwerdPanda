import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { useRoute, type RoutePath } from '../lib/router';
import { onPersistError, useContent, usePrefs } from '../data/store';
import { cleanupOrphanMedia } from '../data/actions';
import { useReducedMotion } from '../hooks/useMotion';
import { MenuSheet, MiniPlayer, TabBar, TopBar } from './Shell';
import { sectionFor } from './sections';
import { MusicProvider } from '../components/music/MusicProvider';
import { SpotifyProvider } from '../components/music/SpotifyProvider';
import { CelebrationHost, ConfirmHost, Toaster, toast } from '../components/ui/feedback';
import { Intro } from '../features/intro/Intro';
import { InstallSheetHost } from '../pwa/InstallSheet';
import { startSync } from '../sync/sync';
import { HomePage } from '../features/home/HomePage';
import { PageLoading } from './PageLoading';
import { CocoCompanion } from '../features/pet/Companion';
import { WelcomeHost } from '../features/welcome/Welcome';
import { HiddenHutch } from '../features/pet/HiddenHutch';
import { installTapSounds, setSfxEnabled } from '../lib/audio/sfx';

// Home ships with the first load; every other page is loaded on demand.
const pages = {
  story: () => import('../features/story/StoryPage').then((m) => ({ default: m.StoryPage })),
  memories: () =>
    import('../features/memories/MemoriesPage').then((m) => ({ default: m.MemoriesPage })),
  world: () => import('../features/world/WorldPage').then((m) => ({ default: m.WorldPage })),
  letters: () =>
    import('../features/letters/LettersPage').then((m) => ({ default: m.LettersPage })),
  future: () => import('../features/future/FuturePage').then((m) => ({ default: m.FuturePage })),
  surprises: () =>
    import('../features/surprises/SurprisesPage').then((m) => ({ default: m.SurprisesPage })),
  music: () => import('../features/music/MusicPage').then((m) => ({ default: m.MusicPage })),
  coco: () => import('../features/coco/CocoPage').then((m) => ({ default: m.CocoPage })),
  us: () => import('../features/us/MiniUsPage').then((m) => ({ default: m.MiniUsPage })),
  lists: () => import('../features/lists/ListsPage').then((m) => ({ default: m.ListsPage })),
  her: () => import('../features/her/HerPage').then((m) => ({ default: m.HerPage })),
  museum: () => import('../features/museum/MuseumPage').then((m) => ({ default: m.MuseumPage })),
  settings: () =>
    import('../features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
};
const StoryPage = lazy(pages.story);
const MemoriesPage = lazy(pages.memories);
const WorldPage = lazy(pages.world);
const LettersPage = lazy(pages.letters);
const FuturePage = lazy(pages.future);
const SurprisesPage = lazy(pages.surprises);
const MusicPage = lazy(pages.music);
const CocoPage = lazy(pages.coco);
const MiniUsPage = lazy(pages.us);
const ListsPage = lazy(pages.lists);
const HerPage = lazy(pages.her);
const MuseumPage = lazy(pages.museum);
const SettingsPage = lazy(pages.settings);

const PAGES: Record<RoutePath, () => React.ReactNode> = {
  '/': () => <HomePage />,
  '/story': () => <StoryPage />,
  '/memories': () => <MemoriesPage />,
  '/world': () => <WorldPage />,
  '/letters': () => <LettersPage />,
  '/future': () => <FuturePage />,
  '/surprises': () => <SurprisesPage />,
  '/music': () => <MusicPage />,
  '/coco': () => <CocoPage />,
  '/us': () => <MiniUsPage />,
  '/lists': () => <ListsPage />,
  '/her': () => <HerPage />,
  '/museum': () => <MuseumPage />,
  '/settings': () => <SettingsPage />,
};

const INTRO_SEEN_KEY = 'olu:intro-seen';

function shouldShowIntro(mode: 'session' | 'always' | 'never'): boolean {
  if (mode === 'never') return false;
  if (mode === 'always') return true;
  try {
    return sessionStorage.getItem(INTRO_SEEN_KEY) !== '1';
  } catch {
    return true;
  }
}

const THEME_COLORS = {
  blush: '#2a1530',
  lavender: '#2a1d3f',
  matcha: '#22301f',
  midnight: '#1b1222',
} as const;

export function App() {
  const route = useRoute();
  const profile = useContent((c) => c.profile);
  const prefs = usePrefs();
  const reduce = useReducedMotion();
  const [introOpen, setIntroOpen] = useState(() => shouldShowIntro(prefs.intro));
  const [menuOpen, setMenuOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = profile.theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', THEME_COLORS[profile.theme]);
  }, [profile.theme]);

  useEffect(() => {
    document.documentElement.dataset.motion = reduce ? 'reduce' : 'full';
  }, [reduce]);

  useEffect(() => {
    const section = sectionFor(route.path);
    document.title =
      route.path === '/' ? profile.siteTitle : `${section.label} · ${profile.siteTitle}`;
  }, [route.path, profile.siteTitle]);

  useEffect(() => onPersistError((message) => toast(message, { tone: 'error' })), []);

  useEffect(() => setSfxEnabled(prefs.sfx), [prefs.sfx]);
  useEffect(() => installTapSounds(), []);

  // Connect to our shared universe, if one is configured.
  useEffect(() => {
    void startSync();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      cleanupOrphanMedia().catch(() => {
        // Media storage unavailable (private mode); nothing to tidy.
      });
      // Warm up the other pages so moving around feels instant.
      Object.values(pages).forEach((load) => load().catch(() => undefined));
    }, 4000);
    return () => window.clearTimeout(timer);
  }, []);

  const closeIntro = () => {
    try {
      sessionStorage.setItem(INTRO_SEEN_KEY, '1');
    } catch {
      // Session storage blocked: the intro may simply show again next visit.
    }
    setIntroOpen(false);
  };

  const skipToContent = () => {
    mainRef.current?.focus();
  };

  return (
    <MotionConfig reducedMotion={reduce ? 'always' : 'never'}>
      <MusicProvider>
        <SpotifyProvider>
          <button type="button" className="skip-link" onClick={skipToContent}>
            Naar de inhoud
          </button>
          <TopBar onOpenMenu={() => setMenuOpen(true)} />
          <AnimatePresence mode="wait" initial={false} onExitComplete={() => window.scrollTo(0, 0)}>
            <motion.main
              key={route.path}
              id="main"
              ref={mainRef}
              tabIndex={-1}
              style={{ outline: 'none' }}
              initial={{ opacity: 0, y: reduce ? 0 : 14 }}
              animate={{
                opacity: 1,
                y: 0,
                transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] },
              }}
              exit={{ opacity: 0, y: reduce ? 0 : -8, transition: { duration: 0.16 } }}
            >
              <Suspense fallback={<PageLoading />}>{PAGES[route.path]()}</Suspense>
            </motion.main>
          </AnimatePresence>
          <TabBar />
          <MenuSheet open={menuOpen} onClose={() => setMenuOpen(false)} />
          <MiniPlayer />
          {!introOpen && <CocoCompanion />}
          {!introOpen && <HiddenHutch />}
          <Toaster />
          <ConfirmHost />
          <CelebrationHost />
          <InstallSheetHost />
          {!introOpen && <WelcomeHost />}
          <AnimatePresence>
            {introOpen && <Intro key="intro" onEnter={closeIntro} />}
          </AnimatePresence>
        </SpotifyProvider>
      </MusicProvider>
    </MotionConfig>
  );
}
