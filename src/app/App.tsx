import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { useRoute, type RoutePath } from '../lib/router';
import { onPersistError, useContent, usePrefs } from '../data/store';
import { cleanupOrphanMedia } from '../data/actions';
import { useReducedMotion } from '../hooks/useMotion';
import { MenuSheet, MiniPlayer, TabBar, TopBar } from './Shell';
import { sectionFor } from './sections';
import { MusicProvider } from '../components/music/MusicProvider';
import { CelebrationHost, ConfirmHost, Toaster, toast } from '../components/ui/feedback';
import { Intro } from '../features/intro/Intro';
import { HomePage } from '../features/home/HomePage';
import { StoryPage } from '../features/story/StoryPage';
import { MemoriesPage } from '../features/memories/MemoriesPage';
import { WorldPage } from '../features/world/WorldPage';
import { LettersPage } from '../features/letters/LettersPage';
import { FuturePage } from '../features/future/FuturePage';
import { SurprisesPage } from '../features/surprises/SurprisesPage';
import { MusicPage } from '../features/music/MusicPage';
import { CocoPage } from '../features/coco/CocoPage';
import { SettingsPage } from '../features/settings/SettingsPage';

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

const THEME_COLORS = { blush: '#2a1530', lavender: '#2a1d3f', matcha: '#22301f', midnight: '#1b1222' } as const;

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
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[profile.theme]);
  }, [profile.theme]);

  useEffect(() => {
    document.documentElement.dataset.motion = reduce ? 'reduce' : 'full';
  }, [reduce]);

  useEffect(() => {
    const section = sectionFor(route.path);
    document.title = route.path === '/' ? profile.siteTitle : `${section.label} · ${profile.siteTitle}`;
  }, [route.path, profile.siteTitle]);

  useEffect(() => onPersistError((message) => toast(message, { tone: 'error' })), []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      cleanupOrphanMedia().catch(() => {
        // Media storage unavailable (private mode); nothing to tidy.
      });
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
        <button type="button" className="skip-link" onClick={skipToContent}>
          Skip to content
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
            animate={{ opacity: 1, y: 0, transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] } }}
            exit={{ opacity: 0, y: reduce ? 0 : -8, transition: { duration: 0.16 } }}
          >
            {PAGES[route.path]()}
          </motion.main>
        </AnimatePresence>
        <TabBar />
        <MenuSheet open={menuOpen} onClose={() => setMenuOpen(false)} />
        <MiniPlayer />
        <Toaster />
        <ConfirmHost />
        <CelebrationHost />
        <AnimatePresence>{introOpen && <Intro key="intro" onEnter={closeIntro} />}</AnimatePresence>
      </MusicProvider>
    </MotionConfig>
  );
}
